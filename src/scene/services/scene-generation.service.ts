import { HttpStatus, Injectable } from '@nestjs/common';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { GlbBuilderService } from '../../assets/glb-builder.service';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { AppException } from '../../common/errors/app.exception';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import { GooglePlacesClient } from '../../places/clients/google-places.client';
import { OverpassClient } from '../../places/clients/overpass.client';
import { midpoint, isFiniteCoordinate } from '../../places/utils/geo.utils';
import type {
  Coordinate,
  GeoBounds,
  PlacePackage,
} from '../../places/types/place.types';
import { SceneRepository } from '../storage/scene.repository';
import { getSceneDataDir } from '../storage/scene-storage.utils';
import type {
  SceneCreateOptions,
  SceneDetail,
  SceneEntity,
  SceneMeta,
  SceneScale,
  StoredScene,
} from '../types/scene.types';
import { buildSceneAssetSelection } from '../utils/scene-asset-profile.utils';
import { resolveBuildingStyle } from '../utils/scene-building-style.utils';
import { computeSceneCamera, resolveSceneBounds } from '../utils/scene-geometry.utils';
import { SceneHeroOverrideService } from './scene-hero-override.service';
import { SceneVisionService } from './scene-vision.service';

@Injectable()
export class SceneGenerationService {
  private readonly maxGenerationAttempts = 2;
  private readonly generationQueue: string[] = [];
  private isProcessingQueue = false;

  constructor(
    private readonly sceneRepository: SceneRepository,
    private readonly glbBuilderService: GlbBuilderService,
    private readonly googlePlacesClient: GooglePlacesClient,
    private readonly overpassClient: OverpassClient,
    private readonly sceneVisionService: SceneVisionService,
    private readonly sceneHeroOverrideService: SceneHeroOverrideService,
    private readonly appLoggerService: AppLoggerService,
  ) {}

  async createScene(
    query: string,
    scale: SceneScale,
    options: SceneCreateOptions = {},
  ): Promise<SceneEntity> {
    const requestKey = this.buildRequestKey(query, scale);
    if (!options.forceRegenerate) {
      const existing = await this.sceneRepository.findByRequestKey(requestKey);
      if (
        existing &&
        existing.scene.status !== 'FAILED' &&
        (await this.isReusableScene(existing))
      ) {
        this.appLoggerService.info('scene.reused', {
          requestId: options.requestId,
          sceneId: existing.scene.sceneId,
          source: options.source ?? 'api',
          step: 'reuse',
          query,
          scale,
        });
        return existing.scene;
      }
    }

    const sceneId = this.buildSceneId(query, options.forceRegenerate);
    const createdAt = new Date().toISOString();
    const scene: SceneEntity = {
      sceneId,
      placeId: null,
      name: query,
      centerLat: 0,
      centerLng: 0,
      radiusM: this.resolveRadius(scale),
      status: 'PENDING',
      metaUrl: `/api/scenes/${sceneId}/meta`,
      assetUrl: null,
      createdAt,
      updatedAt: createdAt,
      failureReason: null,
    };

    await this.sceneRepository.save(
      {
        requestKey,
        query,
        scale,
        generationSource: options.source ?? 'api',
        requestId: options.requestId ?? null,
        attempts: 0,
        scene,
      },
      requestKey,
    );
    this.appLoggerService.info('scene.queued', {
      requestId: options.requestId,
      sceneId,
      source: options.source ?? 'api',
      step: 'queue',
      query,
      scale,
      forceRegenerate: options.forceRegenerate ?? false,
    });
    this.enqueueGeneration(sceneId);

    return scene;
  }

  async waitForIdle(): Promise<void> {
    while (this.isProcessingQueue || this.generationQueue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  private buildRequestKey(query: string, scale: SceneScale): string {
    return `${query.trim().toLowerCase()}::${scale}`;
  }

  private enqueueGeneration(sceneId: string): void {
    this.generationQueue.push(sceneId);
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;
    try {
      while (this.generationQueue.length > 0) {
        const sceneId = this.generationQueue.shift();
        if (!sceneId) {
          continue;
        }
        await this.processGeneration(sceneId);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async processGeneration(sceneId: string): Promise<void> {
    const storedScene = await this.getStoredScene(sceneId);
    const logContext = {
      requestId: storedScene.requestId ?? null,
      sceneId,
      source: storedScene.generationSource ?? 'api',
    };
    try {
      this.appLoggerService.info('scene.google_search.started', {
        ...logContext,
        provider: 'google_places',
        step: 'google_search',
        query: storedScene.query,
      });
      const candidates = await this.googlePlacesClient.searchText(
        storedScene.query,
        1,
      );
      this.appLoggerService.info('scene.google_search.completed', {
        ...logContext,
        provider: 'google_places',
        step: 'google_search',
        candidateCount: candidates.length,
      });
      const selected = candidates[0];
      if (!selected) {
        throw new AppException({
          code: ERROR_CODES.GOOGLE_PLACE_NOT_FOUND,
          message: '검색 결과에 해당하는 장소를 찾을 수 없습니다.',
          detail: { query: storedScene.query },
          status: HttpStatus.NOT_FOUND,
        });
      }

      this.appLoggerService.info('scene.google_detail.started', {
        ...logContext,
        provider: 'google_places',
        step: 'google_detail',
        placeId: selected.placeId,
      });
      const place = await this.googlePlacesClient.getPlaceDetail(selected.placeId);
      this.appLoggerService.info('scene.google_detail.completed', {
        ...logContext,
        provider: 'google_places',
        step: 'google_detail',
        placeId: place.placeId,
      });
      const radiusM = this.resolveRadius(storedScene.scale);
      const bounds = resolveSceneBounds(place.location, radiusM);
      this.appLoggerService.info('scene.overpass.started', {
        ...logContext,
        provider: 'overpass',
        step: 'overpass',
        radiusM,
        bounds,
      });
      const placePackage = await this.overpassClient.buildPlacePackage(place, {
        bounds,
        sceneId,
        requestId: storedScene.requestId ?? null,
      });
      this.appLoggerService.info('scene.overpass.completed', {
        ...logContext,
        provider: 'overpass',
        step: 'overpass',
        buildingCount: placePackage.buildings.length,
        roadCount: placePackage.roads.length,
        walkwayCount: placePackage.walkways.length,
        poiCount: placePackage.pois.length,
      });
      const vision = await this.sceneVisionService.buildSceneVision(
        sceneId,
        place,
        bounds,
        placePackage,
      );
      this.appLoggerService.info('scene.mapillary.completed', {
        ...logContext,
        provider: 'mapillary',
        step: 'vision',
        mapillaryUsed: vision.detail.provenance.mapillaryUsed,
        imageCount: vision.detail.provenance.mapillaryImageCount,
        featureCount: vision.detail.provenance.mapillaryFeatureCount,
      });
      const baseMeta = this.buildSceneMeta(
        sceneId,
        storedScene.scale,
        radiusM,
        placePackage,
        place,
        bounds,
        vision.detail,
        vision.metaPatch,
      );
      const merged = this.sceneHeroOverrideService.applyOverrides(
        place,
        baseMeta,
        vision.detail,
      );
      this.appLoggerService.info('scene.hero_override.completed', {
        ...logContext,
        step: 'hero_override',
        overrideCount: merged.detail.heroOverridesApplied.length,
      });
      const finalizedMeta = this.finalizeAssetProfile(
        merged.meta,
        merged.detail,
        storedScene.scale,
      );
      this.appLoggerService.info('scene.glb_build.started', {
        ...logContext,
        step: 'glb_build',
        detailStatus: merged.detail.detailStatus,
        selected: finalizedMeta.assetProfile.selected,
      });
      const assetPath = await this.glbBuilderService.build(
        finalizedMeta,
        merged.detail,
      );
      this.appLoggerService.info('scene.glb_build.completed', {
        ...logContext,
        step: 'glb_build',
        assetPath,
      });

      await this.sceneRepository.update(sceneId, (current) => ({
        ...current,
        attempts: current.attempts + 1,
        place,
        meta: finalizedMeta,
        detail: merged.detail,
        scene: {
          ...current.scene,
          placeId: place.placeId,
          name: place.displayName,
          centerLat: place.location.lat,
          centerLng: place.location.lng,
          status: 'READY',
          assetUrl: assetPath ? `/api/scenes/${sceneId}/assets/base.glb` : null,
          failureReason: null,
          updatedAt: new Date().toISOString(),
        },
      }));
      this.appLoggerService.info('scene.ready', {
        ...logContext,
        step: 'complete',
        status: 'READY',
      });
    } catch (error) {
      this.appLoggerService.error('scene.generation.failed', {
        ...logContext,
        step: 'generation',
        error,
      });
      await this.handleGenerationFailure(sceneId, storedScene, error);
    }
  }

  private async handleGenerationFailure(
    sceneId: string,
    storedScene: StoredScene,
    error: unknown,
  ): Promise<void> {
    const attempts = storedScene.attempts + 1;
    const failureReason =
      error instanceof Error ? error.message : 'Scene generation failed';

    if (attempts < this.maxGenerationAttempts) {
      this.appLoggerService.warn('scene.retrying', {
        requestId: storedScene.requestId ?? null,
        sceneId,
        source: storedScene.generationSource ?? 'api',
        step: 'retry',
        attempts,
        maxAttempts: this.maxGenerationAttempts,
        failureReason,
      });
      await this.sceneRepository.update(sceneId, (current) => ({
        ...current,
        attempts,
        scene: {
          ...current.scene,
          status: 'PENDING',
          failureReason,
          updatedAt: new Date().toISOString(),
        },
      }));
      this.enqueueGeneration(sceneId);
      return;
    }

    await this.sceneRepository.update(sceneId, (current) => ({
      ...current,
      attempts,
      scene: {
        ...current.scene,
        status: 'FAILED',
        failureReason,
        updatedAt: new Date().toISOString(),
      },
    }));
    this.appLoggerService.error('scene.failed', {
      requestId: storedScene.requestId ?? null,
      sceneId,
      source: storedScene.generationSource ?? 'api',
      step: 'failed',
      attempts,
      failureReason,
    });
  }

  private async getStoredScene(sceneId: string): Promise<StoredScene> {
    const storedScene = await this.sceneRepository.findById(sceneId);
    if (!storedScene) {
      throw new AppException({
        code: ERROR_CODES.SCENE_NOT_FOUND,
        message: 'Scene을 찾을 수 없습니다.',
        detail: { sceneId },
        status: HttpStatus.NOT_FOUND,
      });
    }

    return storedScene;
  }

  private buildSceneMeta(
    sceneId: string,
    scale: SceneScale,
    radiusM: number,
    placePackage: PlacePackage,
    place: NonNullable<StoredScene['place']>,
    bounds: GeoBounds,
    detail: SceneDetail,
    metaPatch: Pick<
      SceneMeta,
      'detailStatus' | 'visualCoverage' | 'materialClasses' | 'landmarkAnchors'
    >,
  ): SceneMeta {
    void detail;
    const buildings = placePackage.buildings.map((building) => ({
      ...resolveBuildingStyle(building),
      objectId: building.id,
      osmWayId: this.normalizeOsmId(building.id),
      name: building.name,
      heightMeters: building.heightMeters,
      outerRing: building.outerRing,
      holes: building.holes,
      footprint: building.footprint,
      usage: building.usage,
      facadeColor: building.facadeColor ?? null,
      facadeMaterial: building.facadeMaterial ?? null,
      roofColor: building.roofColor ?? null,
      roofMaterial: building.roofMaterial ?? null,
      roofShape: building.roofShape ?? null,
      buildingPart: building.buildingPart ?? null,
    }));
    const roads = placePackage.roads.map((road) => ({
      objectId: road.id,
      osmWayId: this.normalizeOsmId(road.id),
      name: road.name,
      laneCount: road.laneCount,
      roadClass: road.roadClass,
      widthMeters: road.widthMeters,
      direction: road.direction,
      path: road.path,
      center: this.resolveCenter(road.path),
      surface: road.surface ?? null,
      bridge: road.bridge ?? false,
    }));
    const walkways = placePackage.walkways.map((walkway) => ({
      objectId: walkway.id,
      osmWayId: this.normalizeOsmId(walkway.id),
      name: walkway.name,
      path: walkway.path,
      widthMeters: walkway.widthMeters,
      walkwayType: walkway.walkwayType,
      surface: walkway.surface ?? null,
    }));
    const landmarkIds = new Set(placePackage.landmarks.map((landmark) => landmark.id));
    const pois = placePackage.pois.map((poi) => ({
      objectId: poi.id,
      name: poi.name,
      type: poi.type,
      location: poi.location,
      category: poi.type.toLowerCase(),
      isLandmark: landmarkIds.has(poi.id),
    }));
    const camera = computeSceneCamera(place.location, bounds, {
      buildings,
      roads,
      walkways,
    });

    return {
      sceneId,
      placeId: place.placeId,
      name: place.displayName,
      generatedAt: placePackage.generatedAt,
      origin: place.location,
      camera,
      bounds: {
        radiusM,
        northEast: bounds.northEast,
        southWest: bounds.southWest,
      },
      stats: {
        buildingCount: buildings.length,
        roadCount: roads.length,
        walkwayCount: walkways.length,
        poiCount: pois.length,
      },
      diagnostics: placePackage.diagnostics ?? {
        droppedBuildings: 0,
        droppedRoads: 0,
        droppedWalkways: 0,
        droppedPois: 0,
        droppedCrossings: 0,
        droppedStreetFurniture: 0,
        droppedVegetation: 0,
        droppedLandCovers: 0,
        droppedLinearFeatures: 0,
      },
      detailStatus: metaPatch.detailStatus,
      visualCoverage: metaPatch.visualCoverage,
      materialClasses: metaPatch.materialClasses,
      landmarkAnchors: metaPatch.landmarkAnchors,
      assetProfile: {
        preset: scale,
        budget: {
          buildingCount: 0,
          roadCount: 0,
          walkwayCount: 0,
          poiCount: 0,
          crossingCount: 0,
          trafficLightCount: 0,
          streetLightCount: 0,
          signPoleCount: 0,
          treeClusterCount: 0,
          billboardPanelCount: 0,
        },
        selected: {
          buildingCount: 0,
          roadCount: 0,
          walkwayCount: 0,
          poiCount: 0,
          crossingCount: 0,
          trafficLightCount: 0,
          streetLightCount: 0,
          signPoleCount: 0,
          treeClusterCount: 0,
          billboardPanelCount: 0,
        },
      },
      roads,
      buildings,
      walkways,
      pois,
    };
  }

  private finalizeAssetProfile(
    meta: SceneMeta,
    detail: SceneDetail,
    scale: SceneScale,
  ): SceneMeta {
    const assetSelection = buildSceneAssetSelection(meta, detail, scale);
    return {
      ...meta,
      assetProfile: {
        preset: scale,
        budget: assetSelection.budget,
        selected: assetSelection.selected,
      },
    };
  }

  private buildSceneId(name: string, unique = false): string {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);

    const base = `scene-${slug || Date.now().toString(36)}`;
    if (!unique) {
      return base;
    }

    return `${base}-${Date.now().toString(36)}`;
  }

  private resolveRadius(scale: SceneScale): number {
    if (scale === 'SMALL') {
      return 300;
    }
    if (scale === 'LARGE') {
      return 1000;
    }
    return 600;
  }

  private normalizeOsmId(id: string): string {
    const [prefix, rawId] = id.split('-');
    if (!rawId) {
      return id;
    }
    return `${prefix}_${rawId}`;
  }

  private resolveCenter(path: Coordinate[]): Coordinate {
    const center = midpoint(path);
    if (!center || !isFiniteCoordinate(center)) {
      return { lat: 0, lng: 0 };
    }

    return center;
  }

  private async isReusableScene(storedScene: StoredScene): Promise<boolean> {
    if (storedScene.scene.status !== 'READY' || !storedScene.scene.assetUrl) {
      return false;
    }

    if (
      !storedScene.place ||
      !storedScene.meta ||
      !storedScene.detail ||
      !isFiniteCoordinate(storedScene.place.location) ||
      !isFiniteCoordinate(storedScene.meta.origin)
    ) {
      return false;
    }

    try {
      await access(join(getSceneDataDir(), `${storedScene.scene.sceneId}.glb`));
      await access(
        join(getSceneDataDir(), `${storedScene.scene.sceneId}.detail.json`),
      );
      return true;
    } catch {
      return false;
    }
  }
}
