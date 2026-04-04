import { OverpassClient } from './overpass.client';
import { ExternalPlaceDetail } from './external-place.types';

describe('OverpassClient', () => {
  it('should convert overpass response to place package', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            elements: [
              {
                type: 'way',
                id: 1,
                tags: {
                  building: 'yes',
                  name: 'Tower',
                  'building:levels': '10',
                },
                geometry: [
                  { lat: 37.1, lon: 127.1 },
                  { lat: 37.2, lon: 127.1 },
                  { lat: 37.2, lon: 127.2 },
                ],
              },
              {
                type: 'way',
                id: 2,
                tags: { highway: 'primary', name: 'Main Road', lanes: '4' },
                geometry: [
                  { lat: 37.1, lon: 127.1 },
                  { lat: 37.2, lon: 127.2 },
                ],
              },
              {
                type: 'node',
                id: 3,
                lat: 37.15,
                lon: 127.15,
                tags: { tourism: 'attraction', name: 'Landmark' },
              },
            ],
          }),
        ),
    });
    const client = new OverpassClient().withFetcher(fetcher as typeof fetch);
    const place: ExternalPlaceDetail = {
      provider: 'GOOGLE_PLACES',
      placeId: 'abc123',
      displayName: 'Test',
      formattedAddress: null,
      location: { lat: 37.15, lng: 127.15 },
      primaryType: null,
      types: [],
      googleMapsUri: null,
      viewport: {
        northEast: { lat: 37.3, lng: 127.3 },
        southWest: { lat: 37.0, lng: 127.0 },
      },
      utcOffsetMinutes: null,
    };

    const result = await client.buildPlacePackage(place);

    expect(result.placeId).toBe('abc123');
    expect(result.buildings).toHaveLength(1);
    expect(result.roads).toHaveLength(1);
    expect(result.landmarks).toHaveLength(1);
  });
});
