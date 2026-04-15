describe('RootLayout console behavior', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('does not patch console.error at module evaluation time', () => {
    const originalConsoleError = console.error;

    jest.isolateModules(() => {
      jest.doMock('expo-router', () => {
        const React = require('react');
        const Stack = Object.assign(
          ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
          {
            Screen: () => null,
          }
        );

        return { Stack };
      });

      jest.doMock('@/components/app-error-boundary', () => ({
        AppErrorBoundary: () => null,
      }));

      jest.doMock('@/components/AuthGuard', () => ({
        AuthGuard: () => null,
      }));

      jest.doMock('@/providers/app-providers', () => ({
        AppProviders: ({ children }: { children?: React.ReactNode }) => children ?? null,
      }));

      require('@/app/_layout');
    });

    expect(console.error).toBe(originalConsoleError);
  });
});
