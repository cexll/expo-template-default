import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

function getBaseDirectory(): string | null {
  return FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? null;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith('/') ? value : `${value}/`;
}

function inferExtension(uri: string): string {
  const withoutQuery = uri.split('#')[0]?.split('?')[0] ?? uri;
  const match = withoutQuery.match(/\.([a-zA-Z0-9]+)$/);
  if (!match) return 'jpg';
  const ext = match[1].toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp' || ext === 'heic') return ext;
  return 'jpg';
}

function extensionToMime(ext: string): string {
  const normalized = ext.toLowerCase();
  if (normalized === 'png') return 'image/png';
  if (normalized === 'webp') return 'image/webp';
  if (normalized === 'heic') return 'image/heic';
  // default to jpeg for jpg/jpeg and unknowns
  return 'image/jpeg';
}

async function readUriAsBase64(uri: string): Promise<string> {
  if (uri.startsWith('data:')) {
    const comma = uri.indexOf(',');
    if (comma >= 0) {
      // Common case: data:*;base64,xxxxx
      return uri.slice(comma + 1);
    }
  }

  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch {
    // Fallback for blob:/data:/http(s) schemes.
    const res = await fetch(uri);
    if (!res.ok) throw new Error('读取图片失败');
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('读取图片失败'));
      reader.readAsDataURL(blob);
    });
    const idx = dataUrl.indexOf(',');
    return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  }
}

async function persistOneReportImage(args: { sourceUri: string; examinationId: string; sortOrder: number }) {
  // On web, storing blob:/file: URIs in SQLite won't survive reloads and often won't render later.
  // Convert the image into a stable data URL and store that into the report_images table.
  if (Platform.OS === 'web') {
    const ext = inferExtension(args.sourceUri);
    const mime = extensionToMime(ext);
    const base64 = await readUriAsBase64(args.sourceUri);
    return `data:${mime};base64,${base64}`;
  }

  const base = getBaseDirectory();
  if (!base) return args.sourceUri;

  const dir = `${ensureTrailingSlash(base)}report-images/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {
    // Ignore "already exists" and other benign failures; we'll try to write/copy anyway.
  });

  const ext = inferExtension(args.sourceUri);
  const destUri = `${dir}${args.examinationId}_${args.sortOrder + 1}.${ext}`;

  try {
    await FileSystem.copyAsync({ from: args.sourceUri, to: destUri });
    return destUri;
  } catch {
    const base64 = await readUriAsBase64(args.sourceUri);
    await FileSystem.writeAsStringAsync(destUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return destUri;
  }
}

export async function persistReportImageUris(sourceUris: string[], examinationId: string) {
  const cleaned = sourceUris.filter((uri) => typeof uri === 'string' && uri.trim() !== '');
  const results: string[] = [];

  for (let i = 0; i < cleaned.length; i += 1) {
    results.push(
      await persistOneReportImage({
        sourceUri: cleaned[i],
        examinationId,
        sortOrder: i,
      })
    );
  }

  return results;
}
