import { getDatabase } from '@/lib/db';
import { buildUpdateSet } from '@/lib/db/queries/shared';
import type { Lesion } from '@/lib/db/types';

export type CreateLesionInput = Pick<
  Lesion,
  'id' | 'profile_id' | 'disease_type' | 'label' | 'location' | 'is_archived'
>;

export type UpdateLesionInput = Partial<
  Pick<Lesion, 'disease_type' | 'label' | 'location' | 'is_archived'>
>;

export async function listLesionsByProfile(profileId: string) {
  const db = await getDatabase();
  return db.getAllAsync<Lesion>(
    `
      SELECT *
      FROM lesions
      WHERE profile_id = ?
      ORDER BY is_archived ASC, created_at DESC;
    `,
    profileId
  );
}

export async function getLesionById(id: string) {
  const db = await getDatabase();
  return db.getFirstAsync<Lesion>('SELECT * FROM lesions WHERE id = ? LIMIT 1;', id);
}

export async function createLesion(input: CreateLesionInput) {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO lesions (
        id, profile_id, disease_type, label, location, is_archived
      ) VALUES (?, ?, ?, ?, ?, ?);
    `,
    input.id,
    input.profile_id,
    input.disease_type,
    input.label,
    input.location,
    input.is_archived
  );

  return getLesionById(input.id);
}

export async function updateLesion(id: string, updates: UpdateLesionInput) {
  const db = await getDatabase();
  const updateSet = buildUpdateSet<UpdateLesionInput>(updates);

  if (!updateSet) {
    return getLesionById(id);
  }

  await db.runAsync(
    `UPDATE lesions SET ${updateSet.clause}, updated_at = datetime('now') WHERE id = ?;`,
    ...updateSet.values,
    id
  );

  return getLesionById(id);
}

export async function deleteLesion(id: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM lesions WHERE id = ?;', id);
}
