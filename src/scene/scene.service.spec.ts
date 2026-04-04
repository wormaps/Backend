import { Test, TestingModule } from '@nestjs/testing';
import { TtlCacheService } from '../cache/ttl-cache.service';
import { GooglePlacesClient } from '../places/google-places.client';
import { OpenMeteoClient } from '../places/open-meteo.client';
import { OverpassClient } from '../places/overpass.client';
import { TomTomTrafficClient } from '../places/tomtom-traffic.client';
import { ExternalPlaceDetail } from '../places/external-place.types';
import { PlacePackage } from '../places/place.types';
import { SceneRepository } from './scene.repository';
import { SceneService } from './scene.service';

describe('SceneService', () => {
  let service: SceneService;
  let repository: SceneRepository;
  let ttlCacheService: TtlCacheService;
  let googlePlacesClient: jest.Mocked<GooglePlacesClient>;
  let overpassClient: jest.Mocked<OverpassClient>;
  let openMeteoClient: jest.Mocked<OpenMeteoClient>;
  let tomTomTrafficClient: jest.Mocked<TomTomTrafficClient>;

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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SceneService,
        SceneRepository,
        TtlCacheService,
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
            getHistoricalObservation: jest.fn(),
          },
        },
        {
          provide: TomTomTrafficClient,
          useValue: {
            getFlowSegment: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(SceneService);
    repository = module.get(SceneRepository);
    ttlCacheService = module.get(TtlCacheService);
    googlePlacesClient = module.get(GooglePlacesClient);
    overpassClient = module.get(OverpassClient);
    openMeteoClient = module.get(OpenMeteoClient);
    tomTomTrafficClient = module.get(TomTomTrafficClient);
    await repository.clear();
    ttlCacheService.clear();
  });

  afterEach(async () => {
    await service.waitForIdle();
  });

  it('creates a scene and stores bootstrap-compatible metadata', async () => {
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);

    const scene = await service.createScene('Seoul City Hall', 'MEDIUM');
    expect(scene.status).toBe('PENDING');
    await service.waitForIdle();
    const refreshed = await service.getScene(scene.sceneId);
    const bootstrap = await service.getBootstrap(scene.sceneId);
    const meta = await service.getSceneMeta(scene.sceneId);

    expect(refreshed.sceneId).toBe('scene-seoul-city-hall');
    expect(refreshed.radiusM).toBe(600);
    expect(refreshed.status).toBe('READY');
    expect(bootstrap.metaUrl).toBe('/api/scenes/scene-seoul-city-hall/meta');
    expect(meta.roads[0]?.objectId).toBe('road-22');
    expect(meta.roads[0]?.path).toHaveLength(3);
    expect(meta.buildings[0]?.osmWayId).toBe('way_11');
    expect(meta.buildings[0]?.footprint).toHaveLength(3);
    expect(meta.camera.topView.y).toBe(180);
    expect(meta.stats.poiCount).toBe(1);
    expect(meta.pois[0]?.category).toBe('shop');
    expect(meta.pois[0]?.location.lat).toBe(37.5664);
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

    const scene = await service.createScene('Seoul City Hall', 'MEDIUM');
    await service.waitForIdle();
    const weather = await service.getWeather(scene.sceneId, {
      date: '2026-04-04',
      timeOfDay: 'DAY',
    });

    expect(weather.weatherCode).toBe(3);
    expect(weather.preset).toBe('cloudy');
    expect(weather.temperature).toBe(13.2);
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

    const scene = await service.createScene('Seoul City Hall', 'MEDIUM');
    await service.waitForIdle();
    const first = await service.getWeather(scene.sceneId, {
      date: '2026-04-04',
      timeOfDay: 'DAY',
    });
    const second = await service.getWeather(scene.sceneId, {
      date: '2026-04-04',
      timeOfDay: 'DAY',
    });

    expect(second).toEqual(first);
    expect(openMeteoClient.getHistoricalObservation).toHaveBeenCalledTimes(1);
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

    const scene = await service.createScene('Seoul City Hall', 'MEDIUM');
    await service.waitForIdle();
    const traffic = await service.getTraffic(scene.sceneId);

    expect(traffic.segments).toHaveLength(1);
    expect(traffic.segments[0]?.congestionScore).toBe(0.5);
    expect(traffic.segments[0]?.status).toBe('slow');
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

    const scene = await service.createScene('Seoul City Hall', 'MEDIUM');
    await service.waitForIdle();
    const first = await service.getTraffic(scene.sceneId);
    const second = await service.getTraffic(scene.sceneId);

    expect(second).toEqual(first);
    expect(tomTomTrafficClient.getFlowSegment).toHaveBeenCalledTimes(1);
  });

  it('reuses the same scene for identical query and scale', async () => {
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);

    const first = await service.createScene('Seoul City Hall', 'MEDIUM');
    const second = await service.createScene('Seoul City Hall', 'MEDIUM');

    expect(second.sceneId).toBe(first.sceneId);
    expect(googlePlacesClient.searchText).toHaveBeenCalledTimes(1);
  });

  it('marks scene as failed after retry exhaustion', async () => {
    googlePlacesClient.searchText.mockResolvedValue([]);

    const scene = await service.createScene('Unknown Place', 'MEDIUM');
    await service.waitForIdle();
    const failed = await service.getScene(scene.sceneId);

    expect(failed.status).toBe('FAILED');
    expect(failed.failureReason).toBe('검색 결과에 해당하는 장소를 찾을 수 없습니다.');
    expect(googlePlacesClient.searchText).toHaveBeenCalledTimes(2);
  });
});
