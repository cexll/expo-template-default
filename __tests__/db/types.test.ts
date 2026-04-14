import type {
  Examination,
  Lesion,
  Profile,
  Reminder,
  ReportImage,
} from '@/lib/db/types';

describe('db types', () => {
  it('supports the archive entity shapes used by the db layer', () => {
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

    const lesion: Lesion = {
      id: 'lesion-1',
      profile_id: profile.id,
      disease_type: 'thyroid',
      label: '甲状腺左叶结节',
      location: '左叶中下段',
      is_archived: 0,
      created_at: '2026-04-13T00:00:00.000Z',
      updated_at: '2026-04-13T00:00:00.000Z',
    };

    const examination: Examination = {
      id: 'exam-1',
      lesion_id: lesion.id,
      exam_date: '2026-04-13',
      hospital: null,
      size_x: 10.2,
      size_y: 8.1,
      size_z: 6.4,
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

    const reportImage: ReportImage = {
      id: 'image-1',
      examination_id: examination.id,
      uri: 'file:///report.png',
      sort_order: 0,
      created_at: '2026-04-13T00:00:00.000Z',
    };

    const reminder: Reminder = {
      id: 'reminder-1',
      lesion_id: lesion.id,
      next_exam_date: '2026-07-13',
      source: 'auto',
      is_active: 1,
      created_at: '2026-04-13T00:00:00.000Z',
      updated_at: '2026-04-13T00:00:00.000Z',
    };

    expect(profile.nickname).toBe('Alice');
    expect(lesion.profile_id).toBe(profile.id);
    expect(examination.lesion_id).toBe(lesion.id);
    expect(reportImage.examination_id).toBe(examination.id);
    expect(reminder.lesion_id).toBe(lesion.id);
  });
});
