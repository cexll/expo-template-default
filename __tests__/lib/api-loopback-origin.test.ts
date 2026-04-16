describe('loopback API origin resolution', () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const originalApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalWindow = global.window;

  function mockWindowHost(hostname: string) {
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: {
        location: {
          hostname,
        },
      },
    });
  }

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    jest.clearAllMocks();

    if (originalApiUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    }

    if (originalApiBaseUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }

    if (originalWindow === undefined) {
      delete (global as typeof globalThis & { window?: Window }).window;
    } else {
      Object.defineProperty(global, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it('matches auth API requests to the current 127.0.0.1 loopback host on web', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:18000';
    mockWindowHost('127.0.0.1');

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
      'http://127.0.0.1:18000/api/v1/auth/me',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      })
    );
  });

  it('keeps withApiBase callers aligned to the current localhost loopback host', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:18000';
    mockWindowHost('localhost');

    const { appConfig, withApiBase } = require('@/config/app') as typeof import('@/config/app');

    expect(appConfig.apiBaseUrl).toBe('http://localhost:18000');
    expect(withApiBase('/api/v1/auth/me')).toBe('http://localhost:18000/api/v1/auth/me');
  });
});
