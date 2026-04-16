import { AppException } from '../../../common/errors/app.exception';
import { ERROR_CODES } from '../../../common/constants/error-codes';
import { SceneReadService } from './scene-read.service';
import type { StoredScene } from '../../types/scene.types';

function createStoredScene(overrides: Partial<StoredScene> = {}): StoredScene {
  return {
    requestKey: 'seoul-city-hall::MEDIUM',
    query: 'Seoul City Hall',
    scale: 'MEDIUM',
    attempts: 1,
    generationSource: 'api',
    requestId: 'req_test',
    scene: {
      sceneId: 'scene-seoul-city-hall',
      placeId: 'google-place-id',
      name: 'Seoul City Hall',
      centerLat: 37.5665,
      centerLng: 126.978,
      radiusM: 600,
      status: 'READY',
      metaUrl: '/api/scenes/scene-seoul-city-hall/meta',
      assetUrl: '/api/scenes/scene-seoul-city-hall/assets/base.glb',
      createdAt: '2026-04-04T00:00:00.000Z',
      updatedAt: '2026-04-04T00:00:00.000Z',
      failureReason: null,
      failureCategory: null,
      qualityGate: null,
    },
    place: {
      provider: 'GOOGLE_PLACES',
      placeId: 'google-place-id',
      displayName: 'Seoul City Hall',
      formattedAddress: 'Seoul',
      location: { lat: 37.5665, lng: 126.978 },
      primaryType: 'city_hall',
      types: ['city_hall'],
      googleMapsUri: null,
      viewport: null,
      utcOffsetMinutes: 540,
    },
    meta: {
      sceneId: 'scene-seoul-city-hall',
      placeId: 'google-place-id',
      name: 'Seoul City Hall',
      generatedAt: '2026-04-04T00:00:00.000Z',
      origin: { lat: 37.5665, lng: 126.978 },
      camera: {
        topView: { x: 0, y: 180, z: 140 },
        walkViewStart: { x: 0, y: 1.7, z: 12 },
      },
      bounds: {
        radiusM: 600,
        northEast: { lat: 37.567, lng: 126.979 },
        southWest: { lat: 37.566, lng: 126.977 },
      },
      stats: {
        buildingCount: 1,
        roadCount: 1,
        walkwayCount: 0,
        poiCount: 0,
      },
      diagnostics: {
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
      detailStatus: 'FULL',
      visualCoverage: {
        structure: 1,
        streetDetail: 0.3,
        landmark: 0.2,
        signage: 0.1,
      },
      materialClasses: [],
      landmarkAnchors: [],
      assetProfile: {
        preset: 'MEDIUM',
        budget: {
          buildingCount: 1,
          roadCount: 1,
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
          buildingCount: 1,
          roadCount: 1,
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
      structuralCoverage: {
        buildingCoverage: 1,
        roadCoverage: 1,
        walkwayCoverage: 0,
        poiCoverage: 0,
      },
      roads: [
        {
          objectId: 'road-1',
          osmWayId: '1',
          name: 'Main Road',
          laneCount: 4,
          roadClass: 'primary',
          widthMeters: 14,
          direction: 'TWO_WAY',
          center: { lat: 37.5665, lng: 126.978 },
          path: [{ lat: 37.566, lng: 126.977 }, { lat: 37.567, lng: 126.979 }],
          surface: 'asphalt',
          bridge: false,
        },
      ],
      buildings: [],
      walkways: [],
      pois: [],
    } as any,
    detail: {
      sceneId: 'scene-seoul-city-hall',
      placeId: 'google-place-id',
      generatedAt: '2026-04-04T00:00:00.000Z',
      detailStatus: 'FULL',
      crossings: [],
      roadMarkings: [],
      streetFurniture: [],
      vegetation: [],
      landCovers: [],
      linearFeatures: [],
      facadeHints: [],
      signageClusters: [],
      annotationsApplied: [],
      provenance: {
        mapillaryUsed: false,
        mapillaryImageCount: 0,
        mapillaryFeatureCount: 0,
        mapillaryImageStrategy: 'none',
        mapillaryImageAttempts: [],
        osmTagCoverage: {
          coloredBuildings: 0,
          materialBuildings: 0,
          crossings: 0,
          streetFurniture: 0,
          vegetation: 0,
        },
        overrideCount: 0,
      },
      placeReadabilityDiagnostics: {
        heroBuildingCount: 0,
        heroIntersectionCount: 0,
        scrambleStripeCount: 0,
        billboardPlaneCount: 0,
        canopyCount: 0,
        roofUnitCount: 0,
        emissiveZoneCount: 0,
        streetFurnitureRowCount: 0,
      },
    } as any,
    twin: {
      sceneId: 'scene-seoul-city-hall',
      sourceSnapshots: {
        snapshots: [],
      },
    } as any,
    validation: {
      qualityGate: {
        meshSummary: {
          emptyOrInvalidGeometryCount: 0,
          totalSkipped: 0,
          criticalEmptyOrInvalidGeometryCount: 0,
          criticalPolygonBudgetExceededCount: 0,
          missingSourceCount: 0,
        },
      },
    } as any,
    qa: {
      sceneId: 'scene-seoul-city-hall',
    } as any,
    ...overrides,
  };
}

describe('SceneReadService', () => {
  it('returns scene, bootstrap, and place summaries for ready scenes', async () => {
    const storedScene = createStoredScene();
    const sceneRepository = {
      findById: jest.fn().mockResolvedValue(storedScene),
    } as any;

    const service = new SceneReadService(sceneRepository);

    await expect(service.getScene('scene-seoul-city-hall')).resolves.toEqual(
      storedScene.scene,
    );
    await expect(service.getSceneMeta('scene-seoul-city-hall')).resolves.toEqual(
      storedScene.meta,
    );
    await expect(
      service.getSceneDetail('scene-seoul-city-hall'),
    ).resolves.toEqual(storedScene.detail);

    const bootstrap = await service.getBootstrap('scene-seoul-city-hall');
    expect(bootstrap.sceneId).toBe('scene-seoul-city-hall');
    expect(bootstrap.assetUrl).toBe(
      '/api/scenes/scene-seoul-city-hall/assets/base.glb',
    );
    expect(bootstrap.liveEndpoints.weather).toBe(
      '/api/scenes/scene-seoul-city-hall/weather',
    );

    const places = await service.getPlaces('scene-seoul-city-hall');
    expect(places.pois).toEqual([]);
    expect(places.landmarks).toEqual([]);
    expect(places.categories).toEqual([]);
  });

  it('sorts place categories and exposes landmarks', async () => {
    const storedScene = createStoredScene({
      meta: {
        ...(createStoredScene().meta as any),
        pois: [
          {
            objectId: 'poi-1',
            placeId: 'poi-1',
            location: { lat: 37.5665, lng: 126.978 },
            name: 'Alpha',
            type: 'LANDMARK',
            category: 'landmark',
            isLandmark: true,
          },
          {
            objectId: 'poi-2',
            placeId: 'poi-2',
            location: { lat: 37.5666, lng: 126.9781 },
            name: 'Beta',
            type: 'CAFE',
            category: 'food',
            isLandmark: false,
          },
          {
            objectId: 'poi-3',
            placeId: 'poi-3',
            location: { lat: 37.5667, lng: 126.9782 },
            name: 'Gamma',
            type: 'CAFE',
            category: 'food',
            isLandmark: false,
          },
        ],
      } as any,
    });
    const sceneRepository = {
      findById: jest.fn().mockResolvedValue(storedScene),
    } as any;
    const service = new SceneReadService(sceneRepository);

    const places = await service.getPlaces('scene-seoul-city-hall');
    expect(places.landmarks).toHaveLength(1);
    expect(places.categories).toEqual([
      { category: 'food', count: 2, landmarkCount: 0 },
      { category: 'landmark', count: 1, landmarkCount: 1 },
    ]);
  });

  it('rejects when a scene is not ready', async () => {
    const sceneRepository = {
      findById: jest.fn().mockResolvedValue(
        createStoredScene({
          scene: {
            ...createStoredScene().scene,
            status: 'PENDING',
          },
          meta: undefined,
          detail: undefined,
          place: undefined,
        }),
      ),
    } as any;
    const service = new SceneReadService(sceneRepository);

    await expect(service.getReadyScene('scene-seoul-city-hall')).rejects.toMatchObject({
      code: ERROR_CODES.SCENE_NOT_READY,
    } as Partial<AppException>);
  });
});
