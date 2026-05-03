import { buildClinicalSummaryProjection, buildComparisonProjection, buildLesionDetailProjection } from '@/lib/archive/projections';
import type { Examination, Lesion, Profile, Reminder, ReportImage } from '@/lib/db/types';

function profile(overrides: Partial<Profile> & Pick<Profile, 'id'>): Profile {
  return {
    nickname: '张女士',
    gender: 'female',
    birth_year: 1988,
    avatar_uri: null,
    sort_order: 0,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function lesion(overrides: Partial<Lesion> & Pick<Lesion, 'id'>): Lesion {
  return {
    profile_id: 'profile-1',
    disease_type: 'thyroid',
    label: '左叶结节',
    location: '左叶中下段',
    is_archived: 0,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function exam(overrides: Partial<Examination> & Pick<Examination, 'id' | 'exam_date'>): Examination {
  return {
    lesion_id: 'lesion-1',
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
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function image(overrides: Partial<ReportImage> & Pick<ReportImage, 'id' | 'examination_id' | 'uri'>): ReportImage {
  return {
    sort_order: 0,
    mime_type: 'image/jpeg',
    created_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function reminder(overrides: Partial<Reminder> & Pick<Reminder, 'id' | 'lesion_id' | 'next_exam_date'>): Reminder {
  return {
    source: 'auto',
    is_active: 1,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('archive projections', () => {
  it('selects latest and baseline detail timeline entries with previous and baseline deltas plus report image groups', () => {
    const projection = buildLesionDetailProjection({
      lesion: lesion({ id: 'lesion-1' }),
      examinations: [
        exam({ id: 'exam-middle', exam_date: '2025-07-01', size_x: 8.0, tirads: '3' }),
        exam({ id: 'exam-latest', exam_date: '2026-01-10', size_x: 10.0, tirads: '4a' }),
        exam({ id: 'exam-baseline', exam_date: '2025-01-01', size_x: 5.0, tirads: '3' }),
      ],
      reportImages: [
        image({ id: 'img-latest-2', examination_id: 'exam-latest', uri: 'latest-2.jpg', sort_order: 2 }),
        image({ id: 'img-latest-1', examination_id: 'exam-latest', uri: 'latest-1.jpg', sort_order: 1 }),
        image({ id: 'img-baseline', examination_id: 'exam-baseline', uri: 'baseline.jpg' }),
      ],
    });

    expect(projection).toEqual(expect.objectContaining({
      latestExamId: 'exam-latest',
      baselineExamId: 'exam-baseline',
      timeline: expect.arrayContaining([
        expect.objectContaining({
          examId: 'exam-latest',
          isLatest: true,
          previousDelta: expect.objectContaining({ absoluteLabel: '+2.0mm 较上次', percentageLabel: '+25%' }),
          baselineDelta: expect.objectContaining({ absoluteLabel: '+5.0mm 较基线', percentageLabel: '+100%' }),
          reportImages: [
            expect.objectContaining({ id: 'img-latest-1', uri: 'latest-1.jpg' }),
            expect.objectContaining({ id: 'img-latest-2', uri: 'latest-2.jpg' }),
          ],
        }),
      ]),
    }));
  });

  it('builds comparison windows with disease-specific qualitative rows for thyroid, breast, and lung records', () => {
    const lungExams = [
      exam({ id: 'exam-5', exam_date: '2026-05-01', size_x: 9, lung_rads: '4a', density: '实性', morphology: '分叶', pleural_pull: 1 }),
      exam({ id: 'exam-4', exam_date: '2026-04-01', size_x: 8, lung_rads: '3', density: '磨玻璃', morphology: '圆形', pleural_pull: 0 }),
      exam({ id: 'exam-3', exam_date: '2026-03-01', size_x: 7, lung_rads: '3', density: '磨玻璃', morphology: '圆形', pleural_pull: 0 }),
      exam({ id: 'exam-2', exam_date: '2026-02-01', size_x: 6, lung_rads: '2', density: '磨玻璃', morphology: '圆形', pleural_pull: 0 }),
      exam({ id: 'exam-1', exam_date: '2026-01-01', size_x: 5, lung_rads: '2', density: '磨玻璃', morphology: '圆形', pleural_pull: 0 }),
    ];
    const latest5 = buildComparisonProjection({
      lesion: lesion({ id: 'lesion-1', disease_type: 'lung' }),
      examinations: lungExams,
      window: { mode: 'latest5' },
    });
    const latest3 = buildComparisonProjection({
      lesion: lesion({ id: 'lesion-1', disease_type: 'lung' }),
      examinations: lungExams,
      window: { mode: 'latest3' },
    });
    const custom = buildComparisonProjection({
      lesion: lesion({ id: 'lesion-1', disease_type: 'lung' }),
      examinations: lungExams,
      window: { mode: 'custom', start: '2026-02-01', end: '2026-04-01' },
    });
    const thyroid = buildComparisonProjection({
      lesion: lesion({ id: 'lesion-thyroid', disease_type: 'thyroid' }),
      examinations: [exam({ id: 'thyroid-2', exam_date: '2026-02-01', tirads: '4a' }), exam({ id: 'thyroid-1', exam_date: '2026-01-01', tirads: '3' })],
      window: { mode: 'latest3' },
    });
    const breast = buildComparisonProjection({
      lesion: lesion({ id: 'lesion-breast', disease_type: 'breast' }),
      examinations: [exam({ id: 'breast-2', exam_date: '2026-02-01', birads: '4a', shape: '不规则' }), exam({ id: 'breast-1', exam_date: '2026-01-01', birads: '3', shape: '椭圆形' })],
      window: { mode: 'latest3' },
    });

    expect({ latest5, latest3, custom, thyroidLabels: thyroid.qualitativeRows.map((row) => row.label), breastLabels: breast.qualitativeRows.map((row) => row.label) }).toEqual(expect.objectContaining({
      latest5: expect.objectContaining({
        selectedExamIds: ['exam-5', 'exam-4', 'exam-3', 'exam-2', 'exam-1'],
        chainExamIds: ['exam-1', 'exam-2', 'exam-3', 'exam-4', 'exam-5'],
        vsPrevious: expect.objectContaining({ absoluteLabel: '+1.0mm 较上次', percentageLabel: '+13%' }),
        vsBaseline: expect.objectContaining({ absoluteLabel: '+4.0mm 较基线', percentageLabel: '+80%' }),
        qualitativeRows: expect.arrayContaining([
          expect.objectContaining({ key: 'lung_rads', label: 'LUNG-RADS', values: ['2级', '2级', '3级', '3级', '4a级'], hasChanged: true }),
          expect.objectContaining({ key: 'pleural_pull', label: '胸膜牵拉', values: ['无', '无', '无', '无', '有'], hasChanged: true, conclusionType: 'new' }),
        ]),
      }),
      latest3: expect.objectContaining({ selectedExamIds: ['exam-5', 'exam-4', 'exam-3'] }),
      custom: expect.objectContaining({ selectedExamIds: ['exam-4', 'exam-3', 'exam-2'] }),
      thyroidLabels: expect.arrayContaining(['TI-RADS', '钙化', '回声', '边界']),
      breastLabels: expect.arrayContaining(['BI-RADS', '形状', '走向']),
    }));
  });

  it('keeps summary reminders keyed by stable lesion id across duplicate labels and renames', () => {
    const first = lesion({ id: 'lesion-first', disease_type: 'thyroid', label: '同名结节' });
    const second = lesion({ id: 'lesion-second', disease_type: 'thyroid', label: '同名结节' });

    const projection = buildClinicalSummaryProjection({
      profile: profile({ id: 'profile-1' }),
      lesions: [first, second],
      examinationsByLesionId: {
        [first.id]: [exam({ id: 'exam-first', lesion_id: first.id, exam_date: '2026-04-01', size_x: 6, tirads: '3' })],
        [second.id]: [exam({ id: 'exam-second', lesion_id: second.id, exam_date: '2026-04-02', size_x: 7, tirads: '3' })],
      },
      reminders: [reminder({ id: 'reminder-second', lesion_id: second.id, next_exam_date: '2026-05-01' })],
      now: new Date('2026-04-27T00:00:00.000Z'),
    });

    expect(projection.lesionBlocks).toEqual([
      expect.objectContaining({ lesionId: first.id, label: '同名结节', reminderText: null, needsAttention: false }),
      expect.objectContaining({ lesionId: second.id, label: '同名结节', reminderText: '建议复查 2026-05-01 · 还有4天', needsAttention: true }),
    ]);
  });

  it('builds clinical summary patient stats attention counts one-record fallbacks and disclaimer from archive state', () => {
    const thyroid = lesion({ id: 'lesion-thyroid', disease_type: 'thyroid', label: '甲状腺结节' });
    const breast = lesion({ id: 'lesion-breast', disease_type: 'breast', label: '乳腺结节', location: '右乳10点钟' });
    const projection = buildClinicalSummaryProjection({
      profile: profile({ id: 'profile-1', birth_year: 1980 }),
      lesions: [thyroid, breast],
      examinationsByLesionId: {
        [thyroid.id]: [
          exam({ id: 'thyroid-new', exam_date: '2026-04-01', size_x: 9, tirads: '4a', lesion_id: thyroid.id }),
          exam({ id: 'thyroid-old', exam_date: '2025-04-01', size_x: 6, tirads: '3', lesion_id: thyroid.id }),
        ],
        [breast.id]: [
          exam({ id: 'breast-only', exam_date: '2026-03-01', size_x: 11, birads: '2', shape: '椭圆形', lesion_id: breast.id }),
        ],
      },
      reminders: [reminder({ id: 'reminder-thyroid', lesion_id: thyroid.id, next_exam_date: '2026-05-01' })],
      now: new Date('2026-04-27T00:00:00.000Z'),
    });

    expect(projection).toEqual(expect.objectContaining({
      patient: expect.objectContaining({ nickname: '张女士', genderLabel: '女', ageLabel: '46岁' }),
      stats: { lesionCount: 2, examCount: 3, attentionCount: 1 },
      lesionBlocks: expect.arrayContaining([
        expect.objectContaining({
          lesionId: thyroid.id,
          vsPrevious: expect.objectContaining({ absoluteLabel: '+3.0mm 较上次', percentageLabel: '+50%' }),
          vsBaseline: expect.objectContaining({ absoluteLabel: '+3.0mm 较基线', percentageLabel: '+50%' }),
          reminderText: '建议复查 2026-05-01 · 还有4天',
        }),
        expect.objectContaining({
          lesionId: breast.id,
          oneRecordFallback: '仅1次检查记录，持续记录后可生成趋势对比',
          vsPrevious: null,
          vsBaseline: null,
        }),
      ]),
      disclaimer: '本摘要由「结节档案」生成，仅供医生参考，不构成诊断意见。',
    }));
  });

  it('accepts full ISO reminder dates when calculating summary reminder days and attention counts', () => {
    const thyroid = lesion({ id: 'lesion-thyroid', disease_type: 'thyroid', label: '甲状腺结节' });
    const projection = buildClinicalSummaryProjection({
      profile: profile({ id: 'profile-1', birth_year: 1980 }),
      lesions: [thyroid],
      examinationsByLesionId: {
        [thyroid.id]: [
          exam({ id: 'thyroid-new', exam_date: '2026-04-01', size_x: 6, tirads: '3', lesion_id: thyroid.id }),
          exam({ id: 'thyroid-old', exam_date: '2025-04-01', size_x: 6, tirads: '3', lesion_id: thyroid.id }),
        ],
      },
      reminders: [reminder({ id: 'reminder-thyroid', lesion_id: thyroid.id, next_exam_date: '2026-05-01T00:00:00.000Z' })],
      now: new Date('2026-04-27T00:00:00.000Z'),
    });

    expect(projection).toEqual(expect.objectContaining({
      stats: { lesionCount: 1, examCount: 2, attentionCount: 1 },
      lesionBlocks: [
        expect.objectContaining({
          lesionId: thyroid.id,
          reminderText: '建议复查 2026-05-01T00:00:00.000Z · 还有4天',
          needsAttention: true,
        }),
      ],
    }));
  });
});
