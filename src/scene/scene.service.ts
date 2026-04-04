import { HttpStatus, Injectable } from '@nestjs/common';
import { TtlCacheService } from '../cache/ttl-cache.service';
import { ERROR_CODES } from '../common/constants/error-codes';
import { AppException } from '../common/errors/app.exception';
import { OpenMeteoClient } from '../places/open-meteo.client';
import { OverpassClient } from '../places/overpass.client';
import { GooglePlacesClient } from '../places/google-places.client';
import { TomTomTrafficClient } from '../places/tomtom-traffic.client';
import {
  Coordinate,
  PlacePackage,
  TimeOfDay,
} from '../places/place.types';
import { SceneRepository } from './scene.repository';
import {
  BootstrapResponse,
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

  constructor(
    private readonly sceneRepository: SceneRepository,
    private readonly ttlCacheService: TtlCacheService,
    private readonly googlePlacesClient: GooglePlacesClient,
    private readonly overpassClient: OverpassClient,
    private readonly openMeteoClient: OpenMeteoClient,
    private readonly tomTomTrafficClient: TomTomTrafficClient,
  ) {}

  async createScene(query: string, scale: SceneScale): Promise<SceneEntity> {
    const requestKey = this.buildRequestKey(query, scale);
    const existing = await this.sceneRepository.findByRequestKey(requestKey);
    if (existing) {
      return existing.scene;
    }

    const candidates = await this.googlePlacesClient.searchText(query, 1);
    const selected = candidates[0];
    if (!selected) {
      throw new AppException({
        code: ERROR_CODES.GOOGLE_PLACE_NOT_FOUND,
        message: '검색 결과에 해당하는 장소를 찾을 수 없습니다.',
        detail: {
          query,
        },
        status: HttpStatus.NOT_FOUND,
      });
    }

    const place = await this.googlePlacesClient.getPlaceDetail(selected.placeId);
    const placePackage = await this.overpassClient.buildPlacePackage(place);
    const radiusM = this.resolveRadius(scale);
    const sceneId = this.buildSceneId(place.displayName);
    const createdAt = new Date().toISOString();
    const metaUrl = `/api/scenes/${sceneId}/meta`;
    const meta = this.buildSceneMeta(sceneId, radiusM, placePackage, place);
    const scene: SceneEntity = {
      sceneId,
      placeId: place.placeId,
      name: place.displayName,
      centerLat: place.location.lat,
      centerLng: place.location.lng,
      radiusM,
      status: 'READY',
      metaUrl,
      createdAt,
      updatedAt: createdAt,
    };

    await this.sceneRepository.save(
      {
        scene,
        meta,
        place,
      },
      requestKey,
    );

    return scene;
  }

  async getScene(sceneId: string): Promise<SceneEntity> {
    return (await this.getStoredScene(sceneId)).scene;
  }

  async getSceneMeta(sceneId: string): Promise<SceneMeta> {
    return (await this.getStoredScene(sceneId)).meta;
  }

  async getBootstrap(sceneId: string): Promise<BootstrapResponse> {
    const scene = await this.getScene(sceneId);

    return {
      sceneId: scene.sceneId,
      metaUrl: scene.metaUrl,
      liveEndpoints: {
        traffic: `/api/scenes/${scene.sceneId}/traffic`,
        weather: `/api/scenes/${scene.sceneId}/weather`,
        places: `/api/scenes/${scene.sceneId}/places`,
      },
    };
  }

  async getPlaces(sceneId: string): Promise<ScenePlacesResponse> {
    const storedScene = await this.getStoredScene(sceneId);

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
        const storedScene = await this.getStoredScene(sceneId);
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
        const storedScene = await this.getStoredScene(sceneId);
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

  private async getStoredScene(sceneId: string): Promise<StoredScene> {
    const storedScene = await this.sceneRepository.findById(sceneId);
    if (!storedScene) {
      throw new AppException({
        code: ERROR_CODES.SCENE_NOT_FOUND,
        message: 'Scene을 찾을 수 없습니다.',
        detail: {
          sceneId,
        },
        status: HttpStatus.NOT_FOUND,
      });
    }

    return storedScene;
  }

  private buildRequestKey(query: string, scale: SceneScale): string {
    return `${query.trim().toLowerCase()}::${scale}`;
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
    radiusM: number,
    placePackage: PlacePackage,
    place: StoredScene['place'],
  ): SceneMeta {
    return {
      sceneId,
      placeId: place.placeId,
      name: place.displayName,
      generatedAt: placePackage.generatedAt,
      origin: place.location,
      camera: placePackage.camera,
      bounds: {
        radiusM,
        northEast: placePackage.bounds.northEast,
        southWest: placePackage.bounds.southWest,
      },
      stats: {
        buildingCount: placePackage.buildings.length,
        roadCount: placePackage.roads.length,
        walkwayCount: placePackage.walkways.length,
        poiCount: placePackage.pois.length,
      },
      roads: placePackage.roads.map((road) => ({
        objectId: road.id,
        osmWayId: this.normalizeOsmId(road.id),
        name: road.name,
        laneCount: road.laneCount,
        direction: road.direction,
        path: road.path,
        center: this.resolveCenter(road.path),
      })),
      buildings: placePackage.buildings.map((building) => ({
        objectId: building.id,
        osmWayId: this.normalizeOsmId(building.id),
        name: building.name,
        heightMeters: building.heightMeters,
        footprint: building.footprint,
        usage: building.usage,
      })),
      walkways: placePackage.walkways.map((walkway) => ({
        objectId: walkway.id,
        osmWayId: this.normalizeOsmId(walkway.id),
        name: walkway.name,
        path: walkway.path,
        widthMeters: walkway.widthMeters,
      })),
      pois: placePackage.pois.map((poi) => ({
        objectId: poi.id,
        name: poi.name,
        type: poi.type,
        location: poi.location,
        category: poi.type.toLowerCase(),
        isLandmark: placePackage.landmarks.some(
          (landmark) => landmark.id === poi.id,
        ),
      })),
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
    const [, rawId] = id.split('-');
    return rawId ? `way_${rawId}` : id;
  }

  private resolveCenter(path: Coordinate[]): Coordinate {
    if (path.length === 0) {
      return { lat: 0, lng: 0 };
    }

    const midpoint = path[Math.floor(path.length / 2)];
    return midpoint ?? path[0];
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
}
