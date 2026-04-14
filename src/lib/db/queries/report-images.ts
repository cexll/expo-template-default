import { getDatabase } from '@/lib/db';
import { buildUpdateSet } from '@/lib/db/queries/shared';
import type { ReportImage } from '@/lib/db/types';

export type CreateReportImageInput = Pick<
  ReportImage,
  'id' | 'examination_id' | 'uri' | 'sort_order'
>;

export type UpdateReportImageInput = Partial<Pick<ReportImage, 'uri' | 'sort_order'>>;

export async function listReportImagesByExamination(examinationId: string) {
  const db = await getDatabase();
  return db.getAllAsync<ReportImage>(
    `
      SELECT *
      FROM report_images
      WHERE examination_id = ?
      ORDER BY sort_order ASC, created_at ASC;
    `,
    examinationId
  );
}

export async function getReportImageById(id: string) {
  const db = await getDatabase();
  return db.getFirstAsync<ReportImage>('SELECT * FROM report_images WHERE id = ? LIMIT 1;', id);
}

export async function createReportImage(input: CreateReportImageInput) {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO report_images (
        id, examination_id, uri, sort_order
      ) VALUES (?, ?, ?, ?);
    `,
    input.id,
    input.examination_id,
    input.uri,
    input.sort_order
  );

  return getReportImageById(input.id);
}

export async function updateReportImage(id: string, updates: UpdateReportImageInput) {
  const db = await getDatabase();
  const updateSet = buildUpdateSet<UpdateReportImageInput>(updates);

  if (!updateSet) {
    return getReportImageById(id);
  }

  await db.runAsync(`UPDATE report_images SET ${updateSet.clause} WHERE id = ?;`, ...updateSet.values, id);

  return getReportImageById(id);
}

export async function deleteReportImage(id: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM report_images WHERE id = ?;', id);
}
