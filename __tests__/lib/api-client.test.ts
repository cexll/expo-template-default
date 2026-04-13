import { ApiClientError, fetchJson } from '@/lib/api/client';

describe('fetchJson', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns parsed payload on success', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({
        data: { status: 'ok' },
        meta: { env: 'test' },
        ok: true,
      }),
      ok: true,
      status: 200,
    } as unknown as Response);

    await expect(fetchJson<{ status: string }>('/api/health')).resolves.toEqual({
      data: { status: 'ok' },
      meta: { env: 'test' },
      ok: true,
    });
  });

  it('rejects network failures with normalized client error', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

    await expect(fetchJson('/api/health')).rejects.toMatchObject<ApiClientError>({
      message: 'Network request failed',
      name: 'ApiClientError',
      status: 0,
    });
  });

  it('rejects non-2xx responses with server message', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({ error: 'teapot' }),
      ok: false,
      status: 418,
    } as unknown as Response);

    await expect(fetchJson('/api/health')).rejects.toMatchObject<ApiClientError>({
      message: 'teapot',
      name: 'ApiClientError',
      status: 418,
    });
  });

  it('rejects invalid json in successful responses', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
      ok: true,
      status: 200,
    } as unknown as Response);

    await expect(fetchJson('/api/health')).rejects.toMatchObject<ApiClientError>({
      message: 'Invalid JSON response',
      name: 'ApiClientError',
      status: 200,
    });
  });
});
