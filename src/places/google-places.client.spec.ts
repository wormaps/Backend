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
                location: { lat: 37.4979, lng: 127.0276 },
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
        primaryType: 'subway_station',
      }),
    ]);
  });
});
