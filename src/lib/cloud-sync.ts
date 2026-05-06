import { api } from '@/lib/api';
import { getDatabase } from '@/lib/db';
import type { ArchiveTombstone, Examination, Lesion, Profile, Reminder, ReportImage } from '@/lib/db/types';
import type { SubscriptionStatus } from '@/hooks/useSubscriptionStatus';

type SyncableReminder = Omit<Reminder, 'remind1m_sent' | 'remind1w_sent' | 'remind3d_sent' | 'remind0d_sent'> & {
  remind1m_sent: number | boolean | null;
  remind1w_sent: number | boolean | null;
  remind3d_sent: number | boolean | null;
  remind0d_sent: number | boolean | null;
};

type CloudArchivePayload = {
  profiles: {
    local_id: string;
    display_name: string;
    gender: string;
    birth_year: number;
    avatar_uri: string;
    sort_order: number;
    disease_focus: string;
    sync_version: number;
    updated_at: string;
  }[];
  lesions: {
    local_id: string;
    profile_local_id: string;
    label: string;
    disease_type: string;
    location: string;
    is_archived: boolean;
    sync_version: number;
    updated_at: string;
  }[];
  examinations: {
    local_id: string;
    lesion_local_id: string;
    exam_date: string;
    hospital: string;
    size_x: number | null;
    size_y: number | null;
    size_z: number | null;
    tirads: string;
    echo_type: string;
    border: string;
    calcification: string;
    blood_flow: string;
    birads: string;
    shape: string;
    orientation: string;
    lung_rads: string;
    density: string;
    morphology: string;
    pleural_pull: boolean | null;
    ai_raw_json: string;
    notes: string;
    sync_version: number;
    updated_at: string;
  }[];
  report_images: {
    local_id: string;
    examination_local_id: string;
    object_key: string;
    mime_type: string;
    size_bytes: number;
    sha256: string;
    sort_order: number;
    sync_version: number;
    updated_at: string;
  }[];
  reminders: {
    local_id: string;
    lesion_local_id: string;
    next_exam_date: string;
    source: string;
    is_active: boolean;
    remind1m_sent: boolean;
    remind1w_sent: boolean;
    remind3d_sent: boolean;
    remind0d_sent: boolean;
    sync_version: number;
    updated_at: string;
  }[];
  tombstones: {
    entity_type: string;
    local_id: string;
    deleted_at: string;
    sync_version: number;
  }[];
};

function optionalText(value: string | null | undefined) {
  return typeof value === 'string' ? value : '';
}

function syncVersion(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function intFlag(value: number | boolean | null | undefined) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return null;
}

function boolFromSql(value: number | boolean | null | undefined) {
  return Boolean(value);
}

function reminderFlag(reminder: SyncableReminder, key: 'remind1m_sent' | 'remind1w_sent' | 'remind3d_sent' | 'remind0d_sent') {
  return intFlag(reminder[key]) ?? false;
}

function isDurableObjectKey(value: string | null | undefined) {
  const key = optionalText(value).trim();
  if (!key) return false;
  if (key.startsWith('/') || key.includes('..') || key.includes('\\')) return false;
  if (/^(?:data|file|blob|content|local|http|https):/i.test(key)) return false;
  return key.length <= 512;
}

export async function buildCloudArchivePayload(): Promise<CloudArchivePayload> {
  const db = await getDatabase();
  const profiles = await db.getAllAsync<Profile>('SELECT * FROM profiles ORDER BY created_at ASC;');
  const lesions = await db.getAllAsync<Lesion>('SELECT * FROM lesions ORDER BY created_at ASC;');
  const examinations = await db.getAllAsync<Examination>('SELECT * FROM examinations ORDER BY exam_date ASC, created_at ASC;');
  const reportImages = await db.getAllAsync<ReportImage>('SELECT * FROM report_images ORDER BY created_at ASC;');
  const reminders = await db.getAllAsync<SyncableReminder>('SELECT * FROM reminders ORDER BY next_exam_date ASC, created_at ASC;');
  const tombstones = await db.getAllAsync<ArchiveTombstone>('SELECT * FROM archive_tombstones ORDER BY deleted_at ASC, created_at ASC;').catch(() => []);

  return {
    profiles: profiles.map((profile) => ({
      local_id: profile.id,
      display_name: profile.nickname,
      gender: profile.gender,
      birth_year: profile.birth_year,
      avatar_uri: optionalText(profile.avatar_uri),
      sort_order: profile.sort_order ?? 0,
      disease_focus: '',
      sync_version: syncVersion(profile.sync_version),
      updated_at: profile.updated_at,
    })),
    lesions: lesions.map((lesion) => ({
      local_id: lesion.id,
      profile_local_id: lesion.profile_id,
      label: lesion.label,
      disease_type: lesion.disease_type,
      location: lesion.location,
      is_archived: boolFromSql(lesion.is_archived),
      sync_version: syncVersion(lesion.sync_version),
      updated_at: lesion.updated_at,
    })),
    examinations: examinations.map((exam) => ({
      local_id: exam.id,
      lesion_local_id: exam.lesion_id,
      exam_date: exam.exam_date,
      hospital: optionalText(exam.hospital),
      size_x: exam.size_x,
      size_y: exam.size_y,
      size_z: exam.size_z,
      tirads: optionalText(exam.tirads),
      echo_type: optionalText(exam.echo_type),
      border: optionalText(exam.border),
      calcification: optionalText(exam.calcification),
      blood_flow: optionalText(exam.blood_flow),
      birads: optionalText(exam.birads),
      shape: optionalText(exam.shape),
      orientation: optionalText(exam.orientation),
      lung_rads: optionalText(exam.lung_rads),
      density: optionalText(exam.density),
      morphology: optionalText(exam.morphology),
      pleural_pull: intFlag(exam.pleural_pull),
      ai_raw_json: optionalText(exam.ai_raw_json),
      notes: optionalText(exam.notes),
      sync_version: syncVersion(exam.sync_version),
      updated_at: exam.updated_at,
    })),
    report_images: reportImages.filter((image) => isDurableObjectKey(image.object_key)).map((image) => ({
      local_id: image.id,
      examination_local_id: image.examination_id,
      object_key: optionalText(image.object_key),
      mime_type: optionalText(image.mime_type),
      size_bytes: syncVersion(image.size_bytes),
      sha256: optionalText(image.sha256),
      sort_order: image.sort_order ?? 0,
      sync_version: syncVersion(image.sync_version),
      updated_at: image.updated_at ?? image.created_at,
    })),
    reminders: reminders.map((reminder) => ({
      local_id: reminder.id,
      lesion_local_id: reminder.lesion_id,
      next_exam_date: reminder.next_exam_date,
      source: reminder.source,
      is_active: boolFromSql(reminder.is_active),
      remind1m_sent: reminderFlag(reminder, 'remind1m_sent'),
      remind1w_sent: reminderFlag(reminder, 'remind1w_sent'),
      remind3d_sent: reminderFlag(reminder, 'remind3d_sent'),
      remind0d_sent: reminderFlag(reminder, 'remind0d_sent'),
      sync_version: syncVersion(reminder.sync_version),
      updated_at: reminder.updated_at,
    })),
    tombstones: tombstones.map((tombstone) => ({
      entity_type: tombstone.entity_type,
      local_id: tombstone.local_id,
      deleted_at: tombstone.deleted_at,
      sync_version: syncVersion(tombstone.sync_version),
    })),
  };
}

function countReadbackItems(readback: Partial<CloudArchivePayload> | null | undefined) {
  if (!readback) return 0;
  return (
    (Array.isArray(readback.profiles) ? readback.profiles.length : 0) +
    (Array.isArray(readback.lesions) ? readback.lesions.length : 0) +
    (Array.isArray(readback.examinations) ? readback.examinations.length : 0) +
    (Array.isArray(readback.report_images) ? readback.report_images.length : 0) +
    (Array.isArray(readback.reminders) ? readback.reminders.length : 0) +
    (Array.isArray(readback.tombstones) ? readback.tombstones.length : 0)
  );
}

export async function syncCloudArchiveIfEntitled(status: Pick<SubscriptionStatus, 'isCloudSyncEnabled'> | null | undefined) {
  if (!status?.isCloudSyncEnabled) {
    return { skipped: true as const, reason: 'not_entitled' as const };
  }

  const payload = await buildCloudArchivePayload();
  const reply = await api.post<{ synced_count?: number }>('/api/v1/archive/sync', payload);
  const readback = await api.get<Partial<CloudArchivePayload>>('/api/v1/archive');
  return { skipped: false as const, syncedCount: reply.synced_count ?? 0, readbackCount: countReadbackItems(readback) };
}
