import { join } from 'node:path';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'bun:test';
import { SceneController } from '../src/scene/scene.controller';
import { getSceneDataDir } from '../src/scene/storage/scene-storage.utils';
import {
  cleanupSceneSpecContext,
  createSceneSpecContext,
  placeDetail,
  placePackage,
  type SceneSpecContext,
} from '../src/scene/scene.service.spec.fixture';

describe('Phase 6 scene integration', () => {
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

  function seedHappyPathMocks(target: SceneSpecContext): void {
    target.googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    target.googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    target.googlePlacesClient.searchTextWithEnvelope.mockResolvedValue({
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
    target.googlePlacesClient.getPlaceDetailWithEnvelope.mockResolvedValue({
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
    target.overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    target.overpassClient.buildPlacePackageWithTrace.mockResolvedValue({
      placePackage,
      upstreamEnvelopes: [],
    });
  }

  it('creates a scene, reads it back, and serves the GLB download path', async () => {
    const target = context!;
    seedHappyPathMocks(target);

    const scene = await target.generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();

    const readScene = await target.readService.getScene(scene.sceneId);
    const bootstrap = await target.readService.getBootstrap(scene.sceneId);
    const controller = new SceneController(target.service);
    const sendFile = vi.fn();
    const response = { sendFile } as any;

    await controller.getSceneAsset(scene.sceneId, response);

    expect(readScene.status).toBe('READY');
    expect(bootstrap.assetUrl).toBe(
      '/api/scenes/scene-seoul-city-hall/assets/base.glb',
    );
    expect(sendFile).toHaveBeenCalledWith(
      join(getSceneDataDir(), 'scene-seoul-city-hall.glb'),
    );
  });

  it('reuses the same scene for an identical query and scale', async () => {
    const target = context!;
    seedHappyPathMocks(target);

    const first = await target.generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
    );
    const second = await target.generationService.createScene(
      'Seoul City Hall',
      'MEDIUM',
    );

    expect(second.sceneId).toBe(first.sceneId);
    expect(target.googlePlacesClient.searchTextWithEnvelope).toHaveBeenCalledTimes(
      1,
    );
  });

  it('deduplicates concurrent createScene calls for the same query', async () => {
    const target = context!;
    seedHappyPathMocks(target);

    const [first, second] = await Promise.all([
      target.generationService.createScene('Seoul City Hall', 'MEDIUM'),
      target.generationService.createScene('Seoul City Hall', 'MEDIUM'),
    ]);

    await target.generationService.waitForIdle();

    expect(first.sceneId).toBe(second.sceneId);
    expect(target.googlePlacesClient.searchTextWithEnvelope).toHaveBeenCalledTimes(
      1,
    );
  });

  it('retries a pipeline failure and succeeds on the second attempt', async () => {
    const target = context!;
    target.googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    target.googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    target.googlePlacesClient.searchTextWithEnvelope
      .mockRejectedValueOnce(new Error('temporary google failure'))
      .mockResolvedValueOnce({
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
    target.googlePlacesClient.getPlaceDetailWithEnvelope.mockResolvedValue({
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
    target.overpassClient.buildPlacePackage.mockResolvedValue(placePackage);
    target.overpassClient.buildPlacePackageWithTrace.mockResolvedValue({
      placePackage,
      upstreamEnvelopes: [],
    });

    const scene = await target.generationService.createScene(
      'Retry Place',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();
    const readScene = await target.readService.getScene(scene.sceneId);

    expect(readScene.status).toBe('READY');
    expect(target.googlePlacesClient.searchTextWithEnvelope).toHaveBeenCalledTimes(
      2,
    );
  });

  it('fails when Google Places keeps failing', async () => {
    const target = context!;
    target.googlePlacesClient.searchText.mockRejectedValue(
      new Error('google places unavailable'),
    );
    target.googlePlacesClient.getPlaceDetail.mockRejectedValue(
      new Error('google places unavailable'),
    );
    target.googlePlacesClient.searchTextWithEnvelope.mockRejectedValue(
      new Error('google places unavailable'),
    );
    target.googlePlacesClient.getPlaceDetailWithEnvelope.mockRejectedValue(
      new Error('google places unavailable'),
    );

    const scene = await target.generationService.createScene(
      'Google Failure Place',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();
    const readScene = await target.readService.getScene(scene.sceneId);

    expect(readScene.status).toBe('FAILED');
    expect(readScene.failureCategory).toBe('GENERATION_ERROR');
    expect(target.googlePlacesClient.searchTextWithEnvelope).toHaveBeenCalledTimes(
      2,
    );
  });

  it('fails when Overpass keeps failing', async () => {
    const target = context!;
    target.googlePlacesClient.searchText.mockResolvedValue([placeDetail]);
    target.googlePlacesClient.getPlaceDetail.mockResolvedValue(placeDetail);
    target.googlePlacesClient.searchTextWithEnvelope.mockResolvedValue({
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
    target.googlePlacesClient.getPlaceDetailWithEnvelope.mockResolvedValue({
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
    target.overpassClient.buildPlacePackage.mockRejectedValue(
      new Error('overpass unavailable'),
    );
    target.overpassClient.buildPlacePackageWithTrace.mockRejectedValue(
      new Error('overpass unavailable'),
    );

    const scene = await target.generationService.createScene(
      'Overpass Failure Place',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();
    const readScene = await target.readService.getScene(scene.sceneId);

    expect(readScene.status).toBe('FAILED');
    expect(readScene.failureCategory).toBe('GENERATION_ERROR');
    expect(target.overpassClient.buildPlacePackageWithTrace).toHaveBeenCalledTimes(
      2,
    );
  });

  it('fails when GLB build keeps failing', async () => {
    const target = context!;
    seedHappyPathMocks(target);
    target.glbBuilderService.build.mockRejectedValue(new Error('glb build failed'));

    const scene = await target.generationService.createScene(
      'GLB Failure Place',
      'MEDIUM',
    );
    await target.generationService.waitForIdle();
    const readScene = await target.readService.getScene(scene.sceneId);

    expect(readScene.status).toBe('FAILED');
    expect(readScene.failureCategory).toBe('GENERATION_ERROR');
    expect(target.glbBuilderService.build).toHaveBeenCalledTimes(2);
  });
});
