jest.mock('node:fs/promises', () => ({
  access: jest.fn().mockResolvedValue(undefined),
  open: jest.fn().mockResolvedValue({
    writeFile: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  }),
  mkdir: jest.fn().mockResolvedValue(undefined),
  rename: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  stat: jest.fn().mockRejectedValue(new Error('not found')),
  rm: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

import { SceneGenerationService } from './scene-generation.service';

function createLoggerStub() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fromRequest: jest.fn(),
  } as any;
}

function createRepositoryMock() {
  const scenes = new Map<string, any>();
  const requestIndex = new Map<string, string>();

  return {
    scenes,
    findByRequestKey: jest.fn(async (requestKey: string) => {
      const sceneId = requestIndex.get(requestKey);
      return sceneId ? scenes.get(sceneId) : undefined;
    }),
    save: jest.fn(async (scene: any, requestKey?: string) => {
      scenes.set(scene.scene.sceneId, scene);
      if (requestKey) {
        requestIndex.set(requestKey, scene.scene.sceneId);
      }
      return scene;
    }),
    update: jest.fn(async (sceneId: string, updater: (scene: any) => any) => {
      const current = scenes.get(sceneId);
      if (!current) {
        return undefined;
      }
      const updated = updater(current);
      scenes.set(sceneId, updated);
      return updated;
    }),
    findById: jest.fn(async (sceneId: string) => scenes.get(sceneId)),
  };
}

function createReadyScene() {
  return {
    requestKey: 'seoul-city-hall::MEDIUM',
    query: 'Seoul City Hall',
    scale: 'MEDIUM',
    attempts: 0,
    generationSource: 'api',
    requestId: 'req-1',
    scene: {
      sceneId: 'scene-seoul-city-hall',
      placeId: null,
      name: 'Seoul City Hall',
      centerLat: 0,
      centerLng: 0,
      radiusM: 600,
      status: 'PENDING',
      metaUrl: '/api/scenes/scene-seoul-city-hall/meta',
      assetUrl: null,
      createdAt: '2026-04-04T00:00:00.000Z',
      updatedAt: '2026-04-04T00:00:00.000Z',
      failureReason: null,
    },
  };
}

describe('SceneGenerationService', () => {
  it('processes a queued scene and reuses the ready result', async () => {
    const repo = createRepositoryMock();
    const logger = createLoggerStub();
    const pipelineResult = {
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
      placePackage: {
        placeId: 'google-place-id',
        version: '2026.04-external',
        generatedAt: '2026-04-04T00:00:00.000Z',
        camera: {
          topView: { x: 0, y: 180, z: 140 },
          walkViewStart: { x: 0, y: 1.7, z: 12 },
        },
        bounds: {
          northEast: { lat: 37.567, lng: 126.979 },
          southWest: { lat: 37.566, lng: 126.977 },
        },
        buildings: [],
        roads: [
          {
            id: 'road-1',
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
        walkways: [],
        pois: [],
        landmarks: [],
        crossings: [],
        streetFurniture: [],
        vegetation: [],
        landCovers: [],
        linearFeatures: [],
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
          buildingCount: 0,
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
            buildingCount: 0,
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
            buildingCount: 0,
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
      },
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
      },
      assetPath: '/tmp/scene-seoul-city-hall.glb',
      providerTraces: {
        googlePlaces: {
          provider: 'GOOGLE_PLACES',
          observedAt: '2026-04-04T00:00:00.000Z',
          requests: [],
          responseSummary: { status: 'SUCCESS', itemCount: 1, objectId: 'google-place-id' },
          upstreamEnvelopes: [],
        },
        overpass: {
          provider: 'OVERPASS',
          observedAt: '2026-04-04T00:00:00.000Z',
          requests: [],
          responseSummary: { status: 'SUCCESS', itemCount: 0, objectId: 'google-place-id' },
          upstreamEnvelopes: [],
        },
        mapillary: null,
      },
    } as any;

    const qualityGate = {
      version: 'qg.v1',
      state: 'PASS',
      reasonCodes: [],
      scores: {
        overall: 0.91,
        breakdown: {
          structure: 0.92,
          atmosphere: 0.88,
          placeReadability: 0.9,
        },
        modeDeltaOverallScore: 0.1,
      },
      thresholds: {} as any,
      meshSummary: {
        emptyOrInvalidGeometryCount: 0,
        totalSkipped: 0,
        criticalEmptyOrInvalidGeometryCount: 0,
        criticalPolygonBudgetExceededCount: 0,
        missingSourceCount: 0,
      },
      artifactRefs: {
        diagnosticsLogPath: '/tmp/scene-seoul-city-hall.diagnostics.log',
        modeComparisonPath: '/tmp/scene-seoul-city-hall.mode-comparison.json',
      },
      oracleApproval: {
        required: false,
        state: 'APPROVED',
      },
      decidedAt: '2026-04-04T00:00:00.000Z',
    } as any;

    const weatherObserved = {
      observation: {
        date: '2026-04-04',
        localTime: '2026-04-04T12:00',
        temperatureCelsius: 16,
        precipitationMm: 0,
        rainMm: 0,
        snowfallCm: 0,
        cloudCoverPercent: 10,
        resolvedWeather: 'CLEAR',
        source: 'OPEN_METEO_HISTORICAL',
      },
      upstreamEnvelopes: [],
    } as any;

    const trafficObserved = {
      segments: [
        {
          objectId: 'road-1',
          currentSpeed: 30,
          freeFlowSpeed: 40,
          congestionScore: 0.25,
          status: 'moderate',
          confidence: 0.9,
          roadClosure: false,
        },
      ],
      failedSegmentCount: 0,
      upstreamEnvelopes: [],
    } as any;

    const twinBuildResult = {
      twin: {
        sceneId: 'scene-seoul-city-hall',
        sourceSnapshots: { snapshots: [] },
      },
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
      },
    } as any;

    const sceneGenerationPipelineService = {
      execute: jest.fn().mockResolvedValue(pipelineResult),
    } as any;
    const sceneQualityGateService = {
      evaluate: jest.fn().mockResolvedValue(qualityGate),
    } as any;
    const sceneMidQaService = {
      buildReport: jest.fn().mockResolvedValue({ sceneId: 'scene-seoul-city-hall' }),
    } as any;
    const sceneTwinBuilderService = {
      build: jest.fn().mockReturnValue(twinBuildResult),
    } as any;
    const sceneWeatherLiveService = {
      sampleWeatherByPlace: jest.fn().mockResolvedValue(weatherObserved),
    } as any;
    const sceneTrafficLiveService = {
      sampleTrafficByRoads: jest.fn().mockResolvedValue(trafficObserved),
    } as any;

    const service = new SceneGenerationService(
      repo as any,
      sceneGenerationPipelineService,
      sceneQualityGateService,
      sceneMidQaService,
      sceneTwinBuilderService,
      sceneWeatherLiveService,
      sceneTrafficLiveService,
      logger as any,
    );

    const scene = await service.createScene('Seoul City Hall', 'MEDIUM');
    expect(scene.status).toBe('PENDING');

    await service.waitForIdle();

    const storedScene = await repo.findById('scene-seoul-city-hall');
    expect(storedScene.scene.status).toBe('READY');
    expect(storedScene.scene.assetUrl).toBe(
      '/api/scenes/scene-seoul-city-hall/assets/base.glb',
    );
    expect(sceneGenerationPipelineService.execute).toHaveBeenCalledTimes(1);

    const reusedScene = await service.createScene('Seoul City Hall', 'MEDIUM');
    expect(reusedScene.sceneId).toBe('scene-seoul-city-hall');
    expect(sceneGenerationPipelineService.execute).toHaveBeenCalledTimes(1);
  });

  it('retries once and then records a failure when generation keeps failing', async () => {
    const repo = createRepositoryMock();
    const logger = createLoggerStub();
    const sceneGenerationPipelineService = {
      execute: jest.fn().mockRejectedValue(new Error('pipeline exploded')),
    } as any;
    const sceneQualityGateService = {
      evaluate: jest.fn(),
    } as any;
    const sceneMidQaService = {
      buildReport: jest.fn(),
    } as any;
    const sceneTwinBuilderService = {
      build: jest.fn(),
    } as any;
    const sceneWeatherLiveService = {
      sampleWeatherByPlace: jest.fn(),
    } as any;
    const sceneTrafficLiveService = {
      sampleTrafficByRoads: jest.fn(),
    } as any;

    const service = new SceneGenerationService(
      repo as any,
      sceneGenerationPipelineService,
      sceneQualityGateService,
      sceneMidQaService,
      sceneTwinBuilderService,
      sceneWeatherLiveService,
      sceneTrafficLiveService,
      logger as any,
    );

    await service.createScene('Seoul City Hall', 'MEDIUM');
    await service.waitForIdle();

    const storedScene = await repo.findById('scene-seoul-city-hall');
    expect(storedScene.scene.status).toBe('FAILED');
    expect(storedScene.attempts).toBe(2);
    expect(service.getRecentFailures()).toHaveLength(1);
    expect(sceneGenerationPipelineService.execute).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalled();
  });
});
