import {
  cleanupSceneSpecContext,
  createSceneSpecContext,
  placeDetail,
  placePackage,
  SceneSpecContext,
} from './scene.service.spec.fixture';

describe('Scene Live Data Service', () => {
  let context: SceneSpecContext | null = null;
  const originalSceneDataDir = process.env.SCENE_DATA_DIR;

  beforeEach(async () => {
    context = await createSceneSpecContext();
  });

  afterEach(async () => {
    await cleanupSceneSpecContext(context);
    context = null;
  });

  afterAll(() => {
    if (originalSceneDataDir) {
      process.env.SCENE_DATA_DIR = originalSceneDataDir;
      return;
    }
    delete process.env.SCENE_DATA_DIR;
  });

  it('maps historical weather to scene weather response', async () => {
    const {
      generationService,
      liveDataService,
      googlePlacesClient,
      overpassClient,
      openMeteoClient,
    } = context!;

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

    const scene = await generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
    );
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
    const {
      generationService,
      liveDataService,
      googlePlacesClient,
      overpassClient,
      openMeteoClient,
    } = context!;

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

    const scene = await generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
    );
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
    const {
      generationService,
      liveDataService,
      googlePlacesClient,
      overpassClient,
      openMeteoClient,
    } = context!;

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

    const scene = await generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
    );
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
    const {
      generationService,
      liveDataService,
      googlePlacesClient,
      overpassClient,
      tomTomTrafficClient,
    } = context!;

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

    const scene = await generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
    );
    await generationService.waitForIdle();
    const traffic = await liveDataService.getTraffic(scene.sceneId);

    expect(traffic.segments).toHaveLength(1);
    expect(traffic.segments[0]?.congestionScore).toBe(0.5);
    expect(traffic.segments[0]?.status).toBe('slow');
    expect(traffic.degraded).toBe(false);
    expect(traffic.failedSegmentCount).toBe(0);
  });

  it('caches traffic responses by scene id', async () => {
    const {
      generationService,
      liveDataService,
      googlePlacesClient,
      overpassClient,
      tomTomTrafficClient,
    } = context!;

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

    const scene = await generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
    );
    await generationService.waitForIdle();
    const first = await liveDataService.getTraffic(scene.sceneId);
    const second = await liveDataService.getTraffic(scene.sceneId);

    expect(second).toEqual(first);
    expect(tomTomTrafficClient.getFlowSegment).toHaveBeenCalledTimes(1);
  });

  it('degrades traffic response instead of failing the entire scene', async () => {
    const {
      generationService,
      liveDataService,
      googlePlacesClient,
      overpassClient,
      tomTomTrafficClient,
    } = context!;

    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    tomTomTrafficClient.getFlowSegment.mockRejectedValue(
      new Error('upstream failed'),
    );

    const scene = await generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
    );
    await generationService.waitForIdle();
    const traffic = await liveDataService.getTraffic(scene.sceneId);

    expect(traffic.segments).toHaveLength(1);
    expect(traffic.segments[0]?.currentSpeed).toBe(0);
    expect(traffic.degraded).toBe(true);
    expect(traffic.failedSegmentCount).toBe(1);
  });
});
