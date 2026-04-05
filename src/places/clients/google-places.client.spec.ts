import { GooglePlacesClient } from './google-places.client';

describe('GooglePlacesClient', () => {
  const originalApiKey = process.env.GOOGLE_API_KEY;

  beforeEach(() => {
    process.env.GOOGLE_API_KEY = 'test-key';
  });

  afterAll(() => {
    process.env.GOOGLE_API_KEY = originalApiKey;
  });

  it('should map text search results', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            places: [
              {
                id: 'abc123',
                displayName: { text: 'Gangnam Station' },
                formattedAddress: 'Gangnam-daero, Seoul',
                location: { latitude: 37.4979, longitude: 127.0276 },
                primaryType: 'subway_station',
                types: ['subway_station', 'transit_station'],
                googleMapsUri: 'https://maps.google.com/?cid=1',
              },
            ],
          }),
        ),
    });

    const client = new GooglePlacesClient().withFetcher(
      fetcher as typeof fetch,
    );
    const result = await client.searchText('gangnam station', 5);

    expect(result).toEqual([
      expect.objectContaining({
        provider: 'GOOGLE_PLACES',
        placeId: 'abc123',
        displayName: 'Gangnam Station',
        location: { lat: 37.4979, lng: 127.0276 },
        primaryType: 'subway_station',
      }),
    ]);
  });

  it('should normalize place detail viewport fallback to lat/lng', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            id: 'abc123',
            displayName: { text: 'Gangnam Station' },
            formattedAddress: 'Gangnam-daero, Seoul',
            location: { latitude: 37.4979, longitude: 127.0276 },
            primaryType: 'subway_station',
            types: ['subway_station', 'transit_station'],
            googleMapsUri: 'https://maps.google.com/?cid=1',
            viewport: {
              high: { latitude: 37.4981, longitude: 127.0279 },
            },
          }),
        ),
    });

    const client = new GooglePlacesClient().withFetcher(
      fetcher as typeof fetch,
    );
    const result = await client.getPlaceDetail('abc123');

    expect(result.location).toEqual({ lat: 37.4979, lng: 127.0276 });
    expect(result.viewport?.northEast.lat).toBeCloseTo(37.4981, 6);
    expect(result.viewport?.northEast.lng).toBeCloseTo(127.0279, 6);
    expect(result.viewport?.southWest.lat).toBeCloseTo(37.4959, 6);
    expect(result.viewport?.southWest.lng).toBeCloseTo(127.0256, 6);
  });
});
