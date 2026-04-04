import { HttpStatus, Injectable } from '@nestjs/common';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { GlbBuilderService } from '../assets/glb-builder.service';
import { TtlCacheService } from '../cache/ttl-cache.service';
import { ERROR_CODES } from '../common/constants/error-codes';
import { AppException } from '../common/errors/app.exception';
import { GooglePlacesClient } from '../places/google-places.client';
import { midpoint, isFiniteCoordinate } from '../places/geo.utils';
import { OpenMeteoClient } from '../places/open-meteo.client';
import { OverpassClient } from '../places/overpass.client';
import {
  Coordinate,
  GeoBounds,
  PlacePackage,
} from '../places/place.types';
import { TomTomTrafficClient } from '../places/tomtom-traffic.client';
import { SceneRepository } from './scene.repository';
import { buildSceneAssetSelection } from './scene-asset-profile.utils';
import { resolveBuildingStyle } from './scene-building-style.utils';
import { computeSceneCamera, resolveSceneBounds } from './scene-geometry.utils';
import { SceneHeroOverrideService } from './scene-hero-override.service';
import { getSceneDataDir } from './scene-storage.utils';
import { SceneVisionService } from './scene-vision.service';
import {
  BootstrapResponse,
  SceneDetail,
  SceneEntity,
  SceneMeta,
  ScenePlacesResponse,
  SceneScale,
  SceneTrafficResponse,
  SceneWeatherQuery,
  SceneWeatherResponse,
  StoredScene,
  TrafficSegment,
} from './scene.types';

@Injectable()
export class SceneService {
  private readonly trafficTtlMs = 2 * 60 * 1000;
  private readonly weatherTtlMs = 10 * 60 * 1000;
  private readonly maxGenerationAttempts = 2;
  private readonly generationQueue: string[] = [];
  private isProcessingQueue = false;

  constructor(
    private readonly sceneRepository: SceneRepository,
    private readonly ttlCacheService: TtlCacheService,
    private readonly glbBuilderService: GlbBuilderService,
    private readonly googlePlacesClient: GooglePlacesClient,
    private readonly overpassClient: OverpassClient,
    private readonly openMeteoClient: OpenMeteoClient,
    private readonly tomTomTrafficClient: TomTomTrafficClient,
    private readonly sceneVisionService: SceneVisionService,
    private readonly sceneHeroOverrideService: SceneHeroOverrideService,
  ) {}

  async createScene(query: string, scale: SceneScale): Promise<SceneEntity> {
    const requestKey = this.buildRequestKey(query, scale);
    const existing = await this.sceneRepository.findByRequestKey(requestKey);
    if (
      existing &&
      existing.scene.status !== 'FAILED' &&
      (await this.isReusableScene(existing))
    ) {
      return existing.scene;
    }

    const sceneId = this.buildSceneId(query);
    const createdAt = new Date().toISOString();
    const metaUrl = `/api/scenes/${sceneId}/meta`;
    const scene: SceneEntity = {
      sceneId,
      placeId: null,
      name: query,
      centerLat: 0,
      centerLng: 0,
      radiusM: this.resolveRadius(scale),
      status: 'PENDING',
      metaUrl,
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
        attempts: 0,
        scene,
      },
      requestKey,
    );
    this.enqueueGeneration(sceneId);

    return scene;
  }

  async getScene(sceneId: string): Promise<SceneEntity> {
    return (await this.getStoredScene(sceneId)).scene;
  }

  async getSceneMeta(sceneId: string): Promise<SceneMeta> {
    return (await this.getReadyScene(sceneId)).meta;
  }

  async getSceneDetail(sceneId: string): Promise<SceneDetail> {
    return (await this.getReadyScene(sceneId)).detail;
  }

  async getBootstrap(sceneId: string): Promise<BootstrapResponse> {
    const stored = await this.getReadyScene(sceneId);
    const scene = stored.scene;

    return {
      sceneId: scene.sceneId,
      assetUrl: scene.assetUrl ?? `/api/scenes/${scene.sceneId}/assets/base.glb`,
      metaUrl: scene.metaUrl,
      detailUrl: `/api/scenes/${scene.sceneId}/detail`,
      detailStatus: stored.detail.detailStatus,
      assetProfile: stored.meta.assetProfile,
      liveEndpoints: {
        traffic: `/api/scenes/${scene.sceneId}/traffic`,
        weather: `/api/scenes/${scene.sceneId}/weather`,
        places: `/api/scenes/${scene.sceneId}/places`,
      },
    };
  }

  async getPlaces(sceneId: string): Promise<ScenePlacesResponse> {
    const storedScene = await this.getReadyScene(sceneId);
    return {
      pois: storedScene.meta.pois,
    };
  }

  async getWeather(
    sceneId: string,
    query: SceneWeatherQuery,
  ): Promise<SceneWeatherResponse> {
    return this.ttlCacheService.getOrSet(
      this.buildWeatherCacheKey(sceneId, query),
      this.weatherTtlMs,
      async () => {
        const storedScene = await this.getReadyScene(sceneId);
        const observation = await this.openMeteoClient.getHistoricalObservation(
          storedScene.place,
          query.date,
          query.timeOfDay,
        );

        return {
          updatedAt: new Date().toISOString(),
          weatherCode: this.resolveWeatherCode(observation?.resolvedWeather),
          temperature: observation?.temperatureCelsius ?? null,
          preset: observation?.resolvedWeather.toLowerCase() ?? 'clear',
          source: 'OPEN_METEO_HISTORICAL',
          observedAt: observation?.localTime ?? null,
        };
      },
    );
  }

  async getTraffic(sceneId: string): Promise<SceneTrafficResponse> {
    return this.ttlCacheService.getOrSet(
      this.buildTrafficCacheKey(sceneId),
      this.trafficTtlMs,
      async () => {
        const storedScene = await this.getReadyScene(sceneId);
        const segments = await Promise.all(
          storedScene.meta.roads.map(async (road) => {
            const segment = await this.tomTomTrafficClient.getFlowSegment(
              road.center,
            );
            return this.mapTrafficSegment(road.objectId, segment?.flowSegmentData);
          }),
        );

        return {
          updatedAt: new Date().toISOString(),
          segments,
        };
      },
    );
  }

  async waitForIdle(): Promise<void> {
    while (this.isProcessingQueue || this.generationQueue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
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

  private async getReadyScene(
    sceneId: string,
  ): Promise<
    StoredScene & {
      meta: SceneMeta;
      detail: SceneDetail;
      place: NonNullable<StoredScene['place']>;
    }
  > {
    const storedScene = await this.getStoredScene(sceneId);
    if (
      storedScene.scene.status !== 'READY' ||
      storedScene.meta === undefined ||
      storedScene.detail === undefined ||
      storedScene.place === undefined
    ) {
      throw new AppException({
        code: ERROR_CODES.SCENE_NOT_READY,
        message: 'Scene 생성이 아직 완료되지 않았습니다.',
        detail: {
          sceneId,
          status: storedScene.scene.status,
        },
        status: HttpStatus.CONFLICT,
      });
    }

    return storedScene as StoredScene & {
      meta: SceneMeta;
      detail: SceneDetail;
      place: NonNullable<StoredScene['place']>;
    };
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
    try {
      const candidates = await this.googlePlacesClient.searchText(
        storedScene.query,
        1,
      );
      const selected = candidates[0];
      if (!selected) {
        throw new AppException({
          code: ERROR_CODES.GOOGLE_PLACE_NOT_FOUND,
          message: '검색 결과에 해당하는 장소를 찾을 수 없습니다.',
          detail: { query: storedScene.query },
          status: HttpStatus.NOT_FOUND,
        });
      }

      const place = await this.googlePlacesClient.getPlaceDetail(selected.placeId);
      const radiusM = this.resolveRadius(storedScene.scale);
      const bounds = resolveSceneBounds(place.location, radiusM);
      const placePackage = await this.overpassClient.buildPlacePackage(place, {
        bounds,
      });
      const vision = await this.sceneVisionService.buildSceneVision(
        sceneId,
        place,
        bounds,
        placePackage,
      );
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
      const finalizedMeta = this.finalizeAssetProfile(
        merged.meta,
        merged.detail,
        storedScene.scale,
      );
      const assetPath = await this.glbBuilderService.build(
        finalizedMeta,
        merged.detail,
      );

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
    } catch (error) {
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
  }

  private buildWeatherCacheKey(
    sceneId: string,
    query: SceneWeatherQuery,
  ): string {
    return `scene-weather:${sceneId}:${query.date}:${query.timeOfDay}`;
  }

  private buildTrafficCacheKey(sceneId: string): string {
    return `scene-traffic:${sceneId}`;
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
    const pois = placePackage.pois.map((poi) => ({
      objectId: poi.id,
      name: poi.name,
      type: poi.type,
      location: poi.location,
      category: poi.type.toLowerCase(),
      isLandmark: placePackage.landmarks.some((landmark) => landmark.id === poi.id),
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

  private buildSceneId(name: string): string {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);

    return `scene-${slug || Date.now().toString(36)}`;
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

  private mapTrafficSegment(
    objectId: string,
    flowSegmentData?: {
      currentSpeed?: number;
      freeFlowSpeed?: number;
      confidence?: number;
      roadClosure?: boolean;
    },
  ): TrafficSegment {
    const currentSpeed = flowSegmentData?.currentSpeed ?? 0;
    const freeFlowSpeed = flowSegmentData?.freeFlowSpeed ?? 0;
    const congestionScore =
      freeFlowSpeed > 0 ? 1 - currentSpeed / freeFlowSpeed : 0;

    return {
      objectId,
      currentSpeed,
      freeFlowSpeed,
      congestionScore: Number(congestionScore.toFixed(2)),
      status: this.resolveTrafficStatus(congestionScore),
      confidence: flowSegmentData?.confidence ?? null,
      roadClosure: flowSegmentData?.roadClosure ?? false,
    };
  }

  private resolveTrafficStatus(
    congestionScore: number,
  ): 'free' | 'moderate' | 'slow' | 'jammed' {
    if (congestionScore >= 0.8) {
      return 'jammed';
    }
    if (congestionScore >= 0.5) {
      return 'slow';
    }
    if (congestionScore >= 0.2) {
      return 'moderate';
    }
    return 'free';
  }

  private resolveWeatherCode(weather: string | undefined): number | null {
    if (weather === 'CLOUDY') {
      return 3;
    }
    if (weather === 'RAIN') {
      return 61;
    }
    if (weather === 'SNOW') {
      return 71;
    }
    if (weather === 'CLEAR') {
      return 0;
    }
    return null;
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
      await access(join(getSceneDataDir(), `${storedScene.scene.sceneId}.detail.json`));
      return true;
    } catch {
      return false;
    }
  }
}
