import { getDatabase } from '@/lib/db';
import { buildUpdateSet } from '@/lib/db/queries/shared';
import type { Examination } from '@/lib/db/types';

export type CreateExaminationInput = Pick<
  Examination,
  | 'id'
  | 'lesion_id'
  | 'exam_date'
  | 'hospital'
  | 'size_x'
  | 'size_y'
  | 'size_z'
  | 'tirads'
  | 'echo_type'
  | 'border'
  | 'calcification'
  | 'blood_flow'
  | 'birads'
  | 'shape'
  | 'orientation'
  | 'lung_rads'
  | 'density'
  | 'morphology'
  | 'pleural_pull'
  | 'ai_raw_json'
  | 'notes'
>;

export type UpdateExaminationInput = Partial<
  Omit<Examination, 'id' | 'lesion_id' | 'created_at' | 'updated_at'>
>;

export async function listExaminationsByLesion(lesionId: string) {
  const db = await getDatabase();
  return db.getAllAsync<Examination>(
    `
      SELECT *
      FROM examinations
      WHERE lesion_id = ?
      ORDER BY exam_date DESC, created_at DESC;
    `,
    lesionId
  );
}

export async function listLatestExaminationsByProfile(profileId: string) {
  const db = await getDatabase();
  return db.getAllAsync<Examination>(
    `
      SELECT e.*
      FROM examinations e
      INNER JOIN lesions l ON l.id = e.lesion_id
      INNER JOIN (
        SELECT lesion_id, MAX(exam_date) AS max_exam_date
        FROM examinations
        GROUP BY lesion_id
      ) m ON m.lesion_id = e.lesion_id AND m.max_exam_date = e.exam_date
      WHERE l.profile_id = ? AND l.is_archived = 0
      ORDER BY e.exam_date DESC, e.created_at DESC;
    `,
    profileId
  );
}

export async function getExaminationById(id: string) {
  const db = await getDatabase();
  return db.getFirstAsync<Examination>(
    'SELECT * FROM examinations WHERE id = ? LIMIT 1;',
    id
  );
}

export async function createExamination(input: CreateExaminationInput) {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO examinations (
        id, lesion_id, exam_date, hospital, size_x, size_y, size_z, tirads, echo_type,
        border, calcification, blood_flow, birads, shape, orientation, lung_rads, density,
        morphology, pleural_pull, ai_raw_json, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    input.id,
    input.lesion_id,
    input.exam_date,
    input.hospital,
    input.size_x,
    input.size_y,
    input.size_z,
    input.tirads,
    input.echo_type,
    input.border,
    input.calcification,
    input.blood_flow,
    input.birads,
    input.shape,
    input.orientation,
    input.lung_rads,
    input.density,
    input.morphology,
    input.pleural_pull,
    input.ai_raw_json,
    input.notes
  );

  return getExaminationById(input.id);
}

export async function updateExamination(id: string, updates: UpdateExaminationInput) {
  const db = await getDatabase();
  const updateSet = buildUpdateSet<UpdateExaminationInput>(updates);

  if (!updateSet) {
    return getExaminationById(id);
  }

  await db.runAsync(
    `UPDATE examinations SET ${updateSet.clause}, updated_at = datetime('now') WHERE id = ?;`,
    ...updateSet.values,
    id
  );

  return getExaminationById(id);
}

export async function deleteExamination(id: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM examinations WHERE id = ?;', id);
}
