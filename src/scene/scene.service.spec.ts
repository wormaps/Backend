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
import { SceneGlbBuildStep } from './pipeline/steps/scene-glb-build.step';
import { SceneHeroOverrideStep } from './pipeline/steps/scene-hero-override.step';
import { SceneMetaBuilderStep } from './pipeline/steps/scene-meta-builder.step';
import { ScenePlacePackageStep } from './pipeline/steps/scene-place-package.step';
import { ScenePlaceResolutionStep } from './pipeline/steps/scene-place-resolution.step';
import { SceneVisualRulesStep } from './pipeline/steps/scene-visual-rules.step';
import { SceneService } from './scene.service';
import { SceneGenerationService } from './services/scene-generation.service';
import { SceneLiveDataService } from './services/scene-live-data.service';
import { SceneReadService } from './services/scene-read.service';
import { SceneHeroOverrideService } from './services/scene-hero-override.service';
import { SceneRepository } from './storage/scene.repository';
import { SceneVisionService } from './services/scene-vision.service';

describe('Scene Services', () => {
  let service: SceneService;
  let generationService: SceneGenerationService;
  let readService: SceneReadService;
  let liveDataService: SceneLiveDataService;
  let repository: SceneRepository;
  let ttlCacheService: TtlCacheService;
  let glbBuilderService: jest.Mocked<GlbBuilderService>;
  let googlePlacesClient: jest.Mocked<GooglePlacesClient>;
  let overpassClient: jest.Mocked<OverpassClient>;
  let openMeteoClient: jest.Mocked<OpenMeteoClient>;
  let tomTomTrafficClient: jest.Mocked<TomTomTrafficClient>;
  let sceneVisionService: jest.Mocked<SceneVisionService>;
  let sceneHeroOverrideService: jest.Mocked<SceneHeroOverrideService>;
  let appLoggerService: jest.Mocked<AppLoggerService>;
  const originalSceneDataDir = process.env.SCENE_DATA_DIR;

  const placeDetail: ExternalPlaceDetail = {
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

  const placePackage: PlacePackage = {
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

  beforeEach(async () => {
    process.env.SCENE_DATA_DIR = await mkdtemp(
      join(tmpdir(), 'wormapb-scene-test-'),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SceneService,
        SceneGenerationService,
        SceneGenerationPipelineService,
        ScenePlaceResolutionStep,
        ScenePlacePackageStep,
        SceneVisualRulesStep,
        SceneMetaBuilderStep,
        SceneHeroOverrideStep,
        SceneAssetProfileStep,
        SceneGlbBuildStep,
        SceneReadService,
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

    service = module.get(SceneService);
    generationService = module.get(SceneGenerationService);
    readService = module.get(SceneReadService);
    liveDataService = module.get(SceneLiveDataService);
    repository = module.get(SceneRepository);
    ttlCacheService = module.get(TtlCacheService);
    glbBuilderService = module.get(GlbBuilderService);
    googlePlacesClient = module.get(GooglePlacesClient);
    overpassClient = module.get(OverpassClient);
    openMeteoClient = module.get(OpenMeteoClient);
    tomTomTrafficClient = module.get(TomTomTrafficClient);
    sceneVisionService = module.get(SceneVisionService);
    sceneHeroOverrideService = module.get(SceneHeroOverrideService);
    appLoggerService = module.get(AppLoggerService);
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
        heroOverridesApplied: [],
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
    sceneHeroOverrideService.applyOverrides.mockImplementation((_place, meta, detail) => ({
      meta,
      detail,
    }));
  });

  afterEach(async () => {
    await generationService.waitForIdle();
    delete process.env.SCENE_DATA_DIR;
  });

  afterAll(() => {
    if (originalSceneDataDir) {
      process.env.SCENE_DATA_DIR = originalSceneDataDir;
      return;
    }

    delete process.env.SCENE_DATA_DIR;
  });

  it('creates a scene and stores bootstrap-compatible metadata', async () => {
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);

    const scene = await generationService.createScene('Seoul City Hall', 'MEDIUM');
    expect(scene.status).toBe('PENDING');
    await generationService.waitForIdle();
    const refreshed = await readService.getScene(scene.sceneId);
    const bootstrap = await readService.getBootstrap(scene.sceneId);
    const meta = await readService.getSceneMeta(scene.sceneId);
    const detail = await readService.getSceneDetail(scene.sceneId);

    expect(refreshed.sceneId).toBe('scene-seoul-city-hall');
    expect(refreshed.radiusM).toBe(600);
    expect(refreshed.status).toBe('READY');
    expect(refreshed.assetUrl).toBe('/api/scenes/scene-seoul-city-hall/assets/base.glb');
    expect(bootstrap.metaUrl).toBe('/api/scenes/scene-seoul-city-hall/meta');
    expect(bootstrap.detailUrl).toBe('/api/scenes/scene-seoul-city-hall/detail');
    expect(bootstrap.detailStatus).toBe('OSM_ONLY');
    expect(bootstrap.assetUrl).toBe('/api/scenes/scene-seoul-city-hall/assets/base.glb');
    expect(bootstrap.liveEndpoints.state).toBe('/api/scenes/scene-seoul-city-hall/state');
    expect(bootstrap.renderContract.glbCoverage.pois).toBe(true);
    expect(bootstrap.renderContract.overlaySources.landCovers).toBe(
      '/api/scenes/scene-seoul-city-hall/detail',
    );
    expect(bootstrap.renderContract.liveDataModes.weather).toBe(
      'CURRENT_OR_HISTORICAL',
    );
    expect(bootstrap.glbSources).toEqual({
      googlePlaces: true,
      overpass: true,
      mapillary: false,
      weatherBaked: false,
      trafficBaked: false,
    });
    expect(meta.roads[0]?.objectId).toBe('road-22');
    expect(meta.roads[0]?.path).toHaveLength(3);
    expect(meta.roads[0]?.roadClass).toBe('primary');
    expect(meta.roads[0]?.widthMeters).toBe(14);
    expect(meta.buildings[0]?.osmWayId).toBe('building_11');
    expect(meta.buildings[0]?.footprint).toHaveLength(3);
    expect(meta.camera.topView.y).toBeGreaterThan(0);
    expect(meta.stats.poiCount).toBe(1);
    expect(meta.diagnostics).toEqual({
      droppedBuildings: 0,
      droppedRoads: 0,
      droppedWalkways: 0,
      droppedPois: 0,
      droppedCrossings: 0,
      droppedStreetFurniture: 0,
      droppedVegetation: 0,
      droppedLandCovers: 0,
      droppedLinearFeatures: 0,
    });
    expect(meta.assetProfile.preset).toBe('MEDIUM');
    expect(meta.assetProfile.budget.buildingCount).toBeGreaterThan(0);
    expect(meta.assetProfile.selected.buildingCount).toBeGreaterThan(0);
    expect(detail.detailStatus).toBe('OSM_ONLY');
    expect(detail.crossings).toEqual([]);
    expect(meta.pois[0]?.category).toBe('shop');
    expect(meta.pois[0]?.location.lat).toBe(37.5664);
    const places = await readService.getPlaces(scene.sceneId);
    expect(places.landmarks).toEqual([]);
    expect(places.categories).toEqual([
      {
        category: 'shop',
        count: 1,
        landmarkCount: 0,
      },
    ]);
    expect(glbBuilderService.build).toHaveBeenCalledTimes(1);
    expect(overpassClient.buildPlacePackage).toHaveBeenCalledWith(
      placeDetail,
      expect.objectContaining({
        bounds: expect.objectContaining({
          northEast: expect.objectContaining({
            lat: expect.any(Number),
            lng: expect.any(Number),
          }),
          southWest: expect.objectContaining({
            lat: expect.any(Number),
            lng: expect.any(Number),
          }),
        }),
      }),
    );
    const overpassArgs = overpassClient.buildPlacePackage.mock.calls[0]?.[1];
    expect(overpassArgs?.bounds).toBeDefined();
    expect(overpassArgs!.bounds!.northEast.lat).toBeGreaterThan(
      placeDetail.location.lat,
    );
    expect(overpassArgs!.bounds!.southWest.lat).toBeLessThan(
      placeDetail.location.lat,
    );
    expect(meta.bounds.radiusM).toBe(600);
    expect(appLoggerService.info).toHaveBeenCalledWith(
      'scene.ready',
      expect.objectContaining({
        sceneId: scene.sceneId,
        status: 'READY',
      }),
    );
  });

  it('maps historical weather to scene weather response', async () => {
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    openMeteoClient.getHistoricalObservation.mockResolvedValue({
      date: '2026-04-04',
      localTime: '2026-04-04T12:00',
      temperatureCelsius: 13.2,
      precipitationMm: 0,
      rainMm: 0,
      snowfallCm: 0,
      cloudCoverPercent: 70,
      resolvedWeather: 'CLOUDY',
      source: 'OPEN_METEO_HISTORICAL',
    });
    openMeteoClient.getObservation.mockResolvedValue({
      date: '2026-04-04',
      localTime: '2026-04-04T12:00',
      temperatureCelsius: 13.2,
      precipitationMm: 0,
      rainMm: 0,
      snowfallCm: 0,
      cloudCoverPercent: 70,
      resolvedWeather: 'CLOUDY',
      source: 'OPEN_METEO_HISTORICAL',
    });

    const scene = await generationService.createScene('Seoul City Hall', 'MEDIUM');
    await generationService.waitForIdle();
    const weather = await liveDataService.getWeather(scene.sceneId, {
      date: '2026-04-04',
      timeOfDay: 'DAY',
    });

    expect(weather.weatherCode).toBe(3);
    expect(weather.preset).toBe('cloudy');
    expect(weather.temperature).toBe(13.2);
  });

  it('builds scene live state from snapshot rules and weather observation', async () => {
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    openMeteoClient.getHistoricalObservation.mockResolvedValue({
      date: '2026-04-04',
      localTime: '2026-04-04T18:00',
      temperatureCelsius: 11.4,
      precipitationMm: 0,
      rainMm: 0,
      snowfallCm: 0,
      cloudCoverPercent: 20,
      resolvedWeather: 'CLEAR',
      source: 'OPEN_METEO_HISTORICAL',
    });
    openMeteoClient.getObservation.mockResolvedValue({
      date: '2026-04-04',
      localTime: '2026-04-04T18:00',
      temperatureCelsius: 11.4,
      precipitationMm: 0,
      rainMm: 0,
      snowfallCm: 0,
      cloudCoverPercent: 20,
      resolvedWeather: 'CLEAR',
      source: 'OPEN_METEO_HISTORICAL',
    });

    const scene = await generationService.createScene('Seoul City Hall', 'MEDIUM');
    await generationService.waitForIdle();
    const state = await liveDataService.getState(scene.sceneId, {
      date: '2026-04-04',
      timeOfDay: 'EVENING',
    });

    expect(state.placeId).toBe(placeDetail.placeId);
    expect(state.timeOfDay).toBe('EVENING');
    expect(state.weather).toBe('CLEAR');
    expect(state.source).toBe('MVP_SYNTHETIC_RULES');
    expect(state.crowd.count).toBeGreaterThan(0);
    expect(state.lighting.neon).toBe(true);
    expect(state.sourceDetail).toEqual({
      provider: 'OPEN_METEO_HISTORICAL',
      date: '2026-04-04',
      localTime: '2026-04-04T18:00',
    });
  });

  it('caches weather responses by scene/date/timeOfDay', async () => {
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    openMeteoClient.getHistoricalObservation.mockResolvedValue({
      date: '2026-04-04',
      localTime: '2026-04-04T12:00',
      temperatureCelsius: 13.2,
      precipitationMm: 0,
      rainMm: 0,
      snowfallCm: 0,
      cloudCoverPercent: 70,
      resolvedWeather: 'CLOUDY',
      source: 'OPEN_METEO_HISTORICAL',
    });
    openMeteoClient.getObservation.mockResolvedValue({
      date: '2026-04-04',
      localTime: '2026-04-04T12:00',
      temperatureCelsius: 13.2,
      precipitationMm: 0,
      rainMm: 0,
      snowfallCm: 0,
      cloudCoverPercent: 70,
      resolvedWeather: 'CLOUDY',
      source: 'OPEN_METEO_HISTORICAL',
    });

    const scene = await generationService.createScene('Seoul City Hall', 'MEDIUM');
    await generationService.waitForIdle();
    const first = await liveDataService.getWeather(scene.sceneId, {
      date: '2026-04-04',
      timeOfDay: 'DAY',
    });
    const second = await liveDataService.getWeather(scene.sceneId, {
      date: '2026-04-04',
      timeOfDay: 'DAY',
    });

    expect(second).toEqual(first);
    expect(openMeteoClient.getObservation).toHaveBeenCalledTimes(1);
  });

  it('maps traffic flow to congestion response', async () => {
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    tomTomTrafficClient.getFlowSegment.mockResolvedValue({
      flowSegmentData: {
        currentSpeed: 10,
        freeFlowSpeed: 20,
        confidence: 0.9,
        roadClosure: false,
      },
    });

    const scene = await generationService.createScene('Seoul City Hall', 'MEDIUM');
    await generationService.waitForIdle();
    const traffic = await liveDataService.getTraffic(scene.sceneId);

    expect(traffic.segments).toHaveLength(1);
    expect(traffic.segments[0]?.congestionScore).toBe(0.5);
    expect(traffic.segments[0]?.status).toBe('slow');
    expect(traffic.degraded).toBe(false);
    expect(traffic.failedSegmentCount).toBe(0);
  });

  it('caches traffic responses by scene id', async () => {
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    tomTomTrafficClient.getFlowSegment.mockResolvedValue({
      flowSegmentData: {
        currentSpeed: 10,
        freeFlowSpeed: 20,
        confidence: 0.9,
        roadClosure: false,
      },
    });

    const scene = await generationService.createScene('Seoul City Hall', 'MEDIUM');
    await generationService.waitForIdle();
    const first = await liveDataService.getTraffic(scene.sceneId);
    const second = await liveDataService.getTraffic(scene.sceneId);

    expect(second).toEqual(first);
    expect(tomTomTrafficClient.getFlowSegment).toHaveBeenCalledTimes(1);
  });

  it('degrades traffic response instead of failing the entire scene', async () => {
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    tomTomTrafficClient.getFlowSegment.mockRejectedValue(
      new Error('upstream failed'),
    );

    const scene = await generationService.createScene('Seoul City Hall', 'MEDIUM');
    await generationService.waitForIdle();
    const traffic = await liveDataService.getTraffic(scene.sceneId);

    expect(traffic.segments).toHaveLength(1);
    expect(traffic.segments[0]?.currentSpeed).toBe(0);
    expect(traffic.degraded).toBe(true);
    expect(traffic.failedSegmentCount).toBe(1);
  });

  it('reuses the same scene for identical query and scale', async () => {
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);

    const first = await generationService.createScene('Seoul City Hall', 'MEDIUM');
    const second = await generationService.createScene('Seoul City Hall', 'MEDIUM');

    expect(second.sceneId).toBe(first.sceneId);
    expect(googlePlacesClient.searchText).toHaveBeenCalledTimes(1);
  });

  it('creates a fresh scene when forceRegenerate is enabled', async () => {
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);

    const first = await generationService.createScene('Seoul City Hall', 'MEDIUM');
    await generationService.waitForIdle();
    const second = await generationService.createScene('Seoul City Hall', 'MEDIUM', {
      forceRegenerate: true,
      requestId: 'req_force',
      source: 'smoke',
    });

    expect(second.sceneId).not.toBe(first.sceneId);
    expect(second.status).toBe('PENDING');
    await generationService.waitForIdle();
    expect(googlePlacesClient.searchText).toHaveBeenCalledTimes(2);
  });

  it('marks scene as failed after retry exhaustion', async () => {
    googlePlacesClient.searchText.mockResolvedValue([]);

    const scene = await generationService.createScene('Unknown Place', 'MEDIUM');
    await generationService.waitForIdle();
    const failed = await readService.getScene(scene.sceneId);

    expect(failed.status).toBe('FAILED');
    expect(failed.failureReason).toBe('검색 결과에 해당하는 장소를 찾을 수 없습니다.');
    expect(googlePlacesClient.searchText).toHaveBeenCalledTimes(2);
  });

  it('applies different collection bounds for each scene scale', async () => {
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);

    const small = await generationService.createScene('Seoul City Hall Small', 'SMALL');
    await generationService.waitForIdle();
    const smallBounds = overpassClient.buildPlacePackage.mock.calls[0]?.[1]?.bounds;

    overpassClient.buildPlacePackage.mockClear();

    const large = await generationService.createScene('Seoul City Hall Large', 'LARGE');
    await generationService.waitForIdle();
    const largeBounds = overpassClient.buildPlacePackage.mock.calls[0]?.[1]?.bounds;

    expect(small.sceneId).toBe('scene-seoul-city-hall-small');
    expect(large.sceneId).toBe('scene-seoul-city-hall-large');
    expect(smallBounds).toBeDefined();
    expect(largeBounds).toBeDefined();
    expect(largeBounds!.northEast.lat - largeBounds!.southWest.lat).toBeGreaterThan(
      smallBounds!.northEast.lat - smallBounds!.southWest.lat,
    );
    expect(largeBounds!.northEast.lng - largeBounds!.southWest.lng).toBeGreaterThan(
      smallBounds!.northEast.lng - smallBounds!.southWest.lng,
    );
  });
});
