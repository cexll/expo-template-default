import { api } from '@/lib/api';
import { getDatabase } from '@/lib/db';
import { buildUpdateSet } from '@/lib/db/queries/shared';
import type { Reminder } from '@/lib/db/types';

export type CreateReminderInput = Pick<
  Reminder,
  'id' | 'lesion_id' | 'next_exam_date' | 'source' | 'is_active'
> &
  Partial<Pick<Reminder, 'remind1m_sent' | 'remind1w_sent' | 'remind3d_sent' | 'remind0d_sent'>>;

export type UpdateReminderInput = Partial<
  Pick<
    Reminder,
    | 'next_exam_date'
    | 'source'
    | 'is_active'
    | 'remind1m_sent'
    | 'remind1w_sent'
    | 'remind3d_sent'
    | 'remind0d_sent'
  >
>;

export async function listRemindersByLesion(lesionId: string) {
  const db = await getDatabase();
  return db.getAllAsync<Reminder>(
    `
      SELECT *
      FROM reminders
      WHERE lesion_id = ?
      ORDER BY next_exam_date ASC, created_at DESC;
    `,
    lesionId
  );
}

export async function listActiveRemindersByProfile(profileId: string) {
  const db = await getDatabase();
  return db.getAllAsync<Reminder>(
    `
      SELECT reminders.*
      FROM reminders
      INNER JOIN lesions ON lesions.id = reminders.lesion_id
      WHERE lesions.profile_id = ? AND reminders.is_active = 1
      ORDER BY reminders.next_exam_date ASC, reminders.created_at DESC;
    `,
    profileId
  );
}

export type ReminderSyncItem = {
  reminder_id: string;
  profile_id?: string;
  lesion_id?: string;
  archive_profile_id?: string;
  archive_lesion_id?: string;
  examination_id?: string | null;
  lesion_label: string;
  next_exam_date: string;
  source: Reminder['source'];
  remind1m_sent: boolean | null;
  remind1w_sent: boolean | null;
  remind3d_sent: boolean | null;
  remind0d_sent: boolean | null;
};

export type ReminderDeliveryItem = ReminderSyncItem;

type SyncedReminderReply = {
  reminders?: ReminderSyncItem[];
};

function normalizeReminderIdentity<T extends ReminderSyncItem>(item: T): T {
  const profileId = item.archive_profile_id ?? item.profile_id ?? '';
  const lesionId = item.archive_lesion_id ?? item.lesion_id ?? '';
  return {
    ...item,
    profile_id: profileId,
    lesion_id: lesionId,
    archive_profile_id: profileId,
    archive_lesion_id: lesionId,
    examination_id: item.examination_id ?? null,
  };
}

function nullableBoolean(value: unknown) {
  if (value === null || value === undefined) return null;
  return value === true || value === 1;
}

function normalizeReminderSyncItem(item: ReminderSyncItem): ReminderSyncItem {
  const normalized = normalizeReminderIdentity(item);
  return {
    ...normalized,
    remind1m_sent: nullableBoolean(normalized.remind1m_sent) ?? false,
    remind1w_sent: nullableBoolean(normalized.remind1w_sent) ?? false,
    remind3d_sent: nullableBoolean(normalized.remind3d_sent) ?? false,
    remind0d_sent: nullableBoolean(normalized.remind0d_sent) ?? false,
  };
}

function normalizeReminderDeliveryItem(item: ReminderDeliveryItem): ReminderDeliveryItem {
  const normalized = normalizeReminderIdentity(item);
  return {
    ...normalized,
    remind1m_sent: nullableBoolean(normalized.remind1m_sent) ?? false,
    remind1w_sent: nullableBoolean(normalized.remind1w_sent) ?? false,
    remind3d_sent: nullableBoolean(normalized.remind3d_sent) ?? false,
    remind0d_sent: nullableBoolean(normalized.remind0d_sent) ?? false,
  };
}

export async function listActiveReminderSyncItems() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ReminderSyncItem>(
    `
      WITH latest_examinations AS (
        SELECT lesion_id, id AS examination_id
        FROM (
          SELECT
            examinations.*,
            ROW_NUMBER() OVER (PARTITION BY lesion_id ORDER BY exam_date DESC, created_at DESC) AS row_num
          FROM examinations
        )
        WHERE row_num = 1
      )
      SELECT
        reminders.id AS reminder_id,
        lesions.profile_id AS profile_id,
        reminders.lesion_id AS lesion_id,
        lesions.profile_id AS archive_profile_id,
        reminders.lesion_id AS archive_lesion_id,
        latest_examinations.examination_id AS examination_id,
        lesions.label AS lesion_label,
        reminders.next_exam_date AS next_exam_date,
        reminders.source AS source,
        reminders.remind1m_sent AS remind1m_sent,
        reminders.remind1w_sent AS remind1w_sent,
        reminders.remind3d_sent AS remind3d_sent,
        reminders.remind0d_sent AS remind0d_sent
      FROM reminders
      INNER JOIN lesions ON lesions.id = reminders.lesion_id
      LEFT JOIN latest_examinations ON latest_examinations.lesion_id = reminders.lesion_id
      WHERE reminders.is_active = 1
      ORDER BY reminders.next_exam_date ASC, reminders.created_at DESC;
    `
  );

  return rows.map(normalizeReminderSyncItem);
}

export async function listActiveReminderDeliveryItems() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ReminderDeliveryItem>(
    `
      WITH latest_examinations AS (
        SELECT lesion_id, id AS examination_id
        FROM (
          SELECT
            examinations.*,
            ROW_NUMBER() OVER (PARTITION BY lesion_id ORDER BY exam_date DESC, created_at DESC) AS row_num
          FROM examinations
        )
        WHERE row_num = 1
      )
      SELECT
        reminders.id AS reminder_id,
        lesions.profile_id AS profile_id,
        reminders.lesion_id AS lesion_id,
        lesions.profile_id AS archive_profile_id,
        reminders.lesion_id AS archive_lesion_id,
        latest_examinations.examination_id AS examination_id,
        lesions.label AS lesion_label,
        reminders.next_exam_date AS next_exam_date,
        reminders.source AS source,
        reminders.remind1m_sent AS remind1m_sent,
        reminders.remind1w_sent AS remind1w_sent,
        reminders.remind3d_sent AS remind3d_sent,
        reminders.remind0d_sent AS remind0d_sent
      FROM reminders
      INNER JOIN lesions ON lesions.id = reminders.lesion_id
      LEFT JOIN latest_examinations ON latest_examinations.lesion_id = reminders.lesion_id
      WHERE reminders.is_active = 1
      ORDER BY reminders.next_exam_date ASC, reminders.created_at DESC;
    `
  );

  return rows.map(normalizeReminderDeliveryItem);
}

export async function getReminderById(id: string) {
  const db = await getDatabase();
  return db.getFirstAsync<Reminder>('SELECT * FROM reminders WHERE id = ? LIMIT 1;', id);
}

function makeReminderId(lesionId: string) {
  return `reminder_${lesionId}_${Date.now().toString(36)}`;
}

export async function syncBackendRemindersToLocal(profileId: string) {
  const data = await api.get<SyncedReminderReply>('/api/v1/reminders');
  const reminders = Array.isArray(data.reminders) ? data.reminders : [];
  const db = await getDatabase();
  const lesions = await db.getAllAsync<{ id: string; label: string }>(
    'SELECT id, label FROM lesions WHERE profile_id = ? AND is_archived = 0;',
    profileId
  );
  const lesionIds = new Set(lesions.map((lesion) => lesion.id));
  const lesionIdByUniqueLabel = new Map<string, string>();
  const labelCounts = new Map<string, number>();
  for (const lesion of lesions) {
    labelCounts.set(lesion.label, (labelCounts.get(lesion.label) ?? 0) + 1);
  }
  for (const lesion of lesions) {
    if (labelCounts.get(lesion.label) === 1) {
      lesionIdByUniqueLabel.set(lesion.label, lesion.id);
    }
  }

  for (const remoteRaw of reminders) {
    const remote = normalizeReminderSyncItem(remoteRaw);
    const remoteLesionId = remote.archive_lesion_id ?? remote.lesion_id ?? '';
    const stableLesionId = remoteLesionId && lesionIds.has(remoteLesionId) ? remoteLesionId : null;
    const lesionId = stableLesionId ?? lesionIdByUniqueLabel.get(remote.lesion_label);
    if (!lesionId || !remote.next_exam_date) continue;

    const existing = await listRemindersByLesion(lesionId);
    const active = existing.find((reminder) => reminder.is_active === 1);
    if (active) {
      if (active.source === 'manual' && remote.source !== 'manual') {
        continue;
      }
      await updateReminder(active.id, {
        next_exam_date: remote.next_exam_date,
        source: active.source === 'manual' || remote.source === 'manual' ? 'manual' : (remote.source ?? active.source),
        is_active: 1,
        remind1m_sent: remote.remind1m_sent ? 1 : 0,
        remind1w_sent: remote.remind1w_sent ? 1 : 0,
        remind3d_sent: remote.remind3d_sent ? 1 : 0,
        remind0d_sent: remote.remind0d_sent ? 1 : 0,
      });
    } else {
      await createReminder({
        id: remote.reminder_id || makeReminderId(lesionId),
        lesion_id: lesionId,
        next_exam_date: remote.next_exam_date,
        source: remote.source ?? 'manual',
        is_active: 1,
        remind1m_sent: remote.remind1m_sent ? 1 : 0,
        remind1w_sent: remote.remind1w_sent ? 1 : 0,
        remind3d_sent: remote.remind3d_sent ? 1 : 0,
        remind0d_sent: remote.remind0d_sent ? 1 : 0,
      });
    }
  }

  return reminders.length;
}

export async function createReminder(input: CreateReminderInput) {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO reminders (
        id, lesion_id, next_exam_date, source, is_active, remind1m_sent, remind1w_sent, remind3d_sent, remind0d_sent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    input.id,
    input.lesion_id,
    input.next_exam_date,
    input.source,
    input.is_active,
    input.remind1m_sent ?? 0,
    input.remind1w_sent ?? 0,
    input.remind3d_sent ?? 0,
    input.remind0d_sent ?? 0
  );

  return getReminderById(input.id);
}

export async function updateReminder(id: string, updates: UpdateReminderInput) {
  const db = await getDatabase();
  const updateSet = buildUpdateSet<UpdateReminderInput>(updates);

  if (!updateSet) {
    return getReminderById(id);
  }

  await db.runAsync(
    `UPDATE reminders SET ${updateSet.clause}, updated_at = datetime('now') WHERE id = ?;`,
    ...updateSet.values,
    id
  );

  return getReminderById(id);
}

export async function deactivateReminder(id: string) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE reminders SET is_active = 0, updated_at = datetime('now') WHERE id = ?;",
    id
  );
}

export async function deleteReminder(id: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM reminders WHERE id = ?;', id);
}
