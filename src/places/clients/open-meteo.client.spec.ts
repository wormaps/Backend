import { OpenMeteoClient } from './open-meteo.client';
import { ExternalPlaceDetail } from '../types/external-place.types';

describe('OpenMeteoClient', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should resolve snow from hourly observation', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            hourly: {
              time: ['2026-04-04T22:00'],
              temperature_2m: [-2],
              precipitation: [1],
              rain: [0],
              snowfall: [1.4],
              cloud_cover: [98],
            },
          }),
        ),
    });
    const client = new OpenMeteoClient().withFetcher(fetcher as typeof fetch);
    const place: ExternalPlaceDetail = {
      provider: 'GOOGLE_PLACES',
      placeId: 'abc123',
      displayName: 'Test',
      formattedAddress: null,
      location: { lat: 37.4979, lng: 127.0276 },
      primaryType: null,
      types: [],
      googleMapsUri: null,
      viewport: null,
      utcOffsetMinutes: null,
    };

    const observation = await client.getHistoricalObservation(
      place,
      '2026-04-04',
      'NIGHT',
    );

    expect(observation?.resolvedWeather).toBe('SNOW');
    expect(observation?.localTime).toBe('2026-04-04T22:00');
  });

  it('should use current weather for today in place local time', async () => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('2026-04-06T01:00:00.000Z').getTime());
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            current: {
              time: '2026-04-06T10:00',
              temperature_2m: 17.4,
              precipitation: 0,
              rain: 0,
              snowfall: 0,
              cloud_cover: 18,
            },
          }),
        ),
    });
    const client = new OpenMeteoClient().withFetcher(fetcher as typeof fetch);
    const place: ExternalPlaceDetail = {
      provider: 'GOOGLE_PLACES',
      placeId: 'abc123',
      displayName: 'Test',
      formattedAddress: null,
      location: { lat: 37.4979, lng: 127.0276 },
      primaryType: null,
      types: [],
      googleMapsUri: null,
      viewport: null,
      utcOffsetMinutes: 540,
    };

    const observation = await client.getObservation(place, '2026-04-06', 'DAY');

    expect(observation?.source).toBe('OPEN_METEO_CURRENT');
    expect(observation?.temperatureCelsius).toBe(17.4);
    expect(observation?.resolvedWeather).toBe('CLEAR');
  });
});
