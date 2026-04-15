import { api, ApiError, AuthError } from '@/lib/api';
import { getAccessToken } from '@/lib/auth/token-storage';
import { listActiveReminderSyncItems } from '@/lib/db/queries/reminders';

export type ReminderSyncResult =
  | { ok: true; sent: number }
  | { ok: false; error: string };

export type WebNotificationPermissionResult =
  | { supported: false; permission: 'unsupported' }
  | { supported: true; permission: NotificationPermission };

export async function ensureWebNotificationPermission(): Promise<WebNotificationPermissionResult> {
  try {
    if (typeof Notification === 'undefined' || typeof Notification.requestPermission !== 'function') {
      return { supported: false, permission: 'unsupported' };
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return { supported: true, permission };
    }

    return { supported: true, permission: Notification.permission };
  } catch {
    return { supported: false, permission: 'unsupported' };
  }
}

export async function syncRemindersToBackend(): Promise<ReminderSyncResult> {
  const token = await getAccessToken();
  if (!token) {
    return { ok: false, error: '未登录，无法同步提醒' };
  }

  try {
    const items = await listActiveReminderSyncItems();
    // Replace-all semantics (including empty list to clear).
    await api.post('/api/v1/reminders/sync', { reminders: items });
    return { ok: true, sent: items.length };
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : '同步失败' };
  }
}

export async function applyReminderSideEffects(): Promise<{
  notification: WebNotificationPermissionResult;
  sync: ReminderSyncResult;
}> {
  // Always attempt to surface notification permission state; sync requires auth and can fail independently.
  const notification = await ensureWebNotificationPermission();
  const sync = await syncRemindersToBackend();
  return { notification, sync };
}
