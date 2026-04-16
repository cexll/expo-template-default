import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

type ExportSummaryImageArgs = {
  uri: string;
  nickname: string;
};

function buildExportTitle(nickname: string) {
  return `${nickname}的就诊摘要`;
}

function buildExportFileName(nickname: string) {
  const safeName = nickname.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return `${safeName || 'summary'}-summary.png`;
}

function parseDataUri(uri: string) {
  const match = uri.match(/^data:(.*?);base64,(.*)$/);
  if (!match) return null;
  return {
    mimeType: match[1] || 'image/png',
    payload: match[2] || '',
  };
}

function dataUriToFile(uri: string, fileName: string) {
  const parsed = parseDataUri(uri);
  if (!parsed || typeof File !== 'function' || typeof atob !== 'function') return null;

  const binary = atob(parsed.payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], fileName, { type: parsed.mimeType });
}

async function exportImageOnWeb(uri: string, title: string, fileName: string) {
  const share = globalThis.navigator?.share;
  const canShare = globalThis.navigator?.canShare;
  const file = dataUriToFile(uri, fileName);

  if (file && typeof share === 'function') {
    const sharePayload = { title, files: [file] };
    const supported = typeof canShare === 'function' ? canShare(sharePayload) : true;

    if (supported) {
      try {
        await share(sharePayload);
        return;
      } catch {
        // Fall back to a deterministic browser download when Web Share is unavailable or rejected.
      }
    }
  }

  if (!globalThis.document?.createElement) {
    throw new Error('当前浏览器不支持导出');
  }

  const link = globalThis.document.createElement('a');
  link.href = uri;
  link.download = fileName;
  link.rel = 'noopener';
  globalThis.document.body?.appendChild?.(link);
  link.click();
  link.remove?.();
}

export async function exportSummaryImage({ uri, nickname }: ExportSummaryImageArgs) {
  const title = buildExportTitle(nickname);

  if (Platform.OS === 'web') {
    await exportImageOnWeb(uri, title, buildExportFileName(nickname));
    return;
  }

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('当前设备不支持分享');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle: title,
    UTI: 'public.png',
  });
}
