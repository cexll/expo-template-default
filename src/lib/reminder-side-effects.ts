import { Platform } from 'react-native';
import { api, ApiError, AuthError } from '@/lib/api';
import { getAccessToken } from '@/lib/auth/token-storage';
import { listActiveReminderDeliveryItems, listActiveReminderSyncItems, updateReminder } from '@/lib/db/queries/reminders';

export type ReminderSyncResult =
  | { ok: true; sent: number }
  | { ok: false; error: string };

export type WebNotificationPermissionResult =
  | { supported: false; permission: 'unsupported' }
  | { supported: true; permission: NotificationPermission };

export type ReminderNotificationDeliveryResult =
  | { ok: true; delivered: number }
  | { ok: false; delivered: number; error: string };

type ReminderSentFlag = 'remind1m_sent' | 'remind1w_sent' | 'remind3d_sent' | 'remind0d_sent';

const REMINDER_NODES: { key: ReminderSentFlag; thresholdDays: number; title: string; body: (label: string, date: string) => string }[] = [
  {
    key: 'remind0d_sent',
    thresholdDays: 0,
    title: '今天需要复查',
    body: (label, date) => `${label} 的复查日是 ${date}，请及时安排检查。`,
  },
  {
    key: 'remind3d_sent',
    thresholdDays: 3,
    title: '3天后需要复查',
    body: (label, date) => `${label} 的复查日是 ${date}，建议提前预约。`,
  },
  {
    key: 'remind1w_sent',
    thresholdDays: 7,
    title: '1周后需要复查',
    body: (label, date) => `${label} 的复查日是 ${date}，可以开始安排时间。`,
  },
  {
    key: 'remind1m_sent',
    thresholdDays: 30,
    title: '1个月后需要复查',
    body: (label, date) => `${label} 的复查日是 ${date}，请留意后续安排。`,
  },
];

function daysUntil(dateText: string) {
  const target = new Date(/^\d{4}-\d{2}-\d{2}$/.test(dateText) ? `${dateText}T00:00:00.000` : dateText);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function selectPendingReminderNode(item: Awaited<ReturnType<typeof listActiveReminderDeliveryItems>>[number]) {
  const days = daysUntil(item.next_exam_date);
  if (days === null || days > 30) return null;
  const dueNodes = REMINDER_NODES.filter((node) => days <= node.thresholdDays);
  const notificationNode = dueNodes.find((node) => item[node.key] !== true) ?? null;
  if (!notificationNode) return null;

  return {
    notificationNode,
    sentUpdates: Object.fromEntries(dueNodes.map((node) => [node.key, 1])) as Record<ReminderSentFlag, 1>,
  };
}

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

export async function deliverDueWebReminderNotifications(
  permission?: WebNotificationPermissionResult
): Promise<ReminderNotificationDeliveryResult> {
  if (Platform.OS !== 'web') {
    return { ok: true, delivered: 0 };
  }

  const notificationPermission = permission ?? (await ensureWebNotificationPermission());
  if (!notificationPermission.supported || notificationPermission.permission !== 'granted') {
    return { ok: true, delivered: 0 };
  }

  try {
    const items = await listActiveReminderDeliveryItems();
    let delivered = 0;

    for (const item of items) {
      const pending = selectPendingReminderNode(item);
      if (!pending) continue;

      new Notification(pending.notificationNode.title, {
        body: pending.notificationNode.body(item.lesion_label, item.next_exam_date),
        tag: `reminder:${item.reminder_id}:${pending.notificationNode.key}`,
      });
      await updateReminder(item.reminder_id, pending.sentUpdates);
      delivered += 1;
    }

    return { ok: true, delivered };
  } catch (err) {
    return { ok: false, delivered: 0, error: err instanceof Error ? err.message : '提醒通知失败' };
  }
}

export async function syncRemindersToBackend(): Promise<ReminderSyncResult> {
  const token = await getAccessToken();
  if (Platform.OS !== 'web' && !token) {
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
  delivery: ReminderNotificationDeliveryResult;
  sync: ReminderSyncResult;
}> {
  const notification = await ensureWebNotificationPermission();
  const delivery = await deliverDueWebReminderNotifications(notification);
  const sync = await syncRemindersToBackend();
  return { notification, delivery, sync };
}

export async function applyStartupReminderNotificationDelivery(): Promise<{
  delivery: ReminderNotificationDeliveryResult;
}> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return { delivery: { ok: true, delivered: 0 } };
  }

  const delivery = await deliverDueWebReminderNotifications({ supported: true, permission: 'granted' });
  return { delivery };
}
