import { listExaminationsByLesion } from '@/lib/db/queries/examinations';
import { listLesionsByProfile } from '@/lib/db/queries/lesions';
import { listProfiles } from '@/lib/db/queries/profiles';
import { listActiveRemindersByProfile } from '@/lib/db/queries/reminders';
import type { DiseaseType, Examination, Lesion, Profile, Reminder } from '@/lib/db/types';

const DISEASE_ORDER: DiseaseType[] = ['thyroid', 'breast', 'lung'];
const DISEASE_LABELS: Record<DiseaseType, string> = {
  thyroid: '甲状腺',
  breast: '乳腺',
  lung: '肺',
};
const MS_PER_DAY = 86400000;

export type HomeEntitlementState = {
  isActive: boolean;
  featureRemaining?: Record<string, number>;
};

export type HomeProfileRow = {
  id: string;
  nickname: string;
  isActive: boolean;
  lesionCount: number;
  subtitle: string;
  isUrgent: boolean;
};

export type HomeLesionCard = {
  id: string;
  diseaseType: DiseaseType;
  title: string;
  subtitle: string;
  statusBadge: { text: string; variant: 'increase' | 'new' | 'stable' | 'neutral' } | null;
  latestExamId: string | null;
  latestSize: string;
  radsGrade: string;
  baselineChange: string;
  recordCount: number;
  reminderText: string;
  reminderTone: 'urgent' | 'normal';
};

export type HomeDiseaseGroup = {
  diseaseType: DiseaseType;
  title: string;
  lesionCards: HomeLesionCard[];
};

export type HomeUrgentReview = {
  profileId: string;
  profileNickname: string;
  lesionId: string;
  lesionLabel: string;
  diseaseType: DiseaseType;
  daysUntil: number;
  isUrgent: boolean;
  text: string;
};

export type HomeQuotaPrompt = {
  feature: 'ai_recognize';
  remaining: number;
  severity: 'warning' | 'blocked';
  title: string;
  actionLabel: string;
};

export type HomeProjection = {
  activeProfileId: string | null;
  profiles: HomeProfileRow[];
  diseaseGroups: HomeDiseaseGroup[];
  latestExamsByLesionId: Record<string, Examination>;
  urgentReview: HomeUrgentReview | null;
  quotaPrompt: HomeQuotaPrompt | null;
  addRecord: {
    visible: true;
    targetProfileId: string | null;
    label: string;
    emptyState: 'no-profiles' | 'no-lesions' | null;
  };
};

function startOfDayMillis(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function daysUntil(dateText: string | null | undefined, now: Date) {
  if (!dateText) return undefined;
  const target = new Date(dateText);
  if (Number.isNaN(target.getTime())) return undefined;
  return Math.ceil((startOfDayMillis(target) - startOfDayMillis(now)) / MS_PER_DAY);
}

function sizeScalar(exam: Examination) {
  const values = [exam.size_x, exam.size_y, exam.size_z].filter((value): value is number => value !== null);
  return values.length > 0 ? Math.max(...values) : null;
}

function formatSize(exam: Examination | undefined) {
  if (!exam) return '待补充';
  const values = [exam.size_x, exam.size_y, exam.size_z].filter((value): value is number => value !== null);
  if (values.length === 0) return '待补充';
  return `${values.map((value) => `${value}`).join('×')}mm`;
}

function radsGrade(exam: Examination | undefined) {
  if (!exam) return '待补充分级';
  if (exam.tirads) return `TI-RADS ${exam.tirads}`;
  if (exam.birads) return `BI-RADS ${exam.birads}`;
  if (exam.lung_rads) return `Lung-RADS ${exam.lung_rads}`;
  return '待补充分级';
}

function sortExams(exams: Examination[]) {
  return [...exams].sort((a, b) => {
    const byDate = b.exam_date.localeCompare(a.exam_date);
    if (byDate !== 0) return byDate;
    return b.created_at.localeCompare(a.created_at);
  });
}

function buildLesionCard(lesion: Lesion, exams: Examination[], reminder: Reminder | undefined, now: Date): HomeLesionCard {
  const sortedExams = sortExams(exams);
  const latestExam = sortedExams[0];
  const baselineExam = sortedExams.length > 1 ? sortedExams[sortedExams.length - 1] : undefined;
  const recordCount = sortedExams.length;
  const latestScalar = latestExam ? sizeScalar(latestExam) : null;
  const baselineScalar = baselineExam ? sizeScalar(baselineExam) : null;
  const percent = latestScalar !== null && baselineScalar !== null && baselineScalar > 0
    ? (latestScalar - baselineScalar) / baselineScalar
    : null;
  const absPercent = percent === null ? null : Math.round(Math.abs(percent) * 100);
  const reminderDays = daysUntil(reminder?.next_exam_date, now);

  const statusBadge = (() => {
    if (recordCount <= 1) return { text: '新建', variant: 'new' as const };
    if (percent !== null && absPercent !== null) {
      if (absPercent >= 5) return percent > 0 ? { text: '▲ 增大', variant: 'increase' as const } : { text: '▼ 减小', variant: 'stable' as const };
      return { text: '— 稳定', variant: 'stable' as const };
    }
    return { text: '待补充', variant: 'neutral' as const };
  })();

  const baselineChange = (() => {
    if (recordCount <= 1 || percent === null || absPercent === null || absPercent < 5) return '—';
    return `${percent > 0 ? '▲' : '▼'}${absPercent}%`;
  })();

  const reminderText = (() => {
    if (reminderDays === undefined) return '未设置提醒';
    if (reminderDays < 0) return `已逾期${Math.abs(reminderDays)}天`;
    if (reminderDays === 0) return '今天复查';
    return `${reminderDays}天后复查`;
  })();

  const location = lesion.location.trim() || '待补充部位';

  return {
    id: lesion.id,
    diseaseType: lesion.disease_type,
    title: lesion.label,
    subtitle: `${DISEASE_LABELS[lesion.disease_type]} · ${location}`,
    statusBadge,
    latestExamId: latestExam?.id ?? null,
    latestSize: formatSize(latestExam),
    radsGrade: radsGrade(latestExam),
    baselineChange,
    recordCount,
    reminderText,
    reminderTone: reminderDays !== undefined && reminderDays <= 30 ? 'urgent' : 'normal',
  };
}

export type BuildHomeProjectionInput = {
  profiles: Profile[];
  activeProfileId: string | null;
  lesions: Lesion[];
  examinations: Examination[];
  reminders: Reminder[];
  entitlement: HomeEntitlementState | null;
  now: Date;
};

export type LoadLocalHomeProjectionInput = {
  activeProfileId: string | null;
  entitlement: HomeEntitlementState | null;
  now?: Date;
};

export function buildHomeProjection(input: BuildHomeProjectionInput): HomeProjection {
  const activeProfileId = input.profiles.some((profile) => profile.id === input.activeProfileId)
    ? input.activeProfileId
    : input.profiles[0]?.id ?? null;
  const activeLesions = input.lesions.filter((lesion) => lesion.is_archived === 0);
  const activeLesionIds = new Set(activeLesions.map((lesion) => lesion.id));
  const activeReminders = input.reminders.filter((reminder) => reminder.is_active === 1 && activeLesionIds.has(reminder.lesion_id));
  const lesionsByProfileId = new Map<string, Lesion[]>();
  const examsByLesionId = new Map<string, Examination[]>();
  const remindersByLesionId = new Map<string, Reminder>();

  for (const lesion of activeLesions) {
    lesionsByProfileId.set(lesion.profile_id, [...(lesionsByProfileId.get(lesion.profile_id) ?? []), lesion]);
  }
  for (const exam of input.examinations) {
    if (!activeLesionIds.has(exam.lesion_id)) continue;
    examsByLesionId.set(exam.lesion_id, [...(examsByLesionId.get(exam.lesion_id) ?? []), exam]);
  }
  for (const reminder of activeReminders) {
    const existing = remindersByLesionId.get(reminder.lesion_id);
    if (!existing || reminder.next_exam_date.localeCompare(existing.next_exam_date) < 0) {
      remindersByLesionId.set(reminder.lesion_id, reminder);
    }
  }

  const latestExamsByLesionId: Record<string, Examination> = {};
  for (const [lesionId, exams] of examsByLesionId.entries()) {
    const latest = sortExams(exams)[0];
    if (latest) latestExamsByLesionId[lesionId] = latest;
  }

  const urgentCandidates = activeReminders
    .map((reminder) => {
      const days = daysUntil(reminder.next_exam_date, input.now);
      const lesion = activeLesions.find((item) => item.id === reminder.lesion_id);
      const profile = input.profiles.find((item) => item.id === lesion?.profile_id);
      if (days === undefined || !lesion || !profile) return null;
      return { reminder, lesion, profile, days };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.days - b.days);

  const urgentReview = (() => {
    const candidate = urgentCandidates[0];
    if (!candidate) return null;
    const isUrgent = candidate.days <= 30;
    const diseaseLabel = DISEASE_LABELS[candidate.lesion.disease_type];
    const text = (() => {
      if (candidate.days < 0) return `${candidate.profile.nickname}的${diseaseLabel}复查已逾期 ${Math.abs(candidate.days)} 天`;
      if (candidate.days === 0) return `${candidate.profile.nickname}今天需要${diseaseLabel}复查`;
      return `${candidate.profile.nickname}的${diseaseLabel}复查还有 ${candidate.days} 天`;
    })();
    return {
      profileId: candidate.profile.id,
      profileNickname: candidate.profile.nickname,
      lesionId: candidate.lesion.id,
      lesionLabel: candidate.lesion.label,
      diseaseType: candidate.lesion.disease_type,
      daysUntil: candidate.days,
      isUrgent,
      text,
    };
  })();

  const profiles = input.profiles.map((profile) => {
    const profileLesions = lesionsByProfileId.get(profile.id) ?? [];
    const nearestReminder = urgentCandidates.find((candidate) => candidate.profile.id === profile.id);
    const isActive = profile.id === activeProfileId;
    const isUrgent = !isActive && nearestReminder !== undefined && nearestReminder.days <= 30;
    return {
      id: profile.id,
      nickname: profile.nickname,
      isActive,
      lesionCount: profileLesions.length,
      subtitle: isUrgent
        ? nearestReminder.days < 0
          ? `已逾期${Math.abs(nearestReminder.days)}天!`
          : `${nearestReminder.days}天后!`
        : `${profileLesions.length}个病灶`,
      isUrgent,
    };
  });

  const activeProfileLesions = activeProfileId ? (lesionsByProfileId.get(activeProfileId) ?? []) : [];
  const diseaseGroups = DISEASE_ORDER
    .map((diseaseType) => ({
      diseaseType,
      title: DISEASE_LABELS[diseaseType],
      lesionCards: activeProfileLesions
        .filter((lesion) => lesion.disease_type === diseaseType)
        .map((lesion) => buildLesionCard(lesion, examsByLesionId.get(lesion.id) ?? [], remindersByLesionId.get(lesion.id), input.now)),
    }))
    .filter((group) => group.lesionCards.length > 0);

  const remaining = input.entitlement?.isActive ? undefined : input.entitlement?.featureRemaining?.ai_recognize;
  const quotaPrompt = typeof remaining === 'number'
    ? {
      feature: 'ai_recognize' as const,
      remaining,
      severity: remaining === 0 ? 'blocked' as const : 'warning' as const,
      title: remaining === 0 ? '本月 AI 识别已用完' : `本月 AI 识别剩余 ${remaining} 次`,
      actionLabel: '升级',
    }
    : null;

  return {
    activeProfileId,
    profiles,
    diseaseGroups,
    latestExamsByLesionId,
    urgentReview,
    quotaPrompt,
    addRecord: {
      visible: true,
      targetProfileId: activeProfileId,
      label: '添加第一个病灶记录',
      emptyState: input.profiles.length === 0 ? 'no-profiles' : activeProfileLesions.length === 0 ? 'no-lesions' : null,
    },
  };
}

export async function loadLocalHomeProjection(input: LoadLocalHomeProjectionInput) {
  const profiles = await listProfiles();
  const lesionGroups = await Promise.all(profiles.map((profile) => listLesionsByProfile(profile.id)));
  const reminderGroups = await Promise.all(profiles.map((profile) => listActiveRemindersByProfile(profile.id)));
  const lesions = lesionGroups.flat();
  const activeLesions = lesions.filter((lesion) => lesion.is_archived === 0);
  const examinationGroups = await Promise.all(activeLesions.map((lesion) => listExaminationsByLesion(lesion.id)));

  return buildHomeProjection({
    profiles,
    activeProfileId: input.activeProfileId,
    lesions,
    examinations: examinationGroups.flat(),
    reminders: reminderGroups.flat(),
    entitlement: input.entitlement,
    now: input.now ?? new Date(),
  });
}

export type { DiseaseType };
