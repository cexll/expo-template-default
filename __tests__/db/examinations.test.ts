jest.mock('@/lib/db', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '@/lib/db';
import type { Examination } from '@/lib/db/types';
import {
  createExamination,
  getExaminationById,
  listExaminationsByLesion,
} from '@/lib/db/queries/examinations';

const getDatabaseMock = jest.mocked(getDatabase);

describe('examination queries', () => {
  const examination: Examination = {
    id: 'exam-1',
    lesion_id: 'lesion-1',
    exam_date: '2026-04-13',
    hospital: '协和',
    size_x: 10.1,
    size_y: 8.2,
    size_z: 6.3,
    tirads: '4a',
    echo_type: '低回声',
    border: '清晰',
    calcification: '无',
    blood_flow: '1',
    birads: null,
    shape: null,
    orientation: null,
    lung_rads: null,
    density: null,
    morphology: null,
    pleural_pull: null,
    ai_raw_json: null,
    notes: null,
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

  it('lists examinations ordered by exam_date descending', async () => {
    db.getAllAsync.mockResolvedValue([examination]);

    await expect(listExaminationsByLesion(examination.lesion_id)).resolves.toEqual([examination]);

    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY exam_date DESC'),
      examination.lesion_id
    );
  });

  it('creates an examination', async () => {
    db.getFirstAsync.mockResolvedValue(examination);

    await expect(
      createExamination({
        id: examination.id,
        lesion_id: examination.lesion_id,
        exam_date: examination.exam_date,
        hospital: examination.hospital,
        size_x: examination.size_x,
        size_y: examination.size_y,
        size_z: examination.size_z,
        tirads: examination.tirads,
        echo_type: examination.echo_type,
        border: examination.border,
        calcification: examination.calcification,
        blood_flow: examination.blood_flow,
        birads: examination.birads,
        shape: examination.shape,
        orientation: examination.orientation,
        lung_rads: examination.lung_rads,
        density: examination.density,
        morphology: examination.morphology,
        pleural_pull: examination.pleural_pull,
        ai_raw_json: examination.ai_raw_json,
        notes: examination.notes,
      })
    ).resolves.toEqual(examination);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO examinations'),
      examination.id,
      examination.lesion_id,
      examination.exam_date,
      examination.hospital,
      examination.size_x,
      examination.size_y,
      examination.size_z,
      examination.tirads,
      examination.echo_type,
      examination.border,
      examination.calcification,
      examination.blood_flow,
      examination.birads,
      examination.shape,
      examination.orientation,
      examination.lung_rads,
      examination.density,
      examination.morphology,
      examination.pleural_pull,
      examination.ai_raw_json,
      examination.notes
    );
  });

  it('loads an examination by id', async () => {
    db.getFirstAsync.mockResolvedValue(examination);

    await expect(getExaminationById(examination.id)).resolves.toEqual(examination);

    expect(db.getFirstAsync).toHaveBeenCalledWith(
      'SELECT * FROM examinations WHERE id = ? LIMIT 1;',
      examination.id
    );
  });
});
