export type DiseaseType = 'thyroid' | 'breast' | 'lung';

export type ReminderDerivation =
  | {
      kind: 'auto' | 'fallback';
      nextExamDate: string;
      intervalMonths: number;
      reason: string;
    }
  | {
      kind: 'no_auto';
      nextExamDate: null;
      reason: string;
    };

function isIsoDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseGrade(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Accept common formats: "3", "4a", "4A", "4X", "4x", "2级"
  const m = trimmed.match(/^(\d)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function addMonthsUTC(isoDate: string, months: number): string | null {
  if (!isIsoDateOnly(isoDate)) return null;
  const [y, m, d] = isoDate.split('-').map((part) => Number(part));
  if (!y || !m || !d) return null;

  const base = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(base.getTime())) return null;

  // Attempt to keep day-of-month stable; clamp to last day of target month if needed.
  const targetYear = y;
  const targetMonthIndex = (m - 1) + months;
  const tentative = new Date(Date.UTC(targetYear, targetMonthIndex, d));
  if (Number.isNaN(tentative.getTime())) return null;

  // If month rolled over, clamp to last day of previous month.
  if (tentative.getUTCDate() !== d) {
    // day 0 of next month == last day of intended month
    const clamped = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0));
    return clamped.toISOString().slice(0, 10);
  }

  return tentative.toISOString().slice(0, 10);
}

export function deriveAutoReminder(input: {
  diseaseType: DiseaseType;
  examDate: string; // YYYY-MM-DD
  tirads?: string | null;
  birads?: string | null;
  lungRads?: string | null;
}): ReminderDerivation {
  const examDate = input.examDate;
  if (!isIsoDateOnly(examDate)) {
    const today = new Date().toISOString().slice(0, 10);
    const next = addMonthsUTC(today, 6) ?? today;
    return { kind: 'fallback', nextExamDate: next, intervalMonths: 6, reason: '检查日期无效，按默认处理' };
  }

  const gradeStr =
    input.diseaseType === 'thyroid'
      ? input.tirads
      : input.diseaseType === 'breast'
        ? input.birads
        : input.lungRads;

  const grade = parseGrade(gradeStr);

  // PRD §4.6 table: 4+ => advise clinical follow-up, no auto reminder.
  if (grade !== null && grade >= 4) {
    return { kind: 'no_auto', nextExamDate: null, reason: '建议就诊，不设自动提醒' };
  }

  // Interval rules per PRD §4.6 (choose a deterministic point for ranges).
  let intervalMonths: number | null = null;
  if (input.diseaseType === 'thyroid') {
    if (grade === 3) intervalMonths = 9; // 6–12 months → choose midpoint for determinism
    else intervalMonths = 12; // TI-RADS 1–2 (and unknown low-risk) → 1 year
  } else if (input.diseaseType === 'breast') {
    if (grade === 3) intervalMonths = 6;
    else intervalMonths = 12; // BI-RADS 1–2 (and unknown low-risk) → 1 year
  } else {
    // lung
    if (grade === 3) intervalMonths = 6;
    else intervalMonths = 12; // Lung-RADS 1–2 (and unknown low-risk) → 1 year
  }

  const next = addMonthsUTC(examDate, intervalMonths);
  if (!next) {
    const fallback = addMonthsUTC(new Date().toISOString().slice(0, 10), 6);
    return {
      kind: 'fallback',
      nextExamDate: fallback ?? new Date().toISOString().slice(0, 10),
      intervalMonths: 6,
      reason: '随访日期推算失败，按默认处理',
    };
  }

  if (grade === null) {
    return {
      kind: 'fallback',
      nextExamDate: next,
      intervalMonths,
      reason: '缺少分级，按默认随访周期推算',
    };
  }

  return { kind: 'auto', nextExamDate: next, intervalMonths, reason: '按RADS规则自动推算' };
}
