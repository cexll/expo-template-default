import { calculateBaselineChange, calculatePreviousChange, formatChangeDisplay } from '@/lib/db/calculations';
import type { DiseaseType, Examination, Lesion, Profile, Reminder, ReportImage } from '@/lib/db/types';

type ChangeDisplay = ReturnType<typeof formatChangeDisplay>;

const MS_PER_DAY = 86400000;
const DISCLAIMER = '本摘要由「结节档案」生成，仅供医生参考，不构成诊断意见。';

const DISEASE_LABELS: Record<DiseaseType, string> = {
  thyroid: '甲状腺',
  breast: '乳腺',
  lung: '肺',
};

type QualitativeField = {
  key: keyof Examination;
  label: string;
  format: (value: unknown) => string;
};

const stringValue = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : '—');

const QUALITATIVE_FIELDS: Record<DiseaseType, QualitativeField[]> = {
  thyroid: [
    { key: 'tirads', label: 'TI-RADS', format: (value) => (stringValue(value) === '—' ? '—' : `${stringValue(value)}级`) },
    { key: 'calcification', label: '钙化', format: stringValue },
    { key: 'echo_type', label: '回声', format: stringValue },
    { key: 'border', label: '边界', format: stringValue },
    { key: 'blood_flow', label: '血流', format: stringValue },
  ],
  breast: [
    { key: 'birads', label: 'BI-RADS', format: (value) => (stringValue(value) === '—' ? '—' : `${stringValue(value)}级`) },
    { key: 'echo_type', label: '回声', format: stringValue },
    { key: 'border', label: '边界', format: stringValue },
    { key: 'shape', label: '形状', format: stringValue },
    { key: 'orientation', label: '走向', format: stringValue },
  ],
  lung: [
    { key: 'lung_rads', label: 'LUNG-RADS', format: (value) => (stringValue(value) === '—' ? '—' : `${stringValue(value)}级`) },
    { key: 'density', label: '密度', format: stringValue },
    { key: 'morphology', label: '形态', format: stringValue },
    { key: 'pleural_pull', label: '胸膜牵拉', format: (value) => (value === 1 ? '有' : value === 0 ? '无' : '—') },
  ],
};

export type ArchiveDelta = ChangeDisplay;

export type ArchiveQualitativeRow = {
  key: keyof Examination;
  label: string;
  values: string[];
  earliest: string;
  latest: string;
  hasChanged: boolean;
  changeType: 'new' | 'changed' | 'unchanged';
  conclusionType: 'new' | 'increase' | 'unchanged';
};

export type LesionDetailProjection = {
  lesion: Lesion;
  latestExamId: string | null;
  baselineExamId: string | null;
  timeline: {
    examId: string;
    examDate: string;
    isLatest: boolean;
    isBaseline: boolean;
    sizeLabel: string;
    previousDelta: ArchiveDelta | null;
    baselineDelta: ArchiveDelta | null;
    reportImages: Pick<ReportImage, 'id' | 'uri'>[];
  }[];
};

export type ComparisonWindow =
  | { mode: 'latest3' }
  | { mode: 'latest5' }
  | { mode: 'custom'; start: string; end: string };

export type ComparisonProjection = {
  lesion: Lesion;
  windowMode: ComparisonWindow['mode'];
  totalExamCount: number;
  selectedExamIds: string[];
  chainExamIds: string[];
  latestExamId: string | null;
  previousExamId: string | null;
  baselineExamId: string | null;
  vsPrevious: ArchiveDelta | null;
  vsBaseline: ArchiveDelta | null;
  quantitativeTimeline: {
    examId: string;
    examDate: string;
    month: string;
    valueMm: string;
    isLatest: boolean;
  }[];
  qualitativeRows: ArchiveQualitativeRow[];
  summaryText: string;
  insufficientWindow: boolean;
};

export type VisitSummaryProjection = {
  profile: Profile;
  patientInfo: {
    nickname: string;
    genderLabel: string;
    age: number;
    generatedDate: string;
  };
  stats: {
    lesionCount: number;
    examCount: number;
    attentionCount: number;
  };
  lesionBlocks: {
    lesionId: string;
    diseaseType: DiseaseType;
    diseaseLabel: string;
    label: string;
    location: string;
    latestExamId: string | null;
    latestSize: string;
    examCount: number;
    oneRecordFallback: boolean;
    vsPrevious: ArchiveDelta | null;
    vsBaseline: ArchiveDelta | null;
    qualitativeRows: ArchiveQualitativeRow[];
    reportImages: Pick<ReportImage, 'id' | 'uri'>[];
    reminderText: string | null;
    needsAttention: boolean;
  }[];
  disclaimer: string;
};

function sortExams(examinations: Examination[]) {
  return [...examinations].sort((a, b) => {
    const byDate = b.exam_date.localeCompare(a.exam_date);
    if (byDate !== 0) return byDate;
    return b.created_at.localeCompare(a.created_at);
  });
}

function sortImages(images: ReportImage[]) {
  return [...images].sort((a, b) => {
    const byOrder = a.sort_order - b.sort_order;
    if (byOrder !== 0) return byOrder;
    return a.created_at.localeCompare(b.created_at);
  });
}

function formatIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatMonth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 7);
  return date.toISOString().slice(0, 7);
}

function formatSize(exam: Examination | null | undefined) {
  if (!exam) return '暂无检查';
  const values = [exam.size_x, exam.size_y, exam.size_z].filter((value): value is number => value !== null);
  if (values.length === 0) return '暂无大小';
  return `${values.map((value) => `${value}`).join('×')}mm`;
}

function formatPrimarySize(value: number | null | undefined) {
  return typeof value === 'number' && !Number.isNaN(value) ? value.toFixed(1).replace(/\.0$/, '') : '—';
}

function buildDelta(current: Examination | null, reference: Examination | null, type: 'previous' | 'baseline') {
  if (!current || !reference || current.size_x === null || reference.size_x === null) return null;
  return formatChangeDisplay(
    type === 'baseline'
      ? calculateBaselineChange(current.size_x, reference.size_x)
      : calculatePreviousChange(current.size_x, reference.size_x),
    type
  );
}

function buildQualitativeRows(diseaseType: DiseaseType, selectedExamsNewestFirst: Examination[]) {
  const chain = [...selectedExamsNewestFirst].reverse();
  return QUALITATIVE_FIELDS[diseaseType].map((field) => {
    const values = chain.map((exam) => field.format(exam[field.key]));
    const earliest = values[0] ?? '—';
    const latest = values[values.length - 1] ?? '—';
    const earliestPresent = earliest !== '—';
    const latestPresent = latest !== '—';
    const hasChanged = earliest !== latest && (earliestPresent || latestPresent);
    const changeType = hasChanged && (!earliestPresent && latestPresent || field.key === 'pleural_pull' && latest === '有') ? 'new' : hasChanged ? 'changed' : 'unchanged';

    return {
      key: field.key,
      label: field.label,
      values,
      earliest,
      latest,
      hasChanged,
      changeType,
      conclusionType: changeType === 'new' ? 'new' : changeType === 'changed' ? 'increase' : 'unchanged',
    } satisfies ArchiveQualitativeRow;
  });
}

function selectWindow(examinations: Examination[], window: ComparisonWindow) {
  const sorted = sortExams(examinations);
  if (window.mode === 'latest5') return sorted.slice(0, 5);
  if (window.mode === 'custom') {
    const start = new Date(`${window.start}T00:00:00.000`);
    const end = new Date(`${window.end}T23:59:59.999`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return sorted.slice(0, 3);
    return sorted.filter((exam) => {
      const date = new Date(`${exam.exam_date}T00:00:00.000`);
      return !Number.isNaN(date.getTime()) && date >= start && date <= end;
    });
  }
  return sorted.slice(0, 3);
}

function daysUntil(dateText: string, now: Date) {
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  const target = new Date(dateOnlyPattern.test(dateText) ? `${dateText}T00:00:00.000` : dateText);
  if (Number.isNaN(target.getTime())) return null;
  const current = new Date(now);
  current.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - current.getTime()) / MS_PER_DAY);
}

function radsValue(lesion: Lesion, exam: Examination | null | undefined) {
  if (!exam) return null;
  if (lesion.disease_type === 'thyroid') return exam.tirads;
  if (lesion.disease_type === 'breast') return exam.birads;
  return exam.lung_rads;
}

function isAttentionGrade(value: string | null) {
  return Boolean(value && /[45]/.test(value));
}

function buildSummaryText(lesion: Lesion, vsBaseline: ArchiveDelta | null, vsPrevious: ArchiveDelta | null, qualitativeRows: ArchiveQualitativeRow[]) {
  if (!vsBaseline || !vsPrevious) return '检查记录不足，暂不生成变化小结。';
  const changed = qualitativeRows.find((row) => row.hasChanged && !row.label.includes('RADS'));
  const changedPart = changed
    ? changed.changeType === 'new'
      ? `本次新见${changed.label}${changed.latest === '—' ? '' : `：${changed.latest}`}，`
      : `本次${changed.label}由${changed.earliest}变为${changed.latest}，`
    : '';
  const gradeRow = qualitativeRows.find((row) => row.label.includes('RADS'));
  const gradePart = gradeRow
    ? gradeRow.hasChanged
      ? `${gradeRow.label}由${gradeRow.earliest}变为${gradeRow.latest}。`
      : `${gradeRow.label}级别未变。`
    : `${DISEASE_LABELS[lesion.disease_type]}分级待补充。`;

  return `${vsBaseline.summaryLabel} ${vsBaseline.absoluteLabel.replace(' 较基线', '')}（${vsBaseline.percentageLabel}），较上次${vsPrevious.summaryLabel.replace('较上次', '')} ${vsPrevious.absoluteLabel.replace(' 较上次', '')}（${vsPrevious.percentageLabel}）。${changedPart}${gradePart}建议按期复查。`;
}

export function buildLesionDetailProjection(input: {
  lesion: Lesion;
  examinations: Examination[];
  reportImages: ReportImage[];
}): LesionDetailProjection {
  const sortedExams = sortExams(input.examinations);
  const latestExam = sortedExams[0] ?? null;
  const baselineExam = sortedExams[sortedExams.length - 1] ?? null;

  return {
    lesion: input.lesion,
    latestExamId: latestExam?.id ?? null,
    baselineExamId: baselineExam?.id ?? null,
    timeline: sortedExams.map((exam, index) => {
      const previous = sortedExams[index + 1] ?? null;
      const isBaseline = exam.id === baselineExam?.id;

      return {
        examId: exam.id,
        examDate: exam.exam_date,
        isLatest: exam.id === latestExam?.id,
        isBaseline,
        sizeLabel: formatSize(exam),
        previousDelta: isBaseline ? null : buildDelta(exam, previous, 'previous'),
        baselineDelta: isBaseline ? null : buildDelta(exam, baselineExam, 'baseline'),
        reportImages: sortImages(input.reportImages.filter((image) => image.examination_id === exam.id))
          .map((image) => ({ id: image.id, uri: image.uri })),
      };
    }),
  };
}

export function buildComparisonProjection(input: {
  lesion: Lesion;
  examinations: Examination[];
  window: ComparisonWindow;
}): ComparisonProjection {
  const selected = selectWindow(input.examinations, input.window);
  const latest = selected[0] ?? null;
  const previous = selected[1] ?? null;
  const baseline = selected[selected.length - 1] ?? null;
  const vsPrevious = buildDelta(latest, previous, 'previous');
  const vsBaseline = latest && baseline && latest.id !== baseline.id ? buildDelta(latest, baseline, 'baseline') : null;
  const qualitativeRows = buildQualitativeRows(input.lesion.disease_type, selected);
  const chain = [...selected].reverse();

  return {
    lesion: input.lesion,
    windowMode: input.window.mode,
    totalExamCount: input.examinations.length,
    selectedExamIds: selected.map((exam) => exam.id),
    chainExamIds: chain.map((exam) => exam.id),
    latestExamId: latest?.id ?? null,
    previousExamId: previous?.id ?? null,
    baselineExamId: baseline?.id ?? null,
    vsPrevious,
    vsBaseline,
    quantitativeTimeline: chain.map((exam) => ({
      examId: exam.id,
      examDate: exam.exam_date,
      month: formatMonth(exam.exam_date),
      valueMm: formatPrimarySize(exam.size_x),
      isLatest: exam.id === latest?.id,
    })),
    qualitativeRows,
    summaryText: buildSummaryText(input.lesion, vsBaseline, vsPrevious, qualitativeRows),
    insufficientWindow: selected.length < 3,
  };
}

export function buildVisitSummaryProjection(input: {
  profile: Profile;
  lesions: Lesion[];
  examinations: Examination[];
  reminders: Reminder[];
  reportImages?: ReportImage[];
  now: Date;
}): VisitSummaryProjection {
  const activeLesions = input.lesions.filter((lesion) => lesion.profile_id === input.profile.id && lesion.is_archived === 0);
  const activeLesionIds = new Set(activeLesions.map((lesion) => lesion.id));
  const examsByLesionId = new Map<string, Examination[]>();
  const remindersByLesionId = new Map<string, Reminder>();
  const images = input.reportImages ?? [];

  for (const exam of input.examinations) {
    if (!activeLesionIds.has(exam.lesion_id)) continue;
    examsByLesionId.set(exam.lesion_id, [...(examsByLesionId.get(exam.lesion_id) ?? []), exam]);
  }
  for (const reminder of input.reminders) {
    if (!activeLesionIds.has(reminder.lesion_id) || reminder.is_active !== 1) continue;
    const existing = remindersByLesionId.get(reminder.lesion_id);
    if (!existing || reminder.next_exam_date.localeCompare(existing.next_exam_date) < 0) {
      remindersByLesionId.set(reminder.lesion_id, reminder);
    }
  }

  const lesionBlocks = activeLesions.map((lesion) => {
    const sortedExams = sortExams(examsByLesionId.get(lesion.id) ?? []);
    const comparison = buildComparisonProjection({ lesion, examinations: sortedExams, window: { mode: 'latest3' } });
    const latest = sortedExams[0] ?? null;
    const reminder = remindersByLesionId.get(lesion.id) ?? null;
    const reminderDays = reminder ? daysUntil(reminder.next_exam_date, input.now) : null;
    const lesionImageRows = sortImages(images.filter((image) => sortedExams.some((exam) => exam.id === image.examination_id)));
    const needsAttention = isAttentionGrade(radsValue(lesion, latest)) || (reminderDays !== null && reminderDays <= 30);

    return {
      lesionId: lesion.id,
      diseaseType: lesion.disease_type,
      diseaseLabel: DISEASE_LABELS[lesion.disease_type],
      label: lesion.label,
      location: lesion.location,
      latestExamId: latest?.id ?? null,
      latestSize: formatSize(latest),
      examCount: sortedExams.length,
      oneRecordFallback: sortedExams.length === 1,
      vsPrevious: sortedExams.length > 1 ? comparison.vsPrevious : null,
      vsBaseline: sortedExams.length > 1 ? comparison.vsBaseline : null,
      qualitativeRows: sortedExams.length === 1
        ? buildQualitativeRows(lesion.disease_type, sortedExams).filter((row) => row.latest !== '—')
        : comparison.qualitativeRows.filter((row) => row.hasChanged || row.label.includes('RADS')),
      reportImages: lesionImageRows.map((image) => ({ id: image.id, uri: image.uri })),
      reminderText: reminder
        ? `${reminder.next_exam_date}${reminderDays === null ? '' : reminderDays < 0 ? ` · 已逾期${Math.abs(reminderDays)}天` : ` · 还有${reminderDays}天`}`
        : null,
      needsAttention,
    };
  });

  return {
    profile: input.profile,
    patientInfo: {
      nickname: input.profile.nickname,
      genderLabel: input.profile.gender === 'female' ? '女' : '男',
      age: input.now.getFullYear() - input.profile.birth_year,
      generatedDate: formatIsoDate(input.now),
    },
    stats: {
      lesionCount: lesionBlocks.length,
      examCount: lesionBlocks.reduce((sum, block) => sum + block.examCount, 0),
      attentionCount: lesionBlocks.filter((block) => block.needsAttention).length,
    },
    lesionBlocks,
    disclaimer: DISCLAIMER,
  };
}


export function buildClinicalSummaryProjection(input: {
  profile: Profile;
  lesions: Lesion[];
  examinationsByLesionId: Record<string, Examination[]>;
  reminders: Reminder[];
  reportImages?: ReportImage[];
  now: Date;
}) {
  const examinations = Object.values(input.examinationsByLesionId).flat();
  const projection = buildVisitSummaryProjection({
    profile: input.profile,
    lesions: input.lesions,
    examinations,
    reminders: input.reminders,
    reportImages: input.reportImages,
    now: input.now,
  });

  return {
    patient: {
      nickname: projection.patientInfo.nickname,
      genderLabel: projection.patientInfo.genderLabel,
      ageLabel: `${projection.patientInfo.age}岁`,
      generatedDate: projection.patientInfo.generatedDate,
    },
    stats: projection.stats,
    lesionBlocks: projection.lesionBlocks.map((block) => ({
      ...block,
      oneRecordFallback: block.oneRecordFallback ? '仅1次检查记录，持续记录后可生成趋势对比' : null,
      reminderText: block.reminderText ? `建议复查 ${block.reminderText}` : null,
    })),
    disclaimer: projection.disclaimer,
  };
}

export { DISCLAIMER as VISIT_SUMMARY_DISCLAIMER };
