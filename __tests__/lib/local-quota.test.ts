import { bumpLocalSummaryExportUsed, formatLocalMonth, readLocalSummaryExportUsed } from '@/lib/subscription/local-quota';

describe('local summary-export quota shadow', () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    const store = new Map<string, string>();
    // @ts-expect-error test shim
    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    };
  });

  afterEach(() => {
    // @ts-expect-error test shim
    globalThis.localStorage = originalLocalStorage;
  });

  it('formats local month as YYYY-MM', () => {
    expect(formatLocalMonth(new Date(2026, 3, 15))).toBe('2026-04');
  });

  it('reads and bumps summary export used count', () => {
    const month = '2026-04';
    expect(readLocalSummaryExportUsed(month)).toBe(0);
    expect(bumpLocalSummaryExportUsed(month, 1)).toBe(1);
    expect(bumpLocalSummaryExportUsed(month, 1)).toBe(2);
    expect(readLocalSummaryExportUsed(month)).toBe(2);
  });

  it('isolates summary export usage by account scope within the same month', () => {
    const month = '2026-04';

    expect(bumpLocalSummaryExportUsed(month, 1, 'user-a')).toBe(1);
    expect(bumpLocalSummaryExportUsed(month, 1, 'user-a')).toBe(2);
    expect(bumpLocalSummaryExportUsed(month, 1, 'user-b')).toBe(1);

    expect(readLocalSummaryExportUsed(month, 'user-a')).toBe(2);
    expect(readLocalSummaryExportUsed(month, 'user-b')).toBe(1);
    expect(readLocalSummaryExportUsed(month)).toBe(0);
  });
});
