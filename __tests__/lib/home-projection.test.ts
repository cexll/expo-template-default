import type { Examination, Lesion, Profile, Reminder } from '@/lib/db/types';
import { buildHomeProjection, type HomeEntitlementState } from '@/lib/home/projection';

const NOW = new Date('2026-04-27T00:00:00.000Z');

function profile(overrides: Partial<Profile> & Pick<Profile, 'id' | 'nickname'>): Profile {
  return {
    gender: 'female',
    birth_year: 1988,
    avatar_uri: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function lesion(overrides: Partial<Lesion> & Pick<Lesion, 'id' | 'profile_id' | 'disease_type' | 'label'>): Lesion {
  return {
    location: '左叶',
    is_archived: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function exam(overrides: Partial<Examination> & Pick<Examination, 'id' | 'lesion_id' | 'exam_date'>): Examination {
  return {
    hospital: null,
    size_x: null,
    size_y: null,
    size_z: null,
    tirads: null,
    echo_type: null,
    border: null,
    calcification: null,
    blood_flow: null,
    birads: null,
    shape: null,
    orientation: null,
    lung_rads: null,
    density: null,
    morphology: null,
    pleural_pull: null,
    ai_raw_json: null,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function reminder(overrides: Partial<Reminder> & Pick<Reminder, 'id' | 'lesion_id' | 'next_exam_date'>): Reminder {
  return {
    source: 'auto',
    is_active: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function projectionInput(overrides: {
  profiles?: Profile[];
  activeProfileId?: string | null;
  lesions?: Lesion[];
  examinations?: Examination[];
  reminders?: Reminder[];
  entitlement?: HomeEntitlementState | null;
}) {
  return {
    profiles: overrides.profiles ?? [],
    activeProfileId: overrides.activeProfileId ?? null,
    lesions: overrides.lesions ?? [],
    examinations: overrides.examinations ?? [],
    reminders: overrides.reminders ?? [],
    entitlement: overrides.entitlement ?? null,
    now: NOW,
  };
}

describe('buildHomeProjection', () => {
  it('represents the empty archive with no active profile and an add-record affordance', () => {
    const projection = buildHomeProjection(projectionInput({}));

    expect(projection.activeProfileId).toBeNull();
    expect(projection.profiles).toEqual([]);
    expect(projection.diseaseGroups).toEqual([]);
    expect(projection.urgentReview).toBeNull();
    expect(projection.addRecord).toEqual({ visible: true, targetProfileId: null, label: '添加第一个病灶记录', emptyState: 'no-profiles' });
  });

  it('represents a profile with no lesions and exposes lesion-count subtitle plus no-lesion affordance', () => {
    const projection = buildHomeProjection(projectionInput({ profiles: [profile({ id: 'profile-1', nickname: '本人' })] }));

    expect(projection.activeProfileId).toBe('profile-1');
    expect(projection.profiles).toEqual([
      expect.objectContaining({ id: 'profile-1', nickname: '本人', isActive: true, lesionCount: 0, subtitle: '0个病灶', isUrgent: false }),
    ]);
    expect(projection.diseaseGroups).toEqual([]);
    expect(projection.addRecord.emptyState).toBe('no-lesions');
  });

  it('falls back to the first existing profile when the active profile id is invalid', () => {
    const projection = buildHomeProjection(projectionInput({
      profiles: [profile({ id: 'profile-1', nickname: '本人' }), profile({ id: 'profile-2', nickname: '妈妈' })],
      activeProfileId: 'missing-profile',
    }));

    expect(projection.activeProfileId).toBe('profile-1');
  });

  it('projects a single lesion card from latest and baseline examinations plus entitlement quota prompt', () => {
    const thyroid = lesion({ id: 'lesion-1', profile_id: 'profile-1', disease_type: 'thyroid', label: '左叶结节', location: '左叶中下段' });
    const projection = buildHomeProjection(projectionInput({
      profiles: [profile({ id: 'profile-1', nickname: '本人' })],
      activeProfileId: 'profile-1',
      lesions: [thyroid],
      examinations: [
        exam({ id: 'exam-new', lesion_id: thyroid.id, exam_date: '2026-04-10', size_x: 10, size_y: 8, tirads: '4a' }),
        exam({ id: 'exam-old', lesion_id: thyroid.id, exam_date: '2025-10-10', size_x: 8, size_y: 8, tirads: '3' }),
      ],
      reminders: [reminder({ id: 'reminder-1', lesion_id: thyroid.id, next_exam_date: '2026-05-20T00:00:00.000Z' })],
      entitlement: { isActive: false, featureRemaining: { ai_recognize: 2 } },
    }));

    expect(projection.latestExamsByLesionId[thyroid.id]?.id).toBe('exam-new');
    expect(projection.diseaseGroups).toEqual([
      expect.objectContaining({
        diseaseType: 'thyroid',
        title: '甲状腺',
        lesionCards: [
          expect.objectContaining({
            id: thyroid.id,
            title: '左叶结节',
            subtitle: '甲状腺 · 左叶中下段',
            latestExamId: 'exam-new',
            latestSize: '10×8mm',
            radsGrade: 'TI-RADS 4a',
            baselineChange: '▲25%',
            recordCount: 2,
            reminderText: '23天后复查',
            reminderTone: 'urgent',
            statusBadge: { text: '▲ 增大', variant: 'increase' },
          }),
        ],
      }),
    ]);
    expect(projection.quotaPrompt).toEqual({ feature: 'ai_recognize', remaining: 2, severity: 'warning', title: '本月 AI 识别剩余 2 次', actionLabel: '升级' });
    expect(projection.addRecord.emptyState).toBeNull();
  });

  it('groups multiple active lesions by disease and keeps latest exams disease-specific', () => {
    const thyroid = lesion({ id: 'lesion-thyroid', profile_id: 'profile-1', disease_type: 'thyroid', label: '甲状腺结节' });
    const breast = lesion({ id: 'lesion-breast', profile_id: 'profile-1', disease_type: 'breast', label: '乳腺结节', location: '右乳10点钟' });
    const lung = lesion({ id: 'lesion-lung', profile_id: 'profile-1', disease_type: 'lung', label: '肺结节', location: '右上叶' });

    const projection = buildHomeProjection(projectionInput({
      profiles: [profile({ id: 'profile-1', nickname: '本人' })],
      activeProfileId: 'profile-1',
      lesions: [breast, lung, thyroid],
      examinations: [
        exam({ id: 'exam-thyroid', lesion_id: thyroid.id, exam_date: '2026-02-01', size_x: 6, tirads: '3' }),
        exam({ id: 'exam-breast', lesion_id: breast.id, exam_date: '2026-03-01', size_x: 12, birads: '3' }),
        exam({ id: 'exam-lung', lesion_id: lung.id, exam_date: '2026-04-01', size_x: 5.4, lung_rads: '2' }),
      ],
    }));

    expect(projection.diseaseGroups.map((group) => group.diseaseType)).toEqual(['thyroid', 'breast', 'lung']);
    expect(projection.diseaseGroups.map((group) => group.lesionCards[0].radsGrade)).toEqual(['TI-RADS 3', 'BI-RADS 3', 'Lung-RADS 2']);
    expect(projection.profiles[0]).toEqual(expect.objectContaining({ lesionCount: 3, subtitle: '3个病灶' }));
  });

  it('excludes archived lesions from counts, groups, latest exams, and reminders', () => {
    const archived = lesion({ id: 'archived-lesion', profile_id: 'profile-1', disease_type: 'breast', label: '已归档结节', is_archived: 1 });
    const projection = buildHomeProjection(projectionInput({
      profiles: [profile({ id: 'profile-1', nickname: '本人' })],
      activeProfileId: 'profile-1',
      lesions: [archived],
      examinations: [exam({ id: 'archived-exam', lesion_id: archived.id, exam_date: '2026-04-01', birads: '4a' })],
      reminders: [reminder({ id: 'archived-reminder', lesion_id: archived.id, next_exam_date: '2026-04-29T00:00:00.000Z' })],
    }));

    expect(projection.profiles[0].lesionCount).toBe(0);
    expect(projection.diseaseGroups).toEqual([]);
    expect(projection.latestExamsByLesionId).toEqual({});
    expect(projection.urgentReview).toBeNull();
  });

  it('selects the nearest urgent reminder across profiles and marks the profile switcher row', () => {
    const selfLesion = lesion({ id: 'lesion-self', profile_id: 'profile-self', disease_type: 'thyroid', label: '本人结节' });
    const momLesion = lesion({ id: 'lesion-mom', profile_id: 'profile-mom', disease_type: 'breast', label: '妈妈结节' });

    const projection = buildHomeProjection(projectionInput({
      profiles: [profile({ id: 'profile-self', nickname: '本人' }), profile({ id: 'profile-mom', nickname: '妈妈', sort_order: 1 })],
      activeProfileId: 'profile-self',
      lesions: [selfLesion, momLesion],
      reminders: [
        reminder({ id: 'reminder-self', lesion_id: selfLesion.id, next_exam_date: '2026-05-25T00:00:00.000Z' }),
        reminder({ id: 'reminder-mom', lesion_id: momLesion.id, next_exam_date: '2026-04-30T00:00:00.000Z' }),
      ],
    }));

    expect(projection.urgentReview).toEqual(expect.objectContaining({ profileId: 'profile-mom', profileNickname: '妈妈', lesionId: momLesion.id, lesionLabel: '妈妈结节', diseaseType: 'breast', daysUntil: 3, isUrgent: true }));
    expect(projection.profiles.find((item) => item.id === 'profile-mom')).toEqual(expect.objectContaining({ subtitle: '3天后!', isUrgent: true }));
    expect(projection.profiles.find((item) => item.id === 'profile-self')).toEqual(expect.objectContaining({ subtitle: '1个病灶', isUrgent: false }));
  });

  it('renders overdue copy for inactive profile reminder subtitles instead of negative countdown text', () => {
    const selfLesion = lesion({ id: 'lesion-self', profile_id: 'profile-self', disease_type: 'thyroid', label: '本人结节' });
    const momLesion = lesion({ id: 'lesion-mom', profile_id: 'profile-mom', disease_type: 'breast', label: '妈妈结节' });

    const projection = buildHomeProjection(projectionInput({
      profiles: [profile({ id: 'profile-self', nickname: '本人' }), profile({ id: 'profile-mom', nickname: '妈妈', sort_order: 1 })],
      activeProfileId: 'profile-self',
      lesions: [selfLesion, momLesion],
      reminders: [reminder({ id: 'reminder-mom', lesion_id: momLesion.id, next_exam_date: '2026-04-20T00:00:00.000Z' })],
    }));

    expect(projection.profiles.find((item) => item.id === 'profile-mom')).toEqual(expect.objectContaining({ subtitle: '已逾期7天!', isUrgent: true }));
  });

  it('keeps reminder projections keyed by stable lesion ids across duplicate labels and label rename', () => {
    const first = lesion({ id: 'lesion-first', profile_id: 'profile-1', disease_type: 'thyroid', label: '同名结节', location: '左叶' });
    const second = lesion({ id: 'lesion-second', profile_id: 'profile-1', disease_type: 'thyroid', label: '同名结节-重命名', location: '右叶' });

    const projection = buildHomeProjection(projectionInput({
      profiles: [profile({ id: 'profile-1', nickname: '本人' })],
      activeProfileId: 'profile-1',
      lesions: [first, second],
      reminders: [reminder({ id: 'reminder-second', lesion_id: second.id, next_exam_date: '2026-05-01T00:00:00.000Z' })],
    }));

    const cards = projection.diseaseGroups[0].lesionCards;
    expect(cards).toEqual([
      expect.objectContaining({ id: first.id, title: '同名结节', reminderText: '未设置提醒' }),
      expect.objectContaining({ id: second.id, title: '同名结节-重命名', reminderText: '4天后复查' }),
    ]);
    expect(projection.urgentReview).toEqual(expect.objectContaining({ lesionId: second.id, lesionLabel: '同名结节-重命名' }));
  });

  it('keeps the stable Home follow-up banner when the next reminder is more than 30 days away', () => {
    const thyroid = lesion({ id: 'lesion-1', profile_id: 'profile-1', disease_type: 'thyroid', label: '左叶结节' });

    const projection = buildHomeProjection(projectionInput({
      profiles: [profile({ id: 'profile-1', nickname: '本人' })],
      activeProfileId: 'profile-1',
      lesions: [thyroid],
      reminders: [reminder({ id: 'reminder-1', lesion_id: thyroid.id, next_exam_date: '2026-06-30T00:00:00.000Z' })],
    }));

    expect(projection.urgentReview).toEqual(expect.objectContaining({
      profileId: 'profile-1',
      profileNickname: '本人',
      lesionId: thyroid.id,
      lesionLabel: thyroid.label,
      diseaseType: 'thyroid',
      daysUntil: 64,
      isUrgent: false,
      text: '本人的甲状腺复查还有 64 天',
    }));
  });
});
