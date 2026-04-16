import { AppException } from '../../common/errors/app.exception';
import { ERROR_CODES } from '../../common/constants/error-codes';
import { MapillaryClient } from './mapillary.client';

describe('MapillaryClient', () => {
  const originalToken = process.env.MAPILLARY_ACCESS_TOKEN;

  beforeEach(() => {
    process.env.MAPILLARY_ACCESS_TOKEN = 'test-token';
  });

  afterAll(() => {
    process.env.MAPILLARY_ACCESS_TOKEN = originalToken;
  });

  it('maps nearby images and map features', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              data: [
                {
                  id: 'image-1',
                  captured_at: '2026-04-04T00:00:00Z',
                  compass_angle: 15,
                  computed_geometry: { coordinates: [127.0276, 37.4979] },
                  thumb_1024_url: 'https://example.com/thumb.jpg',
                  sequence: { id: 'sequence-1' },
                },
              ],
            }),
          ),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              data: [
                {
                  id: 'feature-1',
                  value: 'sign',
                  object_value: 'traffic_sign',
                  geometry: { coordinates: [127.0277, 37.498] },
                  images: [{ id: 'image-1' }],
                },
              ],
            }),
          ),
      });

    const client = new MapillaryClient().withFetcher(fetcher as typeof fetch);
    const bounds = {
      southWest: { lat: 37.497, lng: 127.027 },
      northEast: { lat: 37.499, lng: 127.029 },
    };

    const images = await client.getNearbyImages(bounds, 60, 'req-1');
    const features = await client.getMapFeaturesWithEnvelope(bounds, 100, 'req-1');

    expect(images).toEqual([
      expect.objectContaining({
        id: 'image-1',
        sequenceId: 'sequence-1',
      }),
    ]);
    expect(features.features).toEqual([
      expect.objectContaining({
        id: 'feature-1',
        type: 'sign',
      }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  describe('error scenarios', () => {
    const bounds = {
      southWest: { lat: 37.497, lng: 127.027 },
      northEast: { lat: 37.499, lng: 127.029 },
    };

    it('throws AppException on 429 rate limit response', async () => {
      const fetcher = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Too Many Requests'),
      });
      const client = new MapillaryClient().withFetcher(fetcher as typeof fetch);

      await expect(
        client.getMapFeaturesWithEnvelope(bounds, 100, 'req-1'),
      ).rejects.toThrow(AppException);
      try {
        await client.getMapFeaturesWithEnvelope(bounds, 100, 'req-1');
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe(
          ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
        );
      }
    });

    it('throws AppException on malformed JSON response', async () => {
      const fetcher = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('not valid json {{{'),
      });
      const client = new MapillaryClient().withFetcher(fetcher as typeof fetch);

      await expect(
        client.getNearbyImages(bounds, 60, 'req-1'),
      ).rejects.toThrow(AppException);
      try {
        await client.getNearbyImages(bounds, 60, 'req-1');
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe(
          ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
        );
      }
    });
  });
});
