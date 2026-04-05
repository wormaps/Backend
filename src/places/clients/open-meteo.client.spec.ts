import { OpenMeteoClient } from './open-meteo.client';
import { ExternalPlaceDetail } from '../types/external-place.types';

describe('OpenMeteoClient', () => {
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
});
