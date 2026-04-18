import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'bun:test';
import { PlaceSnapshotService } from '../src/places/services/snapshot/place-snapshot.service';
import { PlaceCatalogService } from '../src/places/services/catalog/place-catalog.service';
import { SnapshotBuilderService } from '../src/places/snapshot/snapshot-builder.service';
import { GooglePlacesClient } from '../src/places/clients/google-places.client';
import { OpenMeteoClient } from '../src/places/clients/open-meteo.client';
import { SceneStateLiveService } from '../src/scene/services/live/scene-state-live.service';
import { SceneReadService } from '../src/scene/services/read/scene-read.service';
import { TtlCacheService } from '../src/cache/ttl-cache.service';
import type { ExternalPlaceDetail } from '../src/places/types/external-place.types';

const PLACE: ExternalPlaceDetail = {
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

describe('Phase 7.1 weather provider fallback', () => {
  let placeSnapshotService: PlaceSnapshotService;
  let googlePlacesClient: {
    getPlaceDetail: ReturnType<typeof vi.fn>;
  };
  let openMeteoClient: {
    getObservation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    googlePlacesClient = {
      getPlaceDetail: vi.fn().mockResolvedValue(PLACE),
    };
    openMeteoClient = {
      getObservation: vi.fn(),
    };
    placeSnapshotService = new PlaceSnapshotService(
      new PlaceCatalogService(),
      new SnapshotBuilderService(),
      googlePlacesClient as unknown as GooglePlacesClient,
      openMeteoClient as unknown as OpenMeteoClient,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns provider UNKNOWN when OpenMeteo call throws', async () => {
    openMeteoClient.getObservation.mockRejectedValueOnce(
      new Error('open-meteo outage'),
    );

    const result = await placeSnapshotService.getExternalSceneSnapshot(
      'google-place-id',
      'DAY',
      undefined,
      '2026-04-19',
    );

    expect(result.weatherObservation).toBeNull();
    expect(result.snapshot.sourceDetail?.provider).toBe('UNKNOWN');
  });

  it('returns provider UNKNOWN when weather is manually specified', async () => {
    const result = await placeSnapshotService.getExternalSceneSnapshot(
      'google-place-id',
      'DAY',
      'CLEAR',
      '2026-04-19',
    );

    expect(openMeteoClient.getObservation).not.toHaveBeenCalled();
    expect(result.snapshot.sourceDetail?.provider).toBe('UNKNOWN');
  });

  it('returns provider OPEN_METEO when observation exists', async () => {
    openMeteoClient.getObservation.mockResolvedValueOnce({
      date: '2026-04-19',
      localTime: '2026-04-19T12:00',
      temperatureCelsius: 17.2,
      precipitationMm: 0,
      rainMm: 0,
      snowfallCm: 0,
      cloudCoverPercent: 20,
      resolvedWeather: 'CLEAR',
      source: 'OPEN_METEO_CURRENT',
    });

    const result = await placeSnapshotService.getExternalSceneSnapshot(
      'google-place-id',
      'DAY',
      undefined,
      '2026-04-19',
    );

    expect(result.snapshot.sourceDetail?.provider).toBe('OPEN_METEO');
  });
});

describe('Phase 7.1 scene state provider fallback', () => {
  let sceneStateLiveService: SceneStateLiveService;
  let sceneReadService: {
    getReadyScene: ReturnType<typeof vi.fn>;
  };
  let openMeteoClient: {
    getObservation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    sceneReadService = {
      getReadyScene: vi.fn().mockResolvedValue({
        scene: {
          sceneId: 'scene-seoul-city-hall',
          status: 'READY',
        },
        place: {
          ...PLACE,
        },
        latestWeatherSnapshot: undefined,
        twin: {
          entities: [],
          components: [],
        },
      }),
    };
    openMeteoClient = {
      getObservation: vi.fn(),
    };

    sceneStateLiveService = new SceneStateLiveService(
      sceneReadService as unknown as SceneReadService,
      new TtlCacheService(100, undefined),
      openMeteoClient as unknown as OpenMeteoClient,
      new SnapshotBuilderService(),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns sourceDetail UNKNOWN when OpenMeteo call throws', async () => {
    openMeteoClient.getObservation.mockRejectedValueOnce(
      new Error('open-meteo outage'),
    );

    const state = await sceneStateLiveService.getState('scene-seoul-city-hall', {
      timeOfDay: 'DAY',
    });

    expect(state.sourceDetail?.provider).toBe('UNKNOWN');
  });

  it('returns sourceDetail OPEN_METEO when fresh snapshot exists', async () => {
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const snapshotLocalTime = `${today}T12:00`;

    sceneReadService.getReadyScene.mockResolvedValueOnce({
      scene: {
        sceneId: 'scene-seoul-city-hall',
        status: 'READY',
      },
      place: {
        ...PLACE,
      },
      latestWeatherSnapshot: {
        provider: 'OPEN_METEO_HISTORICAL',
        date: today,
        localTime: snapshotLocalTime,
        resolvedWeather: 'CLOUDY',
        temperatureCelsius: 13.2,
        precipitationMm: 0,
        capturedAt: nowIso,
      },
      twin: {
        entities: [],
        components: [],
      },
    });

    const state = await sceneStateLiveService.getState('scene-seoul-city-hall', {
      date: today,
      timeOfDay: 'DAY',
    });

    expect(state.sourceDetail?.provider).toBe('OPEN_METEO');
    expect(openMeteoClient.getObservation).not.toHaveBeenCalled();
  });

  it('never returns MVP_SYNTHETIC_RULES in sourceDetail provider', async () => {
    openMeteoClient.getObservation.mockRejectedValueOnce(new Error('outage'));

    const state = await sceneStateLiveService.getState('scene-seoul-city-hall', {
      timeOfDay: 'DAY',
    });

    expect(state.sourceDetail?.provider).not.toBe('MVP_SYNTHETIC_RULES');
  });
});
