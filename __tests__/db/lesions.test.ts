jest.mock('@/lib/db', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '@/lib/db';
import type { Lesion } from '@/lib/db/types';
import {
  createLesion,
  getLesionById,
  listLesionsByProfile,
  updateLesion,
} from '@/lib/db/queries/lesions';

const getDatabaseMock = jest.mocked(getDatabase);

describe('lesion queries', () => {
  const lesion: Lesion = {
    id: 'lesion-1',
    profile_id: 'profile-1',
    disease_type: 'thyroid',
    label: '甲状腺左叶结节',
    location: '左叶中下段',
    is_archived: 0,
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

  it('lists lesions for a profile', async () => {
    db.getAllAsync.mockResolvedValue([lesion]);

    await expect(listLesionsByProfile(lesion.profile_id)).resolves.toEqual([lesion]);

    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE profile_id = ?'),
      lesion.profile_id
    );
  });

  it('creates a lesion', async () => {
    db.getFirstAsync.mockResolvedValue(lesion);

    await expect(
      createLesion({
        id: lesion.id,
        profile_id: lesion.profile_id,
        disease_type: lesion.disease_type,
        label: lesion.label,
        location: lesion.location,
        is_archived: lesion.is_archived,
      })
    ).resolves.toEqual(lesion);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO lesions'),
      lesion.id,
      lesion.profile_id,
      lesion.disease_type,
      lesion.label,
      lesion.location,
      lesion.is_archived
    );
  });

  it('updates a lesion', async () => {
    db.getFirstAsync.mockResolvedValue({ ...lesion, label: '新标签' });

    await expect(updateLesion(lesion.id, { label: '新标签' })).resolves.toMatchObject({
      id: lesion.id,
      label: '新标签',
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("updated_at = datetime('now')"),
      '新标签',
      lesion.id
    );
  });

  it('loads a lesion by id', async () => {
    db.getFirstAsync.mockResolvedValue(lesion);

    await expect(getLesionById(lesion.id)).resolves.toEqual(lesion);

    expect(db.getFirstAsync).toHaveBeenCalledWith('SELECT * FROM lesions WHERE id = ? LIMIT 1;', lesion.id);
  });
});
