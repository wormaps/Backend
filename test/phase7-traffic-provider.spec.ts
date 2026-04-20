import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'bun:test';
import { SceneTrafficLiveService } from '../src/scene/services/live/scene-traffic-live.service';
import { SceneReadService } from '../src/scene/services/read/scene-read.service';
import { SceneRepository } from '../src/scene/storage/scene.repository';
import { TtlCacheService } from '../src/cache/ttl-cache.service';
import { TomTomTrafficClient } from '../src/places/clients/tomtom-traffic.client';
import { AppLoggerService } from '../src/common/logging/app-logger.service';

describe('Phase 7.2 traffic provider fallback', () => {
  let sceneTrafficLiveService: SceneTrafficLiveService;
  let sceneReadService: {
    getReadyScene: ReturnType<typeof vi.fn>;
  };
  let sceneRepository: {
    update: ReturnType<typeof vi.fn>;
  };
  let tomTomTrafficClient: {
    getFlowSegmentWithEnvelope: ReturnType<typeof vi.fn>;
  };
  let appLoggerService: {
    warn: ReturnType<typeof vi.fn>;
  };

  const readyScene = {
    requestId: 'req-1',
    meta: {
      roads: [
        {
          objectId: 'road-1',
          center: { lat: 37.5665, lng: 126.978 },
        },
      ],
    },
    latestTrafficSnapshot: undefined,
  };

  beforeEach(() => {
    sceneReadService = {
      getReadyScene: vi.fn().mockResolvedValue(readyScene),
    };
    sceneRepository = {
      update: vi.fn().mockResolvedValue(undefined),
    };
    tomTomTrafficClient = {
      getFlowSegmentWithEnvelope: vi.fn(),
    };
    appLoggerService = {
      warn: vi.fn(),
    };

    sceneTrafficLiveService = new SceneTrafficLiveService(
      sceneReadService as unknown as SceneReadService,
      sceneRepository as unknown as SceneRepository,
      new TtlCacheService(100, undefined),
      tomTomTrafficClient as unknown as TomTomTrafficClient,
      appLoggerService as unknown as AppLoggerService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TOMTOM_API_KEY;
  });

  it('returns provider UNAVAILABLE when TOMTOM_API_KEY is missing', async () => {
    delete process.env.TOMTOM_API_KEY;

    const result = await sceneTrafficLiveService.getTraffic('scene-1');

    expect(result.provider).toBe('UNAVAILABLE');
    expect(result.failedSegmentCount).toBe(1);
    expect(appLoggerService.warn).toHaveBeenCalled();
    expect(sceneRepository.update).toHaveBeenCalled();
  });

  it('returns provider TOMTOM when TomTom API succeeds', async () => {
    process.env.TOMTOM_API_KEY = 'test-key';
    tomTomTrafficClient.getFlowSegmentWithEnvelope.mockResolvedValue({
      data: {
        flowSegmentData: {
          currentSpeed: 24,
          freeFlowSpeed: 30,
          confidence: 0.8,
          roadClosure: false,
        },
      },
      upstreamEnvelopes: [],
    });

    const result = await sceneTrafficLiveService.getTraffic('scene-1');

    expect(result.provider).toBe('TOMTOM');
    expect(result.failedSegmentCount).toBe(0);
  });

  it('never returns MVP_SYNTHETIC_RULES provider', async () => {
    delete process.env.TOMTOM_API_KEY;

    const result = await sceneTrafficLiveService.getTraffic('scene-1');

    expect(result.provider).not.toBe('MVP_SYNTHETIC_RULES');
  });

  it('returns provider TOMTOM when API key exists and calls TomTom', async () => {
    process.env.TOMTOM_API_KEY = 'test-key';
    tomTomTrafficClient.getFlowSegmentWithEnvelope.mockResolvedValue({
      data: {
        flowSegmentData: {
          currentSpeed: 18,
          freeFlowSpeed: 30,
          confidence: 0.75,
          roadClosure: false,
        },
      },
      upstreamEnvelopes: [],
    });

    const sampled = await sceneTrafficLiveService.sampleTrafficByRoads([
      {
        objectId: 'road-1',
        center: { lat: 37.5665, lng: 126.978 },
      },
    ]);

    expect(sampled.provider).toBe('TOMTOM');
    expect(tomTomTrafficClient.getFlowSegmentWithEnvelope).toHaveBeenCalled();
  });
});
