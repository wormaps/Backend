import { GooglePlacesClient } from './google-places.client';
import { AppException } from '../../common/errors/app.exception';
import { ERROR_CODES } from '../../common/constants/error-codes';

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

  describe('error scenarios', () => {
    it('should throw AppException on 429 rate limit response', async () => {
      const fetcher = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Too Many Requests'),
      });

      const client = new GooglePlacesClient().withFetcher(
        fetcher as typeof fetch,
      );

      await expect(client.searchText('test', 5)).rejects.toThrow(AppException);
      try {
        await client.searchText('test', 5);
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe(
          ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
        );
      }
    });

    it('should throw AppException on 500 server error', async () => {
      const fetcher = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const client = new GooglePlacesClient().withFetcher(
        fetcher as typeof fetch,
      );

      await expect(client.searchText('test', 5)).rejects.toThrow(AppException);
      try {
        await client.searchText('test', 5);
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe(
          ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
        );
      }
    });

    it('should throw AppException on network error (ECONNREFUSED)', async () => {
      const fetcher = jest
        .fn()
        .mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:443'));

      const client = new GooglePlacesClient().withFetcher(
        fetcher as typeof fetch,
      );

      await expect(client.searchText('test', 5)).rejects.toThrow(AppException);
      try {
        await client.searchText('test', 5);
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe(
          ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
        );
      }
    });

    it('should throw AppException on timeout', async () => {
      const fetcher = jest
        .fn()
        .mockRejectedValue(new Error('The operation timed out.'));

      const client = new GooglePlacesClient().withFetcher(
        fetcher as typeof fetch,
      );

      await expect(client.searchText('test', 5)).rejects.toThrow(AppException);
      try {
        await client.searchText('test', 5);
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe(
          ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
        );
      }
    });

    it('should throw AppException on malformed JSON response', async () => {
      const fetcher = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('not valid json {{{'),
      });

      const client = new GooglePlacesClient().withFetcher(
        fetcher as typeof fetch,
      );

      await expect(client.searchText('test', 5)).rejects.toThrow(AppException);
      try {
        await client.searchText('test', 5);
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe(
          ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
        );
      }
    });
  });
});
