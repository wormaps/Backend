import { AppException } from '../errors/app.exception';
import { fetchJsonWithEnvelope } from './fetch-json';

describe('fetchJsonWithEnvelope retry', () => {
  it('retries 429 responses and honors Retry-After', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'retry-after' ? '0' : null),
        },
        text: () => Promise.resolve('Too Many Requests'),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => null,
        },
        text: () => Promise.resolve(JSON.stringify({ ok: true })),
      });

    const result = await fetchJsonWithEnvelope<{ ok: boolean }>(
      {
        provider: 'Spec Provider',
        url: 'https://example.com/data',
        retryCount: 1,
      },
      fetcher as typeof fetch,
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual({ ok: true });
    expect(result.envelope.response.status).toBe(200);
  });

  it('throws after retries are exhausted', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'retry-after' ? '0' : null),
      },
      text: () => Promise.resolve('Too Many Requests'),
    });

    await expect(
      fetchJsonWithEnvelope(
        {
          provider: 'Spec Provider',
          url: 'https://example.com/data',
          retryCount: 0,
        },
        fetcher as typeof fetch,
      ),
    ).rejects.toBeInstanceOf(AppException);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
