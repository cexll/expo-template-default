import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import type { ReportImageAsset } from '@/lib/report-images';

function getBaseDirectory(): string | null {
  return FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? null;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith('/') ? value : `${value}/`;
}

function inferExtensionFromUri(uri: string): string {
  const withoutQuery = uri.split('#')[0]?.split('?')[0] ?? uri;
  const match = withoutQuery.match(/\.([a-zA-Z0-9]+)$/);
  if (!match) return 'jpg';
  const ext = match[1].toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp' || ext === 'heic') return ext;
  return 'jpg';
}

function mimeTypeToExtension(mimeType: string | null): string | null {
  if (!mimeType) return null;
  const normalized = mimeType.toLowerCase();
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/heic') return 'heic';
  if (normalized === 'image/jpg' || normalized === 'image/jpeg') return 'jpg';
  return null;
}

function parseMimeTypeFromDataUrl(dataUrl: string): string | null {
  const match = /^data:([^;,]+)[;,]/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1]?.trim();
  return mime ? mime : null;
}

async function blobToDataUrl(blob: Blob, overrideMimeType: string | null): Promise<string> {
  const mimeType = overrideMimeType || (blob.type ? blob.type : 'application/octet-stream');

  if (typeof FileReader !== 'undefined') {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('读取图片失败'));
      reader.readAsDataURL(blob);
    });

    if (overrideMimeType && overrideMimeType !== parseMimeTypeFromDataUrl(dataUrl)) {
      return dataUrl.replace(/^data:[^;,]+/, `data:${overrideMimeType}`);
    }

    return dataUrl;
  }

  // Node/test environment or very constrained runtime: fall back to ArrayBuffer + Buffer base64 encoding.
  const buf =
    typeof Buffer !== 'undefined'
      ? Buffer.from(await blob.arrayBuffer())
      : new Uint8Array(await blob.arrayBuffer());
  const base64 =
    typeof Buffer !== 'undefined'
      ? (buf as Buffer).toString('base64')
      : btoa(String.fromCharCode(...(buf as Uint8Array)));

  return `data:${mimeType};base64,${base64}`;
}

async function readUriAsDataUrl(uri: string, expectedMimeType: string | null): Promise<{ dataUrl: string; mimeType: string | null }> {
  if (uri.startsWith('data:')) {
    return { dataUrl: uri, mimeType: parseMimeTypeFromDataUrl(uri) ?? expectedMimeType ?? null };
  }

  const res = await fetch(uri);
  if (!res.ok) throw new Error('读取图片失败');
  const blob = await res.blob();
  const override = blob.type ? null : expectedMimeType;
  const dataUrl = await blobToDataUrl(blob, override);
  return { dataUrl, mimeType: parseMimeTypeFromDataUrl(dataUrl) ?? override ?? (blob.type || null) };
}

export type PersistedReportImage = {
  uri: string;
  mimeType: string | null;
};

async function persistOneReportImage(args: { source: ReportImageAsset; examinationId: string; sortOrder: number }): Promise<PersistedReportImage> {
  // On web, storing blob:/file: URIs in SQLite won't survive reloads and often won't render later.
  // Convert the image into a stable data URL and store that into the report_images table.
  if (Platform.OS === 'web') {
    const { dataUrl, mimeType } = await readUriAsDataUrl(args.source.uri, args.source.mimeType);
    return { uri: dataUrl, mimeType };
  }

  const base = getBaseDirectory();
  if (!base) return { uri: args.source.uri, mimeType: args.source.mimeType };

  const dir = `${ensureTrailingSlash(base)}report-images/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {
    // Ignore "already exists" and other benign failures; we'll try to write/copy anyway.
  });

  const ext = mimeTypeToExtension(args.source.mimeType) ?? inferExtensionFromUri(args.source.uri);
  const destUri = `${dir}${args.examinationId}_${args.sortOrder + 1}.${ext}`;

  try {
    await FileSystem.copyAsync({ from: args.source.uri, to: destUri });
    return { uri: destUri, mimeType: args.source.mimeType };
  } catch {
    // Last-resort fallback: write base64 bytes to the destination URI.
    // NOTE: This does not attempt to infer MIME type from URI suffixes. MIME is preserved only
    // when provided by the caller (picker metadata) or when we can observe it directly (web data URL).
    const base64 = await FileSystem.readAsStringAsync(args.source.uri, { encoding: FileSystem.EncodingType.Base64 });
    await FileSystem.writeAsStringAsync(destUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return { uri: destUri, mimeType: args.source.mimeType };
  }
}

export async function persistReportImages(sourceImages: ReportImageAsset[], examinationId: string): Promise<PersistedReportImage[]> {
  const cleaned = sourceImages
    .filter((img): img is ReportImageAsset => Boolean(img && typeof img.uri === 'string' && img.uri.trim()))
    .slice(0, 5);
  const results: PersistedReportImage[] = [];

  for (let i = 0; i < cleaned.length; i += 1) {
    results.push(
      await persistOneReportImage({
        source: cleaned[i],
        examinationId,
        sortOrder: i,
      })
    );
  }

  return results;
}

// Backwards-compatible helper for legacy callers that only tracked URIs.
export async function persistReportImageUris(sourceUris: string[], examinationId: string) {
  const sourceImages: ReportImageAsset[] = sourceUris
    .filter((uri) => typeof uri === 'string' && uri.trim() !== '')
    .slice(0, 5)
    .map((uri) => ({ uri, mimeType: null }));
  const persisted = await persistReportImages(sourceImages, examinationId);
  return persisted.map((img) => img.uri);
}
