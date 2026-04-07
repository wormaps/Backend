import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Test, TestingModule } from '@nestjs/testing';
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
import { SceneHeroOverrideStep } from './pipeline/steps/scene-hero-override.step';
import { SceneMetaBuilderStep } from './pipeline/steps/scene-meta-builder.step';
import { ScenePlacePackageStep } from './pipeline/steps/scene-place-package.step';
import { ScenePlaceResolutionStep } from './pipeline/steps/scene-place-resolution.step';
import { SceneVisualRulesStep } from './pipeline/steps/scene-visual-rules.step';
import { SceneService } from './scene.service';
import {
  BuildingStyleResolverService,
  SceneAssetProfileService,
  SceneFidelityPlannerService,
  SceneGenerationService,
  SceneHeroOverrideService,
  SceneLiveDataService,
  SceneReadService,
  SceneStateLiveService,
  SceneTrafficLiveService,
  SceneWeatherLiveService,
  SceneVisionService,
} from './services';
import { SceneRepository } from './storage/scene.repository';

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
  glbBuilderService: jest.Mocked<GlbBuilderService>;
  googlePlacesClient: jest.Mocked<GooglePlacesClient>;
  overpassClient: jest.Mocked<OverpassClient>;
  openMeteoClient: jest.Mocked<OpenMeteoClient>;
  tomTomTrafficClient: jest.Mocked<TomTomTrafficClient>;
  sceneVisionService: jest.Mocked<SceneVisionService>;
  sceneHeroOverrideService: jest.Mocked<SceneHeroOverrideService>;
  appLoggerService: jest.Mocked<AppLoggerService>;
}

export async function createSceneSpecContext(): Promise<SceneSpecContext> {
  process.env.SCENE_DATA_DIR = await mkdtemp(
    join(tmpdir(), 'wormapb-scene-test-'),
  );

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SceneService,
      SceneGenerationService,
      BuildingStyleResolverService,
      SceneAssetProfileService,
      SceneFidelityPlannerService,
      SceneGenerationPipelineService,
      ScenePlaceResolutionStep,
      ScenePlacePackageStep,
      SceneVisualRulesStep,
      SceneFidelityPlanStep,
      SceneMetaBuilderStep,
      SceneHeroOverrideStep,
      SceneAssetProfileStep,
      SceneGlbBuildStep,
      SceneReadService,
      SceneStateLiveService,
      SceneWeatherLiveService,
      SceneTrafficLiveService,
      SceneLiveDataService,
      SceneRepository,
      TtlCacheService,
      SnapshotBuilderService,
      {
        provide: GlbBuilderService,
        useValue: {
          build: jest.fn().mockResolvedValue('/tmp/scene.glb'),
        },
      },
      {
        provide: GooglePlacesClient,
        useValue: {
          searchText: jest.fn(),
          getPlaceDetail: jest.fn(),
        },
      },
      {
        provide: OverpassClient,
        useValue: {
          buildPlacePackage: jest.fn(),
        },
      },
      {
        provide: OpenMeteoClient,
        useValue: {
          getObservation: jest.fn(),
          getHistoricalObservation: jest.fn(),
        },
      },
      {
        provide: TomTomTrafficClient,
        useValue: {
          getFlowSegment: jest.fn(),
        },
      },
      {
        provide: SceneVisionService,
        useValue: {
          buildSceneVision: jest.fn(),
        },
      },
      {
        provide: SceneHeroOverrideService,
        useValue: {
          applyOverrides: jest.fn(),
        },
      },
      {
        provide: MapillaryClient,
        useValue: {
          isConfigured: jest.fn().mockReturnValue(false),
        },
      },
      {
        provide: AppLoggerService,
        useValue: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          fromRequest: jest.fn(),
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
  ) as unknown as jest.Mocked<GlbBuilderService>;
  const googlePlacesClient = module.get(
    GooglePlacesClient,
  ) as unknown as jest.Mocked<GooglePlacesClient>;
  const overpassClient = module.get(
    OverpassClient,
  ) as unknown as jest.Mocked<OverpassClient>;
  const openMeteoClient = module.get(
    OpenMeteoClient,
  ) as unknown as jest.Mocked<OpenMeteoClient>;
  const tomTomTrafficClient = module.get(
    TomTomTrafficClient,
  ) as unknown as jest.Mocked<TomTomTrafficClient>;
  const sceneVisionService = module.get(
    SceneVisionService,
  ) as unknown as jest.Mocked<SceneVisionService>;
  const sceneHeroOverrideService = module.get(
    SceneHeroOverrideService,
  ) as unknown as jest.Mocked<SceneHeroOverrideService>;
  const appLoggerService = module.get(
    AppLoggerService,
  ) as unknown as jest.Mocked<AppLoggerService>;

  await repository.clear();
  ttlCacheService.clear();

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
  });
  sceneHeroOverrideService.applyOverrides.mockImplementation(
    (_place, meta, detail) => ({
      meta,
      detail,
    }),
  );

  return {
    service,
    generationService,
    readService,
    liveDataService,
    repository,
    ttlCacheService,
    glbBuilderService,
    googlePlacesClient,
    overpassClient,
    openMeteoClient,
    tomTomTrafficClient,
    sceneVisionService,
    sceneHeroOverrideService,
    appLoggerService,
  };
}

export async function cleanupSceneSpecContext(
  context: SceneSpecContext | null,
): Promise<void> {
  if (context) {
    await context.generationService.waitForIdle();
  }
  delete process.env.SCENE_DATA_DIR;
}
