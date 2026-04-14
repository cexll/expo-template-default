// Lesion matching scoring per AEC §9.2
export interface MatchScore {
  lesionId: string;
  lesionLabel: string;
  score: number;
  confidence: number;
}

export function scoreLesionMatch(
  recognizedLocation: string,
  recognizedSizeX: number | null,
  existingLesions: Array<{
    id: string;
    label: string;
    location: string;
    latestSizeX: number | null;
  }>
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
