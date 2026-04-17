import {
  cleanupSceneSpecContext,
  createSceneSpecContext,
  placeDetail,
  placePackage,
  SceneSpecContext,
} from './scene.service.spec.fixture';

describe('Scene Services', () => {
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

  it('creates a scene and stores bootstrap-compatible metadata', async () => {
    const {
      generationService,
      readService,
      liveDataService,
      glbBuilderService,
      googlePlacesClient,
      overpassClient,
      qualityGateService,
      appLoggerService,
    } = context!;

    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    googlePlacesClient.searchTextWithEnvelope.mockResolvedValue({
      items: [placeDetail],
      envelope: {
        provider: 'Google Places Text Search',
        requestedAt: '2026-04-04T00:00:00Z',
        receivedAt: '2026-04-04T00:00:01Z',
        url: 'https://places.googleapis.com/v1/places:searchText',
        method: 'POST',
        request: {
          headers: {
            'X-Goog-Api-Key': '[redacted]',
          },
        },
        response: {
          status: 200,
          body: {
            places: [{ id: placeDetail.placeId }],
          },
        },
      },
    });
    googlePlacesClient.getPlaceDetailWithEnvelope.mockResolvedValue({
      place: placeDetail,
      envelope: {
        provider: 'Google Places Place Details',
        requestedAt: '2026-04-04T00:00:01Z',
        receivedAt: '2026-04-04T00:00:02Z',
        url: `https://places.googleapis.com/v1/places/${placeDetail.placeId}`,
        method: 'GET',
        request: {
          headers: {
            'X-Goog-Api-Key': '[redacted]',
          },
        },
        response: {
          status: 200,
          body: {
            id: placeDetail.placeId,
          },
        },
      },
    });
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    overpassClient.buildPlacePackageWithTrace.mockResolvedValue({
      placePackage,
      upstreamEnvelopes: [
        {
          provider: 'Overpass API',
          requestedAt: '2026-04-04T00:00:02Z',
          receivedAt: '2026-04-04T00:00:03Z',
          url: 'https://overpass-api.de/api/interpreter',
          method: 'POST',
          request: {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            },
          },
          response: {
            status: 200,
            body: {
              elements: [],
            },
          },
        },
      ],
    });

    const scene = await generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
    );
    expect(scene.status).toBe('PENDING');
    await generationService.waitForIdle();

    const refreshed = await readService.getScene(scene.sceneId);
    const bootstrap = await readService.getBootstrap(scene.sceneId);
    const meta = await readService.getSceneMeta(scene.sceneId);
    const detail = await readService.getSceneDetail(scene.sceneId);
    const twin = await readService.getSceneTwin(scene.sceneId);
    const validation = await readService.getValidationReport(scene.sceneId);
    const evidence = await readService.getSceneEvidence(scene.sceneId);
    const entityState = await liveDataService.getEntityState(scene.sceneId, {
      date: '2026-04-04',
      timeOfDay: 'DAY',
      kind: 'ROAD',
      objectId: 'road-22',
    });
    const qa = await readService.getMidQaReport(scene.sceneId);

    expect(refreshed.sceneId).toBe('scene-seoul-city-hall');
    expect(refreshed.radiusM).toBe(600);
    expect(refreshed.status).toBe('READY');
    expect(refreshed.failureCategory).toBeNull();
    expect(refreshed.qualityGate).toMatchObject({
      version: 'qg.v1',
      state: 'PASS',
      reasonCodes: [],
    });
    expect(refreshed.assetUrl).toBe(
      '/api/scenes/scene-seoul-city-hall/assets/base.glb',
    );
    expect(bootstrap.metaUrl).toBe('/api/scenes/scene-seoul-city-hall/meta');
    expect(bootstrap.detailUrl).toBe(
      '/api/scenes/scene-seoul-city-hall/detail',
    );
    expect(bootstrap.twinUrl).toBe('/api/scenes/scene-seoul-city-hall/twin');
    expect(bootstrap.validationUrl).toBe(
      '/api/scenes/scene-seoul-city-hall/validation',
    );
    expect(bootstrap.qaUrl).toBe('/api/scenes/scene-seoul-city-hall/qa');
    expect(bootstrap.detailStatus).toBe('OSM_ONLY');
    expect(bootstrap.assetUrl).toBe(
      '/api/scenes/scene-seoul-city-hall/assets/base.glb',
    );
    expect(bootstrap.liveEndpoints.state).toBe(
      '/api/scenes/scene-seoul-city-hall/state',
    );
    expect(bootstrap.renderContract.glbCoverage.pois).toBe(true);
    expect(bootstrap.renderContract.overlaySources.landCovers).toBe(
      '/api/scenes/scene-seoul-city-hall/detail',
    );
    expect(bootstrap.renderContract.liveDataModes.weather).toBe(
      'CURRENT_OR_HISTORICAL',
    );
    expect(bootstrap.renderContract.liveDataModes.state).toBe(
      'SYNTHETIC_RULES_ENTITY_READY',
    );
    expect(bootstrap.renderContract.loading?.selectiveLoading).toBe(true);
    expect(bootstrap.renderContract.loading?.progressiveLoading).toBe(true);
    expect(bootstrap.renderContract.loading?.defaultNodeOrder).toContain(
      'building_lod_high',
    );
    expect(bootstrap.renderContract.gltfExtensionIntents).toEqual({
      msftLodNodeLevel: true,
      extMeshGpuInstancing: true,
      backendOnlyHints: true,
    });
    expect(bootstrap.renderContract.loading?.chunkPriority).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'building_lod_high', priority: 'high' }),
        expect.objectContaining({ key: 'building_lod_low', priority: 'low' }),
      ]),
    );
    expect(bootstrap.glbSources).toEqual({
      googlePlaces: true,
      overpass: true,
      mapillary: false,
      weatherBaked: false,
      trafficBaked: false,
    });
    expect(bootstrap.qualityGate).toMatchObject({
      version: 'qg.v1',
      state: 'PASS',
    });
    expect(meta.roads[0]?.objectId).toBe('road-22');
    expect(meta.roads[0]?.path).toHaveLength(3);
    expect(meta.roads[0]?.roadClass).toBe('primary');
    expect(meta.roads[0]?.widthMeters).toBe(14);
    expect(meta.buildings[0]?.osmAttributes).toBeDefined();
    expect(meta.buildings[0]?.googlePlacesInfo?.placeId).toBe(
      placeDetail.placeId,
    );
    expect(meta.buildings[0]?.osmWayId).toBe('building_11');
    expect(meta.buildings[0]?.footprint).toHaveLength(3);
    expect(meta.camera.topView.y).toBeGreaterThan(0);
    expect(meta.stats.poiCount).toBe(1);
    expect(meta.terrainProfile?.mode).toBe('FLAT_PLACEHOLDER');
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
    expect(twin.sceneId).toBe(scene.sceneId);
    expect(twin.sourceSnapshots.snapshots).toHaveLength(9);
    expect(twin.sourceSnapshots.snapshots[0]?.kind).toBe('PLACE_SEARCH_QUERY');
    expect(twin.sourceSnapshots.snapshots[0]?.request.method).toBe('POST');
    expect(twin.sourceSnapshots.snapshots[0]?.upstreamEnvelopes).toHaveLength(
      1,
    );
    expect(twin.sourceSnapshots.snapshots[1]?.responseSummary.objectId).toBe(
      placeDetail.placeId,
    );
    expect(twin.sourceSnapshots.snapshots[2]?.upstreamEnvelopes).toHaveLength(
      1,
    );
    expect(twin.sourceSnapshots.snapshots[3]?.kind).toBe('TERRAIN_PROFILE');
    expect(twin.sourceSnapshots.snapshots[4]?.kind).toBe('WEATHER_OBSERVATION');
    expect(twin.sourceSnapshots.snapshots[5]?.kind).toBe('TRAFFIC_FLOW');
    expect(twin.sourceSnapshots.snapshots[6]?.kind).toBe('SCENE_META');
    expect(twin.sourceSnapshots.snapshots[7]?.kind).toBe('SCENE_DETAIL');
    expect(twin.sourceSnapshots.snapshots[8]?.kind).toBe('QUALITY_GATE');
    expect(
      twin.sourceSnapshots.snapshots.every((snapshot) =>
        Boolean(snapshot.evidenceMeta?.mapperVersion),
      ),
    ).toBe(true);
    expect(
      twin.sourceSnapshots.snapshots.every((snapshot) =>
        Boolean(snapshot.evidenceMeta?.normalizationRulesetId),
      ),
    ).toBe(true);
    expect(
      twin.sourceSnapshots.snapshots.find(
        (snapshot) => snapshot.kind === 'WEATHER_OBSERVATION',
      )?.upstreamEnvelopes,
    ).toBeDefined();
    expect(
      twin.sourceSnapshots.snapshots.find(
        (snapshot) => snapshot.kind === 'TRAFFIC_FLOW',
      )?.upstreamEnvelopes,
    ).toBeDefined();
    expect(twin.spatialFrame.localFrame).toBe('ENU');
    expect(twin.spatialFrame.verification.sampleCount).toBe(3);
    expect(twin.spatialFrame.terrain.mode).toBe('FLAT_PLACEHOLDER');
    expect(twin.spatialFrame.terrain.sampleCount).toBe(0);
    expect(twin.entities.some((entity) => entity.kind === 'BUILDING')).toBe(
      true,
    );
    expect(evidence.some((item) => item.kind === 'GEOMETRY')).toBe(true);
    expect(entityState.total).toBe(1);
    expect(entityState.entities[0]?.kind).toBe('ROAD');
    expect(entityState.entities[0]?.objectId).toBe('road-22');
    expect(qa.summary).toBe('FAIL');
    expect(qa.checks.some((check) => check.id === 'observed_coverage')).toBe(
      true,
    );
    expect(qa.findings.some((finding) => finding.severity === 'warn')).toBe(
      true,
    );
    expect(validation.summary).toBe('WARN');
    expect(validation.gates.map((gate) => gate.gate)).toEqual([
      'geometry',
      'semantic',
      'spatial',
      'delivery',
      'state',
    ]);
    expect(validation.gates[1]?.reasonCodes).toEqual([
      'LOW_OBSERVED_APPEARANCE_COVERAGE',
      'HIGH_INFERENCE_PROPERTY_RATIO',
    ]);
    expect(validation.gates[2]?.reasonCodes).toEqual(['TERRAIN_MODEL_MISSING']);
    expect(validation.gates[4]?.state).toBe('PASS');
    expect(
      (validation.gates[4]?.metrics as { entityStateBindingCount?: number })
        .entityStateBindingCount,
    ).toBeGreaterThan(0);
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
    expect(qualityGateService.evaluate).toHaveBeenCalledTimes(1);
    expect(overpassClient.buildPlacePackageWithTrace).toHaveBeenCalledWith(
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

    const overpassArgs =
      overpassClient.buildPlacePackageWithTrace.mock.calls[0]?.[1];
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

  it('reuses the same scene for identical query and scale', async () => {
    const { generationService, googlePlacesClient, overpassClient } = context!;
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    googlePlacesClient.searchTextWithEnvelope.mockResolvedValue({
      items: [placeDetail],
      envelope: {
        provider: 'Google Places Text Search',
        requestedAt: '2026-04-04T00:00:00Z',
        receivedAt: '2026-04-04T00:00:01Z',
        url: 'https://places.googleapis.com/v1/places:searchText',
        method: 'POST',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    googlePlacesClient.getPlaceDetailWithEnvelope.mockResolvedValue({
      place: placeDetail,
      envelope: {
        provider: 'Google Places Place Details',
        requestedAt: '2026-04-04T00:00:01Z',
        receivedAt: '2026-04-04T00:00:02Z',
        url: `https://places.googleapis.com/v1/places/${placeDetail.placeId}`,
        method: 'GET',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    overpassClient.buildPlacePackageWithTrace.mockResolvedValue({
      placePackage,
      upstreamEnvelopes: [],
    });

    const first = await generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
    );
    const second = await generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
    );

    expect(second.sceneId).toBe(first.sceneId);
    expect(googlePlacesClient.searchTextWithEnvelope).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent createScene calls for the same query', async () => {
    const { generationService, googlePlacesClient, overpassClient } = context!;
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    googlePlacesClient.searchTextWithEnvelope.mockResolvedValue({
      items: [placeDetail],
      envelope: {
        provider: 'Google Places Text Search',
        requestedAt: '2026-04-04T00:00:00Z',
        receivedAt: '2026-04-04T00:00:01Z',
        url: 'https://places.googleapis.com/v1/places:searchText',
        method: 'POST',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    googlePlacesClient.getPlaceDetailWithEnvelope.mockResolvedValue({
      place: placeDetail,
      envelope: {
        provider: 'Google Places Place Details',
        requestedAt: '2026-04-04T00:00:01Z',
        receivedAt: '2026-04-04T00:00:02Z',
        url: `https://places.googleapis.com/v1/places/${placeDetail.placeId}`,
        method: 'GET',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    overpassClient.buildPlacePackageWithTrace.mockResolvedValue({
      placePackage,
      upstreamEnvelopes: [],
    });

    const [first, second] = await Promise.all([
      generationService.createScene('Seoul City Hall', 'MEDIUM'),
      generationService.createScene('Seoul City Hall', 'MEDIUM'),
    ]);

    await generationService.waitForIdle();

    expect(first.sceneId).toBe(second.sceneId);
    expect(googlePlacesClient.searchTextWithEnvelope).toHaveBeenCalledTimes(1);
  });

  it('creates a fresh scene when forceRegenerate is enabled', async () => {
    const { generationService, googlePlacesClient, overpassClient } = context!;
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    googlePlacesClient.searchTextWithEnvelope.mockResolvedValue({
      items: [placeDetail],
      envelope: {
        provider: 'Google Places Text Search',
        requestedAt: '2026-04-04T00:00:00Z',
        receivedAt: '2026-04-04T00:00:01Z',
        url: 'https://places.googleapis.com/v1/places:searchText',
        method: 'POST',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    googlePlacesClient.getPlaceDetailWithEnvelope.mockResolvedValue({
      place: placeDetail,
      envelope: {
        provider: 'Google Places Place Details',
        requestedAt: '2026-04-04T00:00:01Z',
        receivedAt: '2026-04-04T00:00:02Z',
        url: `https://places.googleapis.com/v1/places/${placeDetail.placeId}`,
        method: 'GET',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    overpassClient.buildPlacePackageWithTrace.mockResolvedValue({
      placePackage,
      upstreamEnvelopes: [],
    });

    const first = await generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
    );
    await generationService.waitForIdle();
    const second = await generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
      {
        forceRegenerate: true,
        requestId: 'req_force',
        source: 'smoke',
      },
    );

    expect(second.sceneId).not.toBe(first.sceneId);
    expect(second.status).toBe('PENDING');
    await generationService.waitForIdle();
    expect(googlePlacesClient.searchTextWithEnvelope).toHaveBeenCalledTimes(2);
  });

  it('fails scene when Google Places keeps failing', async () => {
    const { generationService, readService, googlePlacesClient } = context!;
    googlePlacesClient.searchText.mockRejectedValue(
      new Error('google places unavailable'),
    );
    googlePlacesClient.getPlaceDetail.mockRejectedValue(
      new Error('google places unavailable'),
    );
    googlePlacesClient.searchTextWithEnvelope.mockRejectedValue(
      new Error('google places unavailable'),
    );
    googlePlacesClient.getPlaceDetailWithEnvelope.mockRejectedValue(
      new Error('google places unavailable'),
    );

    const scene = await generationService.createScene(
      'Google Failure Place',
      'MEDIUM',
    );
    await generationService.waitForIdle();
    const failed = await readService.getScene(scene.sceneId);

    expect(failed.status).toBe('FAILED');
    expect(failed.failureCategory).toBe('GENERATION_ERROR');
    expect(googlePlacesClient.searchTextWithEnvelope).toHaveBeenCalledTimes(2);
  });

  it('fails scene when Overpass keeps failing', async () => {
    const { generationService, readService, googlePlacesClient, overpassClient } =
      context!;
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    googlePlacesClient.searchTextWithEnvelope.mockResolvedValue({
      items: [placeDetail],
      envelope: {
        provider: 'Google Places Text Search',
        requestedAt: '2026-04-04T00:00:00Z',
        receivedAt: '2026-04-04T00:00:01Z',
        url: 'https://places.googleapis.com/v1/places:searchText',
        method: 'POST',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    googlePlacesClient.getPlaceDetailWithEnvelope.mockResolvedValue({
      place: placeDetail,
      envelope: {
        provider: 'Google Places Place Details',
        requestedAt: '2026-04-04T00:00:01Z',
        receivedAt: '2026-04-04T00:00:02Z',
        url: `https://places.googleapis.com/v1/places/${placeDetail.placeId}`,
        method: 'GET',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    overpassClient.buildPlacePackage.mockRejectedValue(
      new Error('overpass unavailable'),
    );
    overpassClient.buildPlacePackageWithTrace.mockRejectedValue(
      new Error('overpass unavailable'),
    );

    const scene = await generationService.createScene(
      'Overpass Failure Place',
      'MEDIUM',
    );
    await generationService.waitForIdle();
    const failed = await readService.getScene(scene.sceneId);

    expect(failed.status).toBe('FAILED');
    expect(failed.failureCategory).toBe('GENERATION_ERROR');
    expect(overpassClient.buildPlacePackageWithTrace).toHaveBeenCalledTimes(2);
  });

  it('fails scene when GLB build keeps failing', async () => {
    const {
      generationService,
      readService,
      googlePlacesClient,
      overpassClient,
      glbBuilderService,
    } = context!;
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    googlePlacesClient.searchTextWithEnvelope.mockResolvedValue({
      items: [placeDetail],
      envelope: {
        provider: 'Google Places Text Search',
        requestedAt: '2026-04-04T00:00:00Z',
        receivedAt: '2026-04-04T00:00:01Z',
        url: 'https://places.googleapis.com/v1/places:searchText',
        method: 'POST',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    googlePlacesClient.getPlaceDetailWithEnvelope.mockResolvedValue({
      place: placeDetail,
      envelope: {
        provider: 'Google Places Place Details',
        requestedAt: '2026-04-04T00:00:01Z',
        receivedAt: '2026-04-04T00:00:02Z',
        url: `https://places.googleapis.com/v1/places/${placeDetail.placeId}`,
        method: 'GET',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    overpassClient.buildPlacePackageWithTrace.mockResolvedValue({
      placePackage,
      upstreamEnvelopes: [],
    });
    glbBuilderService.build.mockRejectedValue(new Error('glb build failed'));

    const scene = await generationService.createScene(
      'GLB Failure Place',
      'MEDIUM',
    );
    await generationService.waitForIdle();
    const failed = await readService.getScene(scene.sceneId);

    expect(failed.status).toBe('FAILED');
    expect(failed.failureCategory).toBe('GENERATION_ERROR');
    expect(glbBuilderService.build).toHaveBeenCalledTimes(2);
  });

  it('persists curatedAssetPayload in stored scene on creation', async () => {
    const { generationService, readService } = context!;
    const curatedAssetPayload = {
      landmarks: [
        { id: 'lm-1', name: 'Landmark 1' },
        { id: 'lm-2', name: 'Landmark 2' },
      ],
      facadeOverrides: [{ objectId: 'building-1', palette: ['#ff7755'] }],
      signageOverrides: [{ objectId: 'sign-1', panelCount: 3 }],
    };

    const scene = await generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
      {
        forceRegenerate: true,
        requestId: 'req_curated',
        source: 'api',
        curatedAssetPayload,
      },
    );

    const stored = await readService['sceneRepository'].findById(scene.sceneId);
    expect(stored?.curatedAssetPayload).toEqual(curatedAssetPayload);
  });

  it('marks scene as failed after retry exhaustion', async () => {
    const { generationService, readService, googlePlacesClient } = context!;
    googlePlacesClient.searchTextWithEnvelope.mockResolvedValue({
      items: [],
      envelope: {
        provider: 'Google Places Text Search',
        requestedAt: '2026-04-04T00:00:00Z',
        receivedAt: '2026-04-04T00:00:01Z',
        url: 'https://places.googleapis.com/v1/places:searchText',
        method: 'POST',
        request: {},
        response: { status: 200, body: { places: [] } },
      },
    });
    googlePlacesClient.searchText.mockResolvedValue([]);

    const scene = await generationService.createScene(
      'Unknown Place',
      'MEDIUM',
    );
    await generationService.waitForIdle();
    const failed = await readService.getScene(scene.sceneId);

    expect(failed.status).toBe('FAILED');
    expect(failed.failureReason).toBe(
      '검색 결과에 해당하는 장소를 찾을 수 없습니다.',
    );
    expect(googlePlacesClient.searchTextWithEnvelope).toHaveBeenCalledTimes(2);
  });

  it('fails scene without retry when quality gate rejects output', async () => {
    const {
      generationService,
      readService,
      googlePlacesClient,
      overpassClient,
      qualityGateService,
    } = context!;
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    googlePlacesClient.searchTextWithEnvelope.mockResolvedValue({
      items: [placeDetail],
      envelope: {
        provider: 'Google Places Text Search',
        requestedAt: '2026-04-04T00:00:00Z',
        receivedAt: '2026-04-04T00:00:01Z',
        url: 'https://places.googleapis.com/v1/places:searchText',
        method: 'POST',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    googlePlacesClient.getPlaceDetailWithEnvelope.mockResolvedValue({
      place: placeDetail,
      envelope: {
        provider: 'Google Places Place Details',
        requestedAt: '2026-04-04T00:00:01Z',
        receivedAt: '2026-04-04T00:00:02Z',
        url: `https://places.googleapis.com/v1/places/${placeDetail.placeId}`,
        method: 'GET',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    overpassClient.buildPlacePackageWithTrace.mockResolvedValue({
      placePackage,
      upstreamEnvelopes: [],
    });
    qualityGateService.evaluate.mockResolvedValueOnce({
      version: 'qg.v1',
      state: 'FAIL',
      failureCategory: 'QUALITY_GATE_REJECTED',
      reasonCodes: ['CRITICAL_BUDGET_SKIP', 'OVERALL_SCORE_BELOW_MIN'],
      scores: {
        overall: 0.32,
        breakdown: {
          structure: 0.41,
          atmosphere: 0.21,
          placeReadability: 0.18,
        },
        modeDeltaOverallScore: -0.26,
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
        totalSkipped: 8,
        polygonBudgetExceededCount: 4,
        criticalPolygonBudgetExceededCount: 1,
        emptyOrInvalidGeometryCount: 2,
        criticalEmptyOrInvalidGeometryCount: 0,
        selectionCutCount: 1,
        missingSourceCount: 1,
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
    });

    const scene = await generationService.createScene(
      'Seoul City Hall Gate Fail',
      'MEDIUM',
    );
    await generationService.waitForIdle();

    const failed = await readService.getScene(scene.sceneId);
    expect(failed.status).toBe('FAILED');
    expect(failed.failureCategory).toBe('QUALITY_GATE_REJECTED');
    expect(failed.failureReason).toContain('CRITICAL_BUDGET_SKIP');
    expect(failed.qualityGate).toMatchObject({
      state: 'FAIL',
      reasonCodes: ['CRITICAL_BUDGET_SKIP', 'OVERALL_SCORE_BELOW_MIN'],
    });
    expect(googlePlacesClient.searchTextWithEnvelope).toHaveBeenCalledTimes(1);

    await expect(readService.getBootstrap(scene.sceneId)).rejects.toMatchObject(
      {
        response: {
          code: 'SCENE_NOT_READY',
          detail: {
            status: 'FAILED',
            failureCategory: 'QUALITY_GATE_REJECTED',
            qualityGate: expect.objectContaining({
              state: 'FAIL',
            }),
          },
        },
      },
    );
  });

  it('applies different collection bounds for each scene scale', async () => {
    const { generationService, googlePlacesClient, overpassClient } = context!;
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    googlePlacesClient.searchTextWithEnvelope.mockResolvedValue({
      items: [placeDetail],
      envelope: {
        provider: 'Google Places Text Search',
        requestedAt: '2026-04-04T00:00:00Z',
        receivedAt: '2026-04-04T00:00:01Z',
        url: 'https://places.googleapis.com/v1/places:searchText',
        method: 'POST',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    googlePlacesClient.getPlaceDetailWithEnvelope.mockResolvedValue({
      place: placeDetail,
      envelope: {
        provider: 'Google Places Place Details',
        requestedAt: '2026-04-04T00:00:01Z',
        receivedAt: '2026-04-04T00:00:02Z',
        url: `https://places.googleapis.com/v1/places/${placeDetail.placeId}`,
        method: 'GET',
        request: {},
        response: { status: 200, body: {} },
      },
    });
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    overpassClient.buildPlacePackageWithTrace.mockResolvedValue({
      placePackage,
      upstreamEnvelopes: [],
    });

    const small = await generationService.createScene(
      'Seoul City Hall Small',
      'SMALL',
    );
    await generationService.waitForIdle();
    const smallBounds =
      overpassClient.buildPlacePackageWithTrace.mock.calls[0]?.[1]?.bounds;

    overpassClient.buildPlacePackageWithTrace.mockClear();

    const large = await generationService.createScene(
      'Seoul City Hall Large',
      'LARGE',
    );
    await generationService.waitForIdle();
    const largeBounds =
      overpassClient.buildPlacePackageWithTrace.mock.calls[0]?.[1]?.bounds;

    expect(small.sceneId).toBe('scene-seoul-city-hall-small');
    expect(large.sceneId).toBe('scene-seoul-city-hall-large');
    expect(smallBounds).toBeDefined();
    expect(largeBounds).toBeDefined();
    expect(
      largeBounds!.northEast.lat - largeBounds!.southWest.lat,
    ).toBeGreaterThan(smallBounds!.northEast.lat - smallBounds!.southWest.lat);
    expect(
      largeBounds!.northEast.lng - largeBounds!.southWest.lng,
    ).toBeGreaterThan(smallBounds!.northEast.lng - smallBounds!.southWest.lng);
  });
});
