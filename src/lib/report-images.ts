export type ReportImageAsset = {
  uri: string;
  mimeType: string | null;
};

function normalizeMimeType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('/')) return null;
  return trimmed;
}

function normalizeUri(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

export function parseReportImageAssetsParam(value: unknown): ReportImageAsset[] {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== 'string' || !v.trim()) return [];

  try {
    const parsed = JSON.parse(v) as unknown;
    if (!Array.isArray(parsed)) return [];

    const results: ReportImageAsset[] = [];
    for (const item of parsed) {
      if (typeof item === 'string') {
        const uri = normalizeUri(item);
        if (uri) results.push({ uri, mimeType: null });
        continue;
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const uri = normalizeUri(obj.uri);
        if (!uri) continue;
        const mimeType = normalizeMimeType(obj.mimeType ?? obj.mime_type);
        results.push({ uri, mimeType });
      }
      if (results.length >= 5) break;
    }

    return results.slice(0, 5);
  } catch {
    return [];
  }
}

export function stringifyReportImageAssetsParam(images: ReportImageAsset[]): string {
  const cleaned = images
    .filter((img): img is ReportImageAsset => Boolean(img && typeof img.uri === 'string' && img.uri.trim()))
    .slice(0, 5)
    .map((img) => ({
      uri: img.uri,
      mimeType: normalizeMimeType(img.mimeType) ?? null,
    }));
  return JSON.stringify(cleaned);
}
