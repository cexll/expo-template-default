import { api } from '@/lib/api';
import { getDatabase } from '@/lib/db';
import type { Examination, Lesion, Profile, Reminder, ReportImage } from '@/lib/db/types';
import type { SubscriptionStatus } from '@/hooks/useSubscriptionStatus';

type CloudArchivePayload = {
  profiles: {
    local_id: string;
    display_name: string;
    gender: string;
    birth_year: number;
    disease_focus: string;
    updated_at: string;
  }[];
  lesions: {
    local_id: string;
    profile_local_id: string;
    label: string;
    disease_type: string;
    location: string;
    rads_grade: string;
    updated_at: string;
  }[];
  examinations: {
    local_id: string;
    lesion_local_id: string;
    exam_date: string;
    hospital: string;
    size_mm: number;
    rads_grade: string;
    updated_at: string;
  }[];
  report_images: {
    local_id: string;
    examination_local_id: string;
    object_key: string;
    mime_type: string;
    size_bytes: number;
    sha256: string;
    updated_at: string;
  }[];
  reminders: {
    local_id: string;
    lesion_local_id: string;
    next_exam_date: string;
    remind1m_sent: boolean;
    remind1w_sent: boolean;
    remind3d_sent: boolean;
    remind0d_sent: boolean;
    updated_at: string;
  }[];
};

function radsGradeFromExam(exam: Examination) {
  return exam.tirads ?? exam.birads ?? exam.lung_rads ?? '';
}

export async function buildCloudArchivePayload(): Promise<CloudArchivePayload> {
  const db = await getDatabase();
  const profiles = await db.getAllAsync<Profile>('SELECT * FROM profiles ORDER BY created_at ASC;');
  const lesions = await db.getAllAsync<Lesion>('SELECT * FROM lesions ORDER BY created_at ASC;');
  const examinations = await db.getAllAsync<Examination>('SELECT * FROM examinations ORDER BY exam_date ASC, created_at ASC;');
  const reportImages = await db.getAllAsync<ReportImage>('SELECT * FROM report_images ORDER BY created_at ASC;');
  const reminders = await db.getAllAsync<Reminder>('SELECT * FROM reminders WHERE is_active = 1 ORDER BY next_exam_date ASC, created_at ASC;');

  return {
    profiles: profiles.map((profile) => ({
      local_id: profile.id,
      display_name: profile.nickname,
      gender: profile.gender,
      birth_year: profile.birth_year,
      disease_focus: '',
      updated_at: profile.updated_at,
    })),
    lesions: lesions.map((lesion) => ({
      local_id: lesion.id,
      profile_local_id: lesion.profile_id,
      label: lesion.label,
      disease_type: lesion.disease_type,
      location: lesion.location,
      rads_grade: '',
      updated_at: lesion.updated_at,
    })),
    examinations: examinations.map((exam) => ({
      local_id: exam.id,
      lesion_local_id: exam.lesion_id,
      exam_date: exam.exam_date,
      hospital: exam.hospital ?? '',
      size_mm: exam.size_x ?? 0,
      rads_grade: radsGradeFromExam(exam),
      updated_at: exam.updated_at,
    })),
    report_images: reportImages.map((image) => ({
      local_id: image.id,
      examination_local_id: image.examination_id,
      object_key: image.uri,
      mime_type: image.mime_type ?? '',
      size_bytes: 0,
      sha256: '',
      updated_at: image.created_at,
    })),
    reminders: reminders.map((reminder) => ({
      local_id: reminder.id,
      lesion_local_id: reminder.lesion_id,
      next_exam_date: reminder.next_exam_date,
      remind1m_sent: false,
      remind1w_sent: false,
      remind3d_sent: false,
      remind0d_sent: false,
      updated_at: reminder.updated_at,
    })),
  };
}

export async function syncCloudArchiveIfEntitled(status: Pick<SubscriptionStatus, 'isCloudSyncEnabled'> | null | undefined) {
  if (!status?.isCloudSyncEnabled) {
    return { skipped: true as const, reason: 'not_entitled' as const };
  }

  const payload = await buildCloudArchivePayload();
  const reply = await api.post<{ synced_count?: number }>('/api/v1/archive/sync', payload);
  return { skipped: false as const, syncedCount: reply.synced_count ?? 0 };
}
