jest.mock('@/lib/db', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '@/lib/db';
import type { Profile } from '@/lib/db/types';
import {
  createProfile,
  deleteProfile,
  getProfileById,
  listProfiles,
  updateProfile,
} from '@/lib/db/queries/profiles';

const getDatabaseMock = jest.mocked(getDatabase);

describe('profile queries', () => {
  const profile: Profile = {
    id: 'profile-1',
    nickname: 'Alice',
    gender: 'female',
    birth_year: 1990,
    avatar_uri: null,
    sort_order: 0,
    created_at: '2026-04-13T00:00:00.000Z',
    updated_at: '2026-04-13T00:00:00.000Z',
  };

  const db = {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getDatabaseMock.mockResolvedValue(db as never);
  });

  it('lists profiles ordered by sort order and creation time', async () => {
    db.getAllAsync.mockResolvedValue([profile]);

    await expect(listProfiles()).resolves.toEqual([profile]);

    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY sort_order ASC, created_at ASC')
    );
  });

  it('creates a profile and returns the inserted row', async () => {
    db.getFirstAsync.mockResolvedValue(profile);

    await expect(
      createProfile({
        id: profile.id,
        nickname: profile.nickname,
        gender: profile.gender,
        birth_year: profile.birth_year,
        avatar_uri: profile.avatar_uri,
        sort_order: profile.sort_order,
      })
    ).resolves.toEqual(profile);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO profiles'),
      profile.id,
      profile.nickname,
      profile.gender,
      profile.birth_year,
      profile.avatar_uri,
      profile.sort_order
    );
  });

  it('updates a profile and refreshes updated_at', async () => {
    db.getFirstAsync.mockResolvedValue({ ...profile, nickname: 'Bob' });

    await expect(updateProfile(profile.id, { nickname: 'Bob' })).resolves.toMatchObject({
      id: profile.id,
      nickname: 'Bob',
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("updated_at = datetime('now')"),
      'Bob',
      profile.id
    );
  });

  it('deletes a profile by id', async () => {
    await deleteProfile(profile.id);

    expect(db.runAsync).toHaveBeenCalledWith('DELETE FROM profiles WHERE id = ?;', profile.id);
  });

  it('loads a profile by id', async () => {
    db.getFirstAsync.mockResolvedValue(profile);

    await expect(getProfileById(profile.id)).resolves.toEqual(profile);

    expect(db.getFirstAsync).toHaveBeenCalledWith('SELECT * FROM profiles WHERE id = ? LIMIT 1;', profile.id);
  });
});
