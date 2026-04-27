import { getDatabase } from '@/lib/db';
import type { Profile } from '@/lib/db/types';
import { buildUpdateSet } from '@/lib/db/queries/shared';

export type CreateProfileInput = Pick<
  Profile,
  'id' | 'nickname' | 'gender' | 'birth_year' | 'avatar_uri' | 'sort_order'
>;

export type BackendProfileInput = {
  sessionUserId: string;
  nickname: string;
  gender: Profile['gender'];
  birthYear: number;
  existingCount: number;
};

export type UpdateProfileInput = Partial<
  Pick<Profile, 'nickname' | 'gender' | 'birth_year' | 'avatar_uri' | 'sort_order'>
>;

export async function listProfiles() {
  const db = await getDatabase();
  return db.getAllAsync<Profile>(
    'SELECT * FROM profiles ORDER BY sort_order ASC, created_at ASC;'
  );
}

export async function getProfileById(id: string) {
  const db = await getDatabase();
  return db.getFirstAsync<Profile>('SELECT * FROM profiles WHERE id = ? LIMIT 1;', id);
}

export async function createProfile(input: CreateProfileInput) {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO profiles (
        id, nickname, gender, birth_year, avatar_uri, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?);
    `,
    input.id,
    input.nickname,
    input.gender,
    input.birth_year,
    input.avatar_uri,
    input.sort_order
  );

  return getProfileById(input.id);
}

export async function createBackendProfile(input: BackendProfileInput) {
  const stableSessionId = input.sessionUserId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return createProfile({
    id: `profile_${stableSessionId || Date.now().toString(36)}`,
    nickname: input.nickname.trim(),
    gender: input.gender,
    birth_year: input.birthYear,
    avatar_uri: null,
    sort_order: input.existingCount,
  });
}

export async function updateProfile(id: string, updates: UpdateProfileInput) {
  const db = await getDatabase();
  const updateSet = buildUpdateSet<UpdateProfileInput>(updates);

  if (!updateSet) {
    return getProfileById(id);
  }

  await db.runAsync(
    `UPDATE profiles SET ${updateSet.clause}, updated_at = datetime('now') WHERE id = ?;`,
    ...updateSet.values,
    id
  );

  return getProfileById(id);
}

export async function deleteProfile(id: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM profiles WHERE id = ?;', id);
}
