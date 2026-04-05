import { TomTomTrafficClient } from './tomtom-traffic.client';

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
});
