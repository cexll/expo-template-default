describe('token storage (web)', () => {
  const originalLocalStorage = globalThis.localStorage;
  const originalIndexedDB = (globalThis as any).indexedDB;

  afterEach(() => {
    jest.resetModules();
    (globalThis as any).indexedDB = originalIndexedDB;
    // @ts-expect-error test shim
    globalThis.localStorage = originalLocalStorage;
    jest.dontMock('react-native');
  });

  it('does not persist auth tokens to localStorage on web', async () => {
    jest.resetModules();

    const setItem = jest.fn();
    const getItem = jest.fn();
    const removeItem = jest.fn();

    // @ts-expect-error test shim
    globalThis.localStorage = { setItem, getItem, removeItem };

    // Intentionally leave indexedDB unavailable; implementation should not fall back to localStorage.
    (globalThis as any).indexedDB = undefined;

    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }));

     
    const tokenStorage = require('@/lib/auth/token-storage') as typeof import('@/lib/auth/token-storage');
    await tokenStorage.saveTokens({ accessToken: 'a1', refreshToken: 'r1', expiresIn: 3600 });

    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});
