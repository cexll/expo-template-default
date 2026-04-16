describe('exportSummaryImage', () => {
  const originalNavigator = globalThis.navigator;
  const originalDocument = globalThis.document;

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.dontMock('react-native');
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
    } else {
      // @ts-expect-error test shim
      delete globalThis.navigator;
    }
    if (originalDocument) {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    } else {
      // @ts-expect-error test shim
      delete globalThis.document;
    }
  });

  it('uses the web share flow when available', async () => {
    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }));
    jest.doMock('expo-sharing', () => ({
      isAvailableAsync: jest.fn(),
      shareAsync: jest.fn(),
    }));

    const share = jest.fn().mockResolvedValue(undefined);
    const canShare = jest.fn().mockReturnValue(true);

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { share, canShare },
    });

    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        body: { appendChild: jest.fn() },
        createElement: jest.fn(() => ({ click: jest.fn(), remove: jest.fn() })),
      },
    });

    const { exportSummaryImage } = require('@/lib/summary/export-image') as typeof import('@/lib/summary/export-image');

    await exportSummaryImage({ uri: 'data:image/png;base64,Zm9v', nickname: '本人' });

    expect(canShare).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [expect.any(File)],
      })
    );
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '本人的就诊摘要',
        files: [expect.any(File)],
      })
    );
  });

  it('falls back to browser download when web share is unavailable', async () => {
    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }));
    jest.doMock('expo-sharing', () => ({
      isAvailableAsync: jest.fn(),
      shareAsync: jest.fn(),
    }));

    const click = jest.fn();
    const remove = jest.fn();
    const appendChild = jest.fn();
    const createElement = jest.fn(() => ({
      click,
      remove,
      href: '',
      download: '',
      rel: '',
    }));

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {},
    });

    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        body: { appendChild },
        createElement,
      },
    });

    const { exportSummaryImage } = require('@/lib/summary/export-image') as typeof import('@/lib/summary/export-image');

    await exportSummaryImage({ uri: 'data:image/png;base64,Zm9v', nickname: '本人' });

    expect(createElement).toHaveBeenCalledWith('a');
    expect(appendChild).toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('uses expo sharing on native platforms', async () => {
    jest.doMock('react-native', () => ({
      Platform: { OS: 'ios' },
    }));

    const isAvailableAsync = jest.fn().mockResolvedValue(true);
    const shareAsync = jest.fn().mockResolvedValue(undefined);

    jest.doMock('expo-sharing', () => ({
      isAvailableAsync,
      shareAsync,
    }));

    const { exportSummaryImage } = require('@/lib/summary/export-image') as typeof import('@/lib/summary/export-image');

    await exportSummaryImage({ uri: 'file:///tmp/summary.png', nickname: '本人' });

    expect(isAvailableAsync).toHaveBeenCalledTimes(1);
    expect(shareAsync).toHaveBeenCalledWith(
      'file:///tmp/summary.png',
      expect.objectContaining({
        dialogTitle: '本人的就诊摘要',
        mimeType: 'image/png',
      })
    );
  });
});
