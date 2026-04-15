import { getDatabase } from '@/lib/db';
import { buildUpdateSet } from '@/lib/db/queries/shared';
import type { Reminder } from '@/lib/db/types';

export type CreateReminderInput = Pick<
  Reminder,
  'id' | 'lesion_id' | 'next_exam_date' | 'source' | 'is_active'
>;

export type UpdateReminderInput = Partial<
  Pick<Reminder, 'next_exam_date' | 'source' | 'is_active'>
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
  lesion_label: string;
  next_exam_date: string;
};

export async function listActiveReminderSyncItems() {
  const db = await getDatabase();
  return db.getAllAsync<ReminderSyncItem>(
    `
      SELECT lesions.label AS lesion_label, reminders.next_exam_date AS next_exam_date
      FROM reminders
      INNER JOIN lesions ON lesions.id = reminders.lesion_id
      WHERE reminders.is_active = 1
      ORDER BY reminders.next_exam_date ASC, reminders.created_at DESC;
    `
  );
}

export async function getReminderById(id: string) {
  const db = await getDatabase();
  return db.getFirstAsync<Reminder>('SELECT * FROM reminders WHERE id = ? LIMIT 1;', id);
}

export async function createReminder(input: CreateReminderInput) {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO reminders (
        id, lesion_id, next_exam_date, source, is_active
      ) VALUES (?, ?, ?, ?, ?);
    `,
    input.id,
    input.lesion_id,
    input.next_exam_date,
    input.source,
    input.is_active
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
