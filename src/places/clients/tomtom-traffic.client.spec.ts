import { TomTomTrafficClient } from './tomtom-traffic.client';
import { AppException } from '../../common/errors/app.exception';
import { ERROR_CODES } from '../../common/constants/error-codes';

describe('TomTomTrafficClient', () => {
  const originalApiKey = process.env.TOMTOM_API_KEY;

  beforeEach(() => {
    process.env.TOMTOM_API_KEY = 'test-key';
  });

  afterAll(() => {
    process.env.TOMTOM_API_KEY = originalApiKey;
  });

  it('should use the Korea traffic host for Korea coordinates', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            flowSegmentData: {
              currentSpeed: 19,
            },
          }),
        ),
    });

    const client = new TomTomTrafficClient().withFetcher(
      fetcher as typeof fetch,
    );
    await client.getFlowSegment({ lat: 37.4979, lng: 127.0276 });

    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://kr-api.tomtom.com/traffic/services/4/flowSegmentData/absolute/14/json',
      ),
      expect.anything(),
    );
  });

  it('should fall back to the global traffic host when the Korea host fails', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve('bad gateway'),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              flowSegmentData: {
                currentSpeed: 21,
                freeFlowSpeed: 28,
              },
            }),
          ),
      });

    const client = new TomTomTrafficClient().withFetcher(
      fetcher as typeof fetch,
    );
    const result = await client.getFlowSegment({ lat: 37.4979, lng: 127.0276 });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[0]).toContain('https://kr-api.tomtom.com/');
    expect(fetcher.mock.calls[1]?.[0]).toContain('https://api.tomtom.com/');
    expect(result?.flowSegmentData?.currentSpeed).toBe(21);
  });

  describe('error scenarios', () => {
    it('should throw AppException on 429 rate limit response from both hosts', async () => {
      const fetcher = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Too Many Requests'),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Too Many Requests'),
        });

      const client = new TomTomTrafficClient().withFetcher(
        fetcher as typeof fetch,
      );

      try {
        await client.getFlowSegment({ lat: 37.4979, lng: 127.0276 });
        throw new Error('Expected AppException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe(
          ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
        );
      }
    });

    it('should throw AppException on 500 server error from both hosts', async () => {
      const fetcher = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        });

      const client = new TomTomTrafficClient().withFetcher(
        fetcher as typeof fetch,
      );

      try {
        await client.getFlowSegment({ lat: 37.4979, lng: 127.0276 });
        throw new Error('Expected AppException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe(
          ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
        );
      }
    });

    it('should throw AppException on network error', async () => {
      const fetcher = jest
        .fn()
        .mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:443'));

      const client = new TomTomTrafficClient().withFetcher(
        fetcher as typeof fetch,
      );

      try {
        await client.getFlowSegment({ lat: 37.4979, lng: 127.0276 });
        throw new Error('Expected AppException to be thrown');
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

      const client = new TomTomTrafficClient().withFetcher(
        fetcher as typeof fetch,
      );

      try {
        await client.getFlowSegment({ lat: 37.4979, lng: 127.0276 });
        throw new Error('Expected AppException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe(
          ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
        );
      }
    });

    it('should throw AppException on malformed response', async () => {
      const fetcher = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('not valid json {{{'),
      });

      const client = new TomTomTrafficClient().withFetcher(
        fetcher as typeof fetch,
      );

      try {
        await client.getFlowSegment({ lat: 37.4979, lng: 127.0276 });
        throw new Error('Expected AppException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe(
          ERROR_CODES.EXTERNAL_API_REQUEST_FAILED,
        );
      }
    });
  });
});
