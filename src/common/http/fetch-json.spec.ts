import { AppException } from '../errors/app.exception';
import { fetchJsonWithEnvelope } from './fetch-json';

describe('fetchJsonWithEnvelope', () => {
  it('adds sanitized upstream envelope to AppException detail on non-ok response', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () =>
        Promise.resolve(JSON.stringify({ error: { message: 'boom' } })),
    });

    try {
      await fetchJsonWithEnvelope(
        {
          provider: 'Spec Provider',
          url: 'https://example.com/data?key=secret',
          init: {
            headers: {
              Authorization: 'Bearer secret-token',
            },
          },
        },
        fetcher as typeof fetch,
      );
      throw new Error('expected AppException');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      const detail = (error as AppException).detail as {
        upstreamEnvelope?: {
          url?: string;
          request?: { headers?: Record<string, string> };
          response?: { status?: number };
        };
      };
      expect(detail.upstreamEnvelope?.url).toBe(
        'https://example.com/data?key=%5Bredacted%5D',
      );
      expect(detail.upstreamEnvelope?.request?.headers?.Authorization).toBe(
        '[redacted]',
      );
      expect(detail.upstreamEnvelope?.response?.status).toBe(500);
    }
  });
});
