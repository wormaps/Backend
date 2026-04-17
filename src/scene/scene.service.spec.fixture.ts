import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'bun:test';
import { TtlCacheService } from '../cache/ttl-cache.service';
import { GlbBuilderService } from '../assets/glb-builder.service';
import { AppLoggerService } from '../common/logging/app-logger.service';
import { GooglePlacesClient } from '../places/clients/google-places.client';
import { MapillaryClient } from '../places/clients/mapillary.client';
import { OpenMeteoClient } from '../places/clients/open-meteo.client';
import { OverpassClient } from '../places/clients/overpass.client';
import { TomTomTrafficClient } from '../places/clients/tomtom-traffic.client';
import { SnapshotBuilderService } from '../places/snapshot/snapshot-builder.service';
import { ExternalPlaceDetail } from '../places/types/external-place.types';
import { PlacePackage } from '../places/types/place.types';
import { SceneGenerationPipelineService } from './pipeline/scene-generation-pipeline.service';
import { SceneAssetProfileStep } from './pipeline/steps/scene-asset-profile.step';
import { SceneFidelityPlanStep } from './pipeline/steps/scene-fidelity-plan.step';
import { SceneGlbBuildStep } from './pipeline/steps/scene-glb-build.step';
import { SceneGeometryCorrectionStep } from './pipeline/steps/scene-geometry-correction.step';
import { SceneHeroOverrideStep } from './pipeline/steps/scene-hero-override.step';
import { SceneMetaBuilderStep } from './pipeline/steps/scene-meta-builder.step';
import { ScenePlacePackageStep } from './pipeline/steps/scene-place-package.step';
import { ScenePlaceResolutionStep } from './pipeline/steps/scene-place-resolution.step';
import { SceneVisualRulesStep } from './pipeline/steps/scene-visual-rules.step';
import { SceneService } from './scene.service';
import {
  BuildingStyleResolverService,
  CuratedAssetResolverService,
  SceneAssetProfileService,
  SceneAtmosphereRecomputeService,
  SceneFacadeVisionService,
  SceneFidelityPlannerService,
  SceneGenerationService,
  SceneGeometryDiagnosticsService,
  SceneMidQaService,
  SceneQualityGateService,
  SceneHeroOverrideService,
  SceneLiveDataService,
  SceneReadService,
  SceneStateLiveService,
  SceneTerrainProfileService,
  SceneRoadVisionService,
  SceneTrafficLiveService,
  SceneTwinBuilderService,
  SceneWeatherLiveService,
  SceneSignageVisionService,
  SceneVisionService,
} from './services';
import { SceneFacadeAtmosphereService } from './services/vision/scene-facade-atmosphere.service';
import { SceneRepository } from './storage/scene.repository';

type MockedFunction<T extends (...args: any[]) => any> = ReturnType<typeof vi.fn>;

export const placeDetail: ExternalPlaceDetail = {
  provider: 'GOOGLE_PLACES',
  placeId: 'google-place-id',
  displayName: 'Seoul City Hall',
  formattedAddress: '110 Sejong-daero, Jung-gu, Seoul',
  location: { lat: 37.5665, lng: 126.978 },
  primaryType: 'city_hall',
  types: ['city_hall', 'point_of_interest'],
  googleMapsUri: 'https://maps.google.com',
  viewport: {
    northEast: { lat: 37.567, lng: 126.979 },
    southWest: { lat: 37.566, lng: 126.977 },
  },
  utcOffsetMinutes: 540,
};

export const placePackage: PlacePackage = {
  placeId: 'google-place-id',
  version: '2026.04-external',
  generatedAt: '2026-04-04T00:00:00Z',
  camera: {
    topView: { x: 0, y: 180, z: 140 },
    walkViewStart: { x: 0, y: 1.7, z: 12 },
  },
  bounds: {
    northEast: { lat: 37.567, lng: 126.979 },
    southWest: { lat: 37.566, lng: 126.977 },
  },
  buildings: [
    {
      id: 'building-11',
      name: 'City Hall',
      heightMeters: 40,
      outerRing: [
        { lat: 37.5661, lng: 126.9778 },
        { lat: 37.5662, lng: 126.9781 },
        { lat: 37.566, lng: 126.9782 },
      ],
      holes: [],
      footprint: [
        { lat: 37.5661, lng: 126.9778 },
        { lat: 37.5662, lng: 126.9781 },
        { lat: 37.566, lng: 126.9782 },
      ],
      usage: 'PUBLIC',
      osmAttributes: {
        building: 'yes',
        name: 'City Hall',
      },
    },
  ],
  roads: [
    {
      id: 'road-22',
      name: 'Sejong-daero',
      laneCount: 4,
      roadClass: 'primary',
      widthMeters: 14,
      direction: 'TWO_WAY',
      path: [
        { lat: 37.5661, lng: 126.9778 },
        { lat: 37.5665, lng: 126.978 },
        { lat: 37.5669, lng: 126.9782 },
      ],
    },
  ],
  walkways: [],
  pois: [
    {
      id: 'poi-33',
      name: 'Info Center',
      type: 'SHOP',
      location: { lat: 37.5664, lng: 126.9781 },
    },
  ],
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
};

export interface SceneSpecContext {
  service: SceneService;
  generationService: SceneGenerationService;
  readService: SceneReadService;
  liveDataService: SceneLiveDataService;
  repository: SceneRepository;
  ttlCacheService: TtlCacheService;
  glbBuilderService: {
    build: MockedFunction<GlbBuilderService['build']>;
  };
  mapillaryClient: {
    isConfigured: MockedFunction<MapillaryClient['isConfigured']>;
    getMapFeaturesWithEnvelope: MockedFunction<
      MapillaryClient['getMapFeaturesWithEnvelope']
    >;
    getNearbyImagesWithDiagnostics: MockedFunction<
      MapillaryClient['getNearbyImagesWithDiagnostics']
    >;
  };
  googlePlacesClient: {
    searchText: MockedFunction<GooglePlacesClient['searchText']>;
    getPlaceDetail: MockedFunction<GooglePlacesClient['getPlaceDetail']>;
    searchTextWithEnvelope: MockedFunction<
      GooglePlacesClient['searchTextWithEnvelope']
    >;
    getPlaceDetailWithEnvelope: MockedFunction<
      GooglePlacesClient['getPlaceDetailWithEnvelope']
    >;
  };
  overpassClient: {
    buildPlacePackage: MockedFunction<OverpassClient['buildPlacePackage']>;
    buildPlacePackageWithTrace: MockedFunction<
      OverpassClient['buildPlacePackageWithTrace']
    >;
  };
  openMeteoClient: {
    getObservation: MockedFunction<OpenMeteoClient['getObservation']>;
    getHistoricalObservation: MockedFunction<
      OpenMeteoClient['getHistoricalObservation']
    >;
    getObservationWithEnvelope: MockedFunction<
      OpenMeteoClient['getObservationWithEnvelope']
    >;
  };
  tomTomTrafficClient: {
    getFlowSegment: MockedFunction<TomTomTrafficClient['getFlowSegment']>;
    getFlowSegmentWithEnvelope: MockedFunction<
      TomTomTrafficClient['getFlowSegmentWithEnvelope']
    >;
  };
  sceneVisionService: {
    buildSceneVision: MockedFunction<SceneVisionService['buildSceneVision']>;
  };
  sceneHeroOverrideService: {
    applyOverrides: MockedFunction<SceneHeroOverrideService['applyOverrides']>;
  };
  qualityGateService: {
    evaluate: MockedFunction<SceneQualityGateService['evaluate']>;
  };
  appLoggerService: {
    info: MockedFunction<AppLoggerService['info']>;
    warn: MockedFunction<AppLoggerService['warn']>;
    error: MockedFunction<AppLoggerService['error']>;
    fromRequest: MockedFunction<AppLoggerService['fromRequest']>;
  };
}

export async function createSceneSpecContext(options?: {
  realSceneVision?: boolean;
}): Promise<SceneSpecContext> {
  const testSceneDataDir = join(process.cwd(), 'data', 'scene', '.spec-temp');
  await rm(testSceneDataDir, { recursive: true, force: true });
  await mkdir(testSceneDataDir, { recursive: true });
  process.env.SCENE_DATA_DIR = testSceneDataDir;

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SceneService,
      SceneGenerationService,
      BuildingStyleResolverService,
      CuratedAssetResolverService,
      SceneAssetProfileService,
      SceneFacadeVisionService,
      SceneAtmosphereRecomputeService,
      SceneFidelityPlannerService,
      SceneQualityGateService,
      SceneGenerationPipelineService,
      SceneGeometryDiagnosticsService,
      ScenePlaceResolutionStep,
      ScenePlacePackageStep,
      SceneVisualRulesStep,
      SceneFidelityPlanStep,
      SceneMetaBuilderStep,
      SceneHeroOverrideStep,
      SceneAssetProfileStep,
      SceneGeometryCorrectionStep,
      SceneGlbBuildStep,
      SceneReadService,
      SceneStateLiveService,
      SceneWeatherLiveService,
      SceneTrafficLiveService,
      SceneLiveDataService,
      SceneMidQaService,
      SceneTerrainProfileService,
      SceneRoadVisionService,
      SceneSignageVisionService,
      SceneTwinBuilderService,
      SceneRepository,
      {
        provide: TtlCacheService,
        useFactory: () => new TtlCacheService(1000, undefined),
      },
      SnapshotBuilderService,
      {
        provide: GlbBuilderService,
        useValue: {
          build: vi.fn().mockResolvedValue('/tmp/scene.glb'),
        },
      },
      {
        provide: GooglePlacesClient,
        useValue: {
          searchText: vi.fn(),
          getPlaceDetail: vi.fn(),
          searchTextWithEnvelope: vi.fn(),
          getPlaceDetailWithEnvelope: vi.fn(),
        },
      },
      {
        provide: OverpassClient,
        useValue: {
          buildPlacePackage: vi.fn(),
          buildPlacePackageWithTrace: vi.fn(),
        },
      },
      {
        provide: OpenMeteoClient,
        useValue: {
          getObservation: vi.fn(),
          getHistoricalObservation: vi.fn(),
          getObservationWithEnvelope: vi.fn(),
        },
      },
      {
        provide: TomTomTrafficClient,
        useValue: {
          getFlowSegment: vi.fn(),
          getFlowSegmentWithEnvelope: vi.fn(),
        },
      },
      ...(options?.realSceneVision
        ? [SceneVisionService]
        : [
            {
              provide: SceneVisionService,
              useValue: {
                buildSceneVision: vi.fn(),
              },
            },
          ]),
      SceneFacadeAtmosphereService,
      {
        provide: SceneHeroOverrideService,
        useValue: {
          applyOverrides: vi.fn(),
        },
      },
      {
        provide: SceneQualityGateService,
        useValue: {
          evaluate: vi.fn().mockResolvedValue({
            version: 'qg.v1',
            state: 'PASS',
            reasonCodes: [],
            scores: {
              overall: 0.8,
              breakdown: {
                structure: 0.82,
                atmosphere: 0.74,
                placeReadability: 0.78,
              },
              modeDeltaOverallScore: 0.12,
            },
            thresholds: {
              coverageGapMax: 1,
              overallMin: 0.45,
              structureMin: 0.45,
              placeReadabilityMin: 0,
              modeDeltaOverallMin: -0.2,
              criticalPolygonBudgetExceededMax: 0,
              criticalInvalidGeometryMax: 0,
              maxSkippedMeshesWarn: 180,
              maxMissingSourceWarn: 48,
            },
            meshSummary: {
              totalSkipped: 0,
              polygonBudgetExceededCount: 0,
              criticalPolygonBudgetExceededCount: 0,
              emptyOrInvalidGeometryCount: 0,
              criticalEmptyOrInvalidGeometryCount: 0,
              selectionCutCount: 0,
              missingSourceCount: 0,
            },
            artifactRefs: {
              diagnosticsLogPath: '/tmp/diagnostics.log',
              modeComparisonPath: '/tmp/mode-comparison.json',
            },
            oracleApproval: {
              required: false,
              state: 'NOT_REQUIRED',
              source: 'auto',
            },
            decidedAt: '2026-01-01T00:00:00.000Z',
          }),
        },
      },
      {
        provide: MapillaryClient,
        useValue: {
          isConfigured: vi.fn().mockReturnValue(false),
          getMapFeaturesWithEnvelope: vi.fn(),
          getNearbyImagesWithDiagnostics: vi.fn(),
        },
      },
      {
        provide: AppLoggerService,
        useValue: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          fromRequest: vi.fn(),
        },
      },
    ],
  }).compile();

  const service = module.get(SceneService);
  const generationService = module.get(SceneGenerationService);
  const readService = module.get(SceneReadService);
  const liveDataService = module.get(SceneLiveDataService);
  const repository = module.get(SceneRepository);
  const ttlCacheService = module.get(TtlCacheService);
  const glbBuilderService = module.get(
    GlbBuilderService,
  ) as SceneSpecContext['glbBuilderService'];
  const mapillaryClient = module.get(
    MapillaryClient,
  ) as SceneSpecContext['mapillaryClient'];
  const googlePlacesClient = module.get(
    GooglePlacesClient,
  ) as SceneSpecContext['googlePlacesClient'];
  const overpassClient = module.get(
    OverpassClient,
  ) as SceneSpecContext['overpassClient'];
  const openMeteoClient = module.get(
    OpenMeteoClient,
  ) as SceneSpecContext['openMeteoClient'];
  const tomTomTrafficClient = module.get(
    TomTomTrafficClient,
  ) as SceneSpecContext['tomTomTrafficClient'];
  const sceneVisionService = module.get(
    SceneVisionService,
  ) as SceneSpecContext['sceneVisionService'];
  const sceneHeroOverrideService = module.get(
    SceneHeroOverrideService,
  ) as SceneSpecContext['sceneHeroOverrideService'];
  const qualityGateService = module.get(
    SceneQualityGateService,
  ) as SceneSpecContext['qualityGateService'];
  const appLoggerService = module.get(
    AppLoggerService,
  ) as SceneSpecContext['appLoggerService'];

  await repository.clear();
  ttlCacheService.clear();

  if (!options?.realSceneVision) {
    sceneVisionService.buildSceneVision.mockResolvedValue({
      detail: {
        sceneId: 'scene-seoul-city-hall',
        placeId: placeDetail.placeId,
        generatedAt: '2026-04-04T00:00:00Z',
        detailStatus: 'OSM_ONLY',
        crossings: [],
        roadMarkings: [],
        streetFurniture: [],
        vegetation: [],
        landCovers: [],
        linearFeatures: [],
        facadeHints: [],
        signageClusters: [],
        staticAtmosphere: {
          preset: 'DAY_CLEAR',
          emissiveBoost: 1,
          roadRoughnessScale: 1,
          wetRoadBoost: 0,
        },
        annotationsApplied: [],
        provenance: {
          mapillaryUsed: false,
          mapillaryImageCount: 0,
          mapillaryFeatureCount: 0,
          osmTagCoverage: {
            coloredBuildings: 0,
            materialBuildings: 0,
            crossings: 0,
            streetFurniture: 0,
            vegetation: 0,
          },
          overrideCount: 0,
        },
      },
      metaPatch: {
        detailStatus: 'OSM_ONLY',
        visualCoverage: {
          structure: 1,
          streetDetail: 0.2,
          landmark: 0.2,
          signage: 0.1,
        },
        materialClasses: [],
        landmarkAnchors: [],
      },
      providerTrace: null,
    });
  }
  sceneHeroOverrideService.applyOverrides.mockImplementation(
    (_place, meta, detail) => ({
      meta,
      detail,
    }),
  );
  openMeteoClient.getObservationWithEnvelope.mockResolvedValue({
    observation: {
      date: '2026-04-04',
      localTime: '2026-04-04T12:00',
      temperatureCelsius: 13.2,
      precipitationMm: 0,
      rainMm: 0,
      snowfallCm: 0,
      cloudCoverPercent: 70,
      resolvedWeather: 'CLOUDY',
      source: 'OPEN_METEO_HISTORICAL',
    },
    upstreamEnvelopes: [],
  });
  tomTomTrafficClient.getFlowSegmentWithEnvelope.mockResolvedValue({
    data: {
      flowSegmentData: {
        currentSpeed: 10,
        freeFlowSpeed: 20,
        confidence: 0.9,
        roadClosure: false,
      },
    },
    upstreamEnvelopes: [],
  });

  return {
    service,
    generationService,
    readService,
    liveDataService,
    repository,
    ttlCacheService,
    glbBuilderService,
    mapillaryClient,
    googlePlacesClient,
    overpassClient,
    openMeteoClient,
    tomTomTrafficClient,
    sceneVisionService,
    sceneHeroOverrideService,
    qualityGateService,
    appLoggerService,
  };
}

export async function cleanupSceneSpecContext(
  context: SceneSpecContext | null,
): Promise<void> {
  if (context) {
    await context.generationService.waitForIdle();
  }
  const current = process.env.SCENE_DATA_DIR;
  if (current && current.includes(join('data', 'scene', '.spec-temp'))) {
    await rm(current, { recursive: true, force: true });
  }
  delete process.env.SCENE_DATA_DIR;
}
