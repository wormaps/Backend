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
      glbBuilderService,
      googlePlacesClient,
      overpassClient,
      qualityGateService,
      appLoggerService,
    } = context!;

    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);

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
    expect(twin.sceneId).toBe(scene.sceneId);
    expect(twin.sourceSnapshots.snapshots).toHaveLength(6);
    expect(twin.sourceSnapshots.snapshots[0]?.kind).toBe('PLACE_SEARCH_QUERY');
    expect(twin.sourceSnapshots.snapshots[0]?.request.method).toBe('POST');
    expect(twin.spatialFrame.localFrame).toBe('ENU');
    expect(twin.spatialFrame.verification.sampleCount).toBe(3);
    expect(twin.spatialFrame.terrain.mode).toBe('FLAT_PLACEHOLDER');
    expect(twin.entities.some((entity) => entity.kind === 'BUILDING')).toBe(
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

  it('reuses the same scene for identical query and scale', async () => {
    const { generationService, googlePlacesClient, overpassClient } = context!;
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);

    const first = await generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
    );
    const second = await generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
    );

    expect(second.sceneId).toBe(first.sceneId);
    expect(googlePlacesClient.searchText).toHaveBeenCalledTimes(1);
  });

  it('creates a fresh scene when forceRegenerate is enabled', async () => {
    const { generationService, googlePlacesClient, overpassClient } = context!;
    googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);

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
    expect(googlePlacesClient.searchText).toHaveBeenCalledTimes(2);
  });

  it('marks scene as failed after retry exhaustion', async () => {
    const { generationService, readService, googlePlacesClient } = context!;
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
    expect(googlePlacesClient.searchText).toHaveBeenCalledTimes(2);
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
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
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
    expect(googlePlacesClient.searchText).toHaveBeenCalledTimes(1);

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
    overpassClient.buildPlacePackage.mockResolvedValue(placePackage);

    const small = await generationService.createScene(
      'Seoul City Hall Small',
      'SMALL',
    );
    await generationService.waitForIdle();
    const smallBounds =
      overpassClient.buildPlacePackage.mock.calls[0]?.[1]?.bounds;

    overpassClient.buildPlacePackage.mockClear();

    const large = await generationService.createScene(
      'Seoul City Hall Large',
      'LARGE',
    );
    await generationService.waitForIdle();
    const largeBounds =
      overpassClient.buildPlacePackage.mock.calls[0]?.[1]?.bounds;

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
