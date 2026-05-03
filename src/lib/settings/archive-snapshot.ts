import { Platform } from 'react-native';

import { getDatabase } from '@/lib/db';
import type { AuthUser } from '@/providers/auth-provider';

export type LocalArchiveSettingsSnapshot = {
  profileCount: number;
  lesionCount: number;
  examinationCount: number;
  reportImageCount: number;
  activeReminderCount: number;
};

async function countTable(table: string, where = '') {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}${where};`);
  return row?.count ?? 0;
}

export async function readLocalArchiveSettingsSnapshot(): Promise<LocalArchiveSettingsSnapshot> {
  const [profileCount, lesionCount, examinationCount, reportImageCount, activeReminderCount] = await Promise.all([
    countTable('profiles'),
    countTable('lesions', ' WHERE is_archived = 0'),
    countTable('examinations'),
    countTable('report_images'),
    countTable('reminders', ' WHERE is_active = 1'),
  ]);

  return {
    profileCount,
    lesionCount,
    examinationCount,
    reportImageCount,
    activeReminderCount,
  };
}

export function formatLocalArchiveStorage(snapshot: LocalArchiveSettingsSnapshot | null | undefined) {
  if (!snapshot) return '正在计算本地档案…';
  return `本地档案 ${snapshot.profileCount}人 · ${snapshot.lesionCount}病灶 · ${snapshot.examinationCount}检查 · ${snapshot.reportImageCount}张图片`;
}

function maskPhone(phone: string) {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

export function formatReminderContact(user: AuthUser | null | undefined) {
  if (!user) return '未登录，登录后同步提醒联系方式';
  if (user.phone) return `短信 ${maskPhone(user.phone)}`;
  return user.nickname ? `${user.nickname} · 未绑定手机号` : '未绑定提醒联系方式';
}

export function formatNotificationState() {
  if (Platform.OS !== 'web') return '系统通知随设备权限管理';
  const notificationApi = typeof globalThis.Notification === 'undefined' ? null : globalThis.Notification;
  if (!notificationApi) return '浏览器不支持通知';
  if (notificationApi.permission === 'granted') return '浏览器通知已允许';
  if (notificationApi.permission === 'denied') return '浏览器通知未授权';
  return '浏览器通知待授权';
}
