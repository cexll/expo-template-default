function pad2(value: number) {
  return value < 10 ? `0${value}` : `${value}`;
}

export function formatLocalMonth(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${pad2(month)}`;
}

const SUMMARY_EXPORT_PREFIX = 'noduleArchive:usage:summary_export:';

function storageKeyForSummaryExport(month: string) {
  return `${SUMMARY_EXPORT_PREFIX}${month}`;
}

function hasLocalStorage(): boolean {
  try {
    return typeof globalThis !== 'undefined' && typeof globalThis.localStorage?.getItem === 'function';
  } catch {
    return false;
  }
}

export function readLocalSummaryExportUsed(month = formatLocalMonth()) {
  if (!hasLocalStorage()) return 0;
  try {
    const raw = globalThis.localStorage.getItem(storageKeyForSummaryExport(month));
    if (!raw) return 0;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
  } catch {
    return 0;
  }
}

export function writeLocalSummaryExportUsed(month: string, used: number) {
  if (!hasLocalStorage()) return;
  const normalized = Number.isFinite(used) && used > 0 ? Math.floor(used) : 0;
  try {
    globalThis.localStorage.setItem(storageKeyForSummaryExport(month), `${normalized}`);
  } catch {
    // ignore persistence failures (for example private browsing)
  }
}

export function bumpLocalSummaryExportUsed(month = formatLocalMonth(), by = 1) {
  const next = Math.max(0, readLocalSummaryExportUsed(month) + by);
  writeLocalSummaryExportUsed(month, next);
  return next;
}
