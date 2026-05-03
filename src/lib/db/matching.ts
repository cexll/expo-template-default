import type { Examination, Lesion } from '@/lib/db/types';

// Lesion matching scoring per AEC §9.2
export interface MatchScore {
  lesionId: string;
  lesionLabel: string;
  score: number;
  confidence: number;
}

export type StoredLesionMatchScore = MatchScore & {
  latestExamId: string | null;
  latestExamDate: string | null;
};

export type LesionMatchSelection = {
  autoSelectedLesionId: string | null;
  alternatives: string[];
  requiresManualSelection: boolean;
};

export function buildLesionMatchSelection(matches: MatchScore[]): LesionMatchSelection {
  const topMatch = matches[0] ?? null;
  const autoSelectedLesionId = topMatch && topMatch.confidence >= 80 ? topMatch.lesionId : null;
  return {
    autoSelectedLesionId,
    alternatives: matches.map((match) => match.lesionId),
    requiresManualSelection: autoSelectedLesionId === null,
  };
}

export function scoreStoredLesionMatches(
  recognized: {
    diseaseType: Lesion['disease_type'];
    location: string;
    sizeX: number | null;
    rads?: string | null;
  },
  lesions: Lesion[],
  examinations: Examination[]
): StoredLesionMatchScore[] {
  const examsByLesion = new Map<string, Examination[]>();
  for (const exam of examinations) {
    examsByLesion.set(exam.lesion_id, [...(examsByLesion.get(exam.lesion_id) ?? []), exam]);
  }

  return lesions
    .filter((lesion) => lesion.is_archived === 0 && lesion.disease_type === recognized.diseaseType)
    .map((lesion) => {
      const latestExam = selectLatestExam(examsByLesion.get(lesion.id) ?? []);
      let score = 0;
      if (lesion.location.trim() === recognized.location.trim()) {
        score += 50;
      } else if (isSameSide(lesion.location, recognized.location)) {
        score += 25;
      }
      if (recognized.sizeX !== null && latestExam?.size_x !== null && latestExam?.size_x !== undefined) {
        const ratio = Math.abs(recognized.sizeX - latestExam.size_x) / Math.max(latestExam.size_x, 1);
        if (ratio <= 0.12) {
          score += 30;
        } else if (ratio <= 0.5) {
          score += 15;
        }
      }
      if (recognized.rads && latestExam && normalizeRads(recognized.rads) === normalizeRads(radsForDisease(recognized.diseaseType, latestExam))) {
        score += 20;
      }
      return {
        lesionId: lesion.id,
        lesionLabel: lesion.label,
        latestExamId: latestExam?.id ?? null,
        latestExamDate: latestExam?.exam_date ?? null,
        score,
        confidence: Math.min(100, score),
      };
    })
    .sort((a, b) => b.confidence - a.confidence);
}

export function scoreLesionMatch(
  recognizedLocation: string,
  recognizedSizeX: number | null,
  existingLesions: {
    id: string;
    label: string;
    location: string;
    latestSizeX: number | null;
  }[]
): MatchScore[] {
  return existingLesions
    .map((lesion) => {
      let score = 0;

      // Location scoring
      if (lesion.location === recognizedLocation) {
        score += 50; // exact match
      } else if (isSameSide(lesion.location, recognizedLocation)) {
        score += 30; // partial match
      }

      // Size scoring
      if (recognizedSizeX && lesion.latestSizeX) {
        const ratio = Math.abs(recognizedSizeX - lesion.latestSizeX) / lesion.latestSizeX;
        if (ratio <= 0.5) {
          score += 20; // within 50%
        }
      }

      const confidence = Math.round((score / 70) * 100);
      return { lesionId: lesion.id, lesionLabel: lesion.label, score, confidence };
    })
    .sort((a, b) => b.confidence - a.confidence);
}

function isSameSide(a: string, b: string): boolean {
  const sideA = a.includes('左') ? 'left' : a.includes('右') ? 'right' : '';
  const sideB = b.includes('左') ? 'left' : b.includes('右') ? 'right' : '';
  return sideA !== '' && sideA === sideB;
}

function selectLatestExam(examinations: Examination[]) {
  return [...examinations].sort((a, b) => {
    const byDate = b.exam_date.localeCompare(a.exam_date);
    if (byDate !== 0) return byDate;
    return b.created_at.localeCompare(a.created_at);
  })[0] ?? null;
}

function normalizeRads(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/级$/u, '') : '';
}

function radsForDisease(diseaseType: Lesion['disease_type'], exam: Examination) {
  if (diseaseType === 'thyroid') return exam.tirads;
  if (diseaseType === 'breast') return exam.birads;
  return exam.lung_rads;
}
