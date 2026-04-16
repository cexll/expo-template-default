describe('api web cookie session', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('sends credentials on web requests', async () => {
    jest.doMock('@/lib/auth/token-storage', () => ({
      getAccessToken: jest.fn(),
      getRefreshToken: jest.fn(),
      saveTokens: jest.fn(),
      clearTokens: jest.fn(),
      isWebSessionBootstrapBlocked: jest.fn(() => false),
      blockWebSessionBootstrap: jest.fn(),
      clearWebSessionBootstrapBlock: jest.fn(),
    }));

    const { Platform } = require('react-native') as typeof import('react-native');
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    const { api } = require('@/lib/api') as typeof import('@/lib/api');
    const tokenStorage = require('@/lib/auth/token-storage') as {
      getAccessToken: jest.Mock;
    };
    tokenStorage.getAccessToken.mockResolvedValue(null);

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 0, message: 'ok', data: { id: 'u1' } }),
    } as unknown as Response);

    await expect(api.get<{ id: string }>('/api/v1/auth/me')).resolves.toEqual({ id: 'u1' });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/me'),
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      })
    );
  });

  it('attempts cookie-based refresh on web 401s even without a readable access token', async () => {
    jest.doMock('@/lib/auth/token-storage', () => ({
      getAccessToken: jest.fn(),
      getRefreshToken: jest.fn(),
      saveTokens: jest.fn(),
      clearTokens: jest.fn(),
      isWebSessionBootstrapBlocked: jest.fn(() => false),
      blockWebSessionBootstrap: jest.fn(),
      clearWebSessionBootstrapBlock: jest.fn(),
    }));

    const { Platform } = require('react-native') as typeof import('react-native');
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    const { api } = require('@/lib/api') as typeof import('@/lib/api');
    const tokenStorage = require('@/lib/auth/token-storage') as {
      getAccessToken: jest.Mock;
      getRefreshToken: jest.Mock;
    };
    tokenStorage.getAccessToken.mockResolvedValue(null);
    tokenStorage.getRefreshToken.mockResolvedValue(null);

    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ code: 401, message: 'unauthorized', data: null }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          code: 0,
          message: 'ok',
          data: {
            access_token: 'access_2',
            refresh_token: 'refresh_2',
            expires_in: 3600,
          },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: 0, message: 'ok', data: { id: 'u1' } }),
      } as unknown as Response);

    await expect(api.get<{ id: string }>('/api/v1/auth/me')).resolves.toEqual({ id: 'u1' });

    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/v1/auth/token/refresh'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
    expect(tokenStorage.getRefreshToken).not.toHaveBeenCalled();
  });

  it('clears cookie-backed session via logout when web refresh fails', async () => {
    jest.doMock('@/lib/auth/token-storage', () => ({
      getAccessToken: jest.fn(),
      getRefreshToken: jest.fn(),
      saveTokens: jest.fn(),
      clearTokens: jest.fn(),
      isWebSessionBootstrapBlocked: jest.fn(() => false),
      blockWebSessionBootstrap: jest.fn(),
      clearWebSessionBootstrapBlock: jest.fn(),
    }));

    const { Platform } = require('react-native') as typeof import('react-native');
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    const { api, AuthError } = require('@/lib/api') as typeof import('@/lib/api');
    const tokenStorage = require('@/lib/auth/token-storage') as {
      getAccessToken: jest.Mock;
      clearTokens: jest.Mock;
      blockWebSessionBootstrap: jest.Mock;
      clearWebSessionBootstrapBlock: jest.Mock;
    };
    tokenStorage.getAccessToken.mockResolvedValue(null);

    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ code: 401, message: 'unauthorized', data: null }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ code: 401, message: 'refresh expired', data: null }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ code: 500, message: 'logout failed', data: null }),
      } as unknown as Response);

    const promise = api.get('/api/v1/auth/me');
    await expect(promise).rejects.toBeInstanceOf(AuthError);
    await expect(promise).rejects.toMatchObject({
      name: 'AuthError',
      message: 'Session expired',
    });

    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('/api/v1/auth/logout'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
    expect(tokenStorage.blockWebSessionBootstrap).toHaveBeenCalledTimes(1);
    expect(tokenStorage.clearWebSessionBootstrapBlock).not.toHaveBeenCalled();
    expect(tokenStorage.clearTokens).toHaveBeenCalledTimes(1);
  });
});
