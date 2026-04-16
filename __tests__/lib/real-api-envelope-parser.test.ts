import { ApiError, AuthError, api } from '@/lib/api';

jest.mock('@/lib/auth/token-storage', () => ({
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
  isWebSessionBootstrapBlocked: jest.fn(() => false),
  blockWebSessionBootstrap: jest.fn(),
  clearWebSessionBootstrapBlock: jest.fn(),
}));

const tokenStorage = require('@/lib/auth/token-storage') as {
  getAccessToken: jest.Mock<Promise<string | null>, []>;
  getRefreshToken: jest.Mock<Promise<string | null>, []>;
  saveTokens: jest.Mock<Promise<void>, [{ accessToken: string; refreshToken: string; expiresIn: number }]>;
  clearTokens: jest.Mock<Promise<void>, []>;
};

function mockResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  const ok = init?.ok ?? true;
  const status = init?.status ?? (ok ? 200 : 500);
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('real api.ts envelope parser', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('unwraps auth token envelope and preserves snake_case fields', async () => {
    tokenStorage.getAccessToken.mockResolvedValue(null);

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      mockResponse({
        code: 0,
        message: 'ok',
        data: {
          access_token: 'access_1',
          refresh_token: 'refresh_1',
          expires_in: 3600,
          is_new_user: true,
        },
      })
    );

    const data = await api.post<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      is_new_user: boolean;
    }>('/api/v1/auth/sms/verify', { phone: '13800000000', code: '123456' });

    expect(data).toMatchObject({
      access_token: 'access_1',
      refresh_token: 'refresh_1',
      expires_in: 3600,
      is_new_user: true,
    });
    expect((data as any).accessToken).toBeUndefined();
  });

  it('unwraps AI recognize envelope and preserves snake_case payload keys', async () => {
    tokenStorage.getAccessToken.mockResolvedValue('token_1');

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      mockResponse({
        code: 0,
        message: 'ok',
        data: {
          disease_type: 'thyroid',
          fields: {
            location: { value: '左叶中下段', confidence: 0.9 },
            size_x: { value: '8.3', confidence: 0.92 },
            tirads: { value: '3', confidence: 0.85 },
          },
        },
      })
    );

    const data = await api.post<{
      disease_type: string;
      fields: Record<string, { value: string; confidence: number }>;
    }>('/api/v1/ai/recognize', { disease_type: 'thyroid', images: ['BASE64_A'] });

    expect(data.disease_type).toBe('thyroid');
    expect(Object.keys(data.fields)).toEqual(expect.arrayContaining(['location', 'size_x', 'tirads']));
    expect(data.fields.size_x.value).toBe('8.3');
    expect((data as any).diseaseType).toBeUndefined();
  });

  it('unwraps subscription create-order envelope', async () => {
    tokenStorage.getAccessToken.mockResolvedValue('token_1');

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      mockResponse({
        code: 0,
        message: 'ok',
        data: { order_id: 'ord_1', provider: 'wechat', plan: 'yearly' },
      })
    );

    await expect(
      api.post<{ order_id: string; provider?: string; plan?: string }>('/api/v1/subscription/order', {
        plan: 'yearly',
        provider: 'wechat',
      })
    ).resolves.toMatchObject({ order_id: 'ord_1' });
  });

  it('throws ApiError when the shared envelope rejects the request', async () => {
    tokenStorage.getAccessToken.mockResolvedValue(null);

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      mockResponse(
        {
          code: 10010,
          message: 'nope',
          data: null,
        },
        { ok: true, status: 200 }
      )
    );

    await expect(api.get('/api/v1/subscription/status')).rejects.toMatchObject<ApiError>({
      name: 'ApiError',
      message: 'nope',
      code: 10010,
      status: 200,
    });
  });

  it('refreshes once on 401 and retries the original request with the rotated token', async () => {
    tokenStorage.getAccessToken.mockResolvedValueOnce('access_old').mockResolvedValueOnce('access_new');
    tokenStorage.getRefreshToken.mockResolvedValue('refresh_old');

    const fetchSpy = jest.spyOn(global, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(mockResponse({ code: 401, message: 'unauthorized', data: null }, { ok: false, status: 401 }))
      .mockResolvedValueOnce(
        mockResponse({
          code: 0,
          message: 'ok',
          data: { access_token: 'access_new', refresh_token: 'refresh_new', expires_in: 3600 },
        })
      )
      .mockResolvedValueOnce(mockResponse({ code: 0, message: 'ok', data: { ok: true } }));

    await expect(api.get<{ ok: boolean }>('/api/v1/auth/me')).resolves.toEqual({ ok: true });

    expect(tokenStorage.saveTokens).toHaveBeenCalledWith({
      accessToken: 'access_new',
      refreshToken: 'refresh_new',
      expiresIn: 3600,
    });

    const calls = fetchSpy.mock.calls;
    expect(calls).toHaveLength(3);

    const [, refreshInit] = calls[1] ?? [];
    expect(String(calls[1]?.[0])).toContain('/api/v1/auth/token/refresh');
    expect(refreshInit).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const [, retryInit] = calls[2] ?? [];
    expect(retryInit).toMatchObject({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer access_new',
      }),
    });
  });

  it('clears tokens and throws AuthError when refresh fails', async () => {
    tokenStorage.getAccessToken.mockResolvedValue('access_old');
    tokenStorage.getRefreshToken.mockResolvedValue(null);

    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(mockResponse({ code: 401, message: 'unauthorized', data: null }, { ok: false, status: 401 }));

    const promise = api.get('/api/v1/auth/me');
    await expect(promise).rejects.toBeInstanceOf(AuthError);
    await expect(promise).rejects.toMatchObject({ name: 'AuthError', message: 'Session expired' });
    expect(tokenStorage.clearTokens).toHaveBeenCalledTimes(1);
  });
});
