import { persistReportImages } from '@/lib/report-image-storage';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

describe('report image storage MIME preservation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    // @ts-expect-error test cleanup
    delete global.fetch;
  });

  it('preserves authoritative MIME on web (uses blob.type / data URL, not URI suffix guessing)', async () => {
    const blob = new Blob(['png-bytes'], { type: 'image/png' });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => blob,
    });
    // @ts-expect-error test shim
    global.fetch = fetchMock;

    const result = await persistReportImages(
      [{ uri: 'blob:report-page-1', mimeType: 'image/jpeg' }], // misleading suffix/mime should not win
      'exam-1'
    );

    expect(fetchMock).toHaveBeenCalledWith('blob:report-page-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ mimeType: 'image/png' });
    expect(result[0]!.uri.startsWith('data:image/png;base64,')).toBe(true);
  });
});
