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
});
