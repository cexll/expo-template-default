jest.mock('@/lib/db/queries/profiles', () => ({
  listProfiles: jest.fn(),
}));

jest.mock('@/lib/db/queries/lesions', () => ({
  listLesionsByProfile: jest.fn(),
}));

jest.mock('@/lib/db/queries/reminders', () => ({
  listActiveRemindersByProfile: jest.fn(),
}));

jest.mock('@/lib/db/queries/examinations', () => ({
  listExaminationsByLesion: jest.fn(),
}));

import { listProfiles } from '@/lib/db/queries/profiles';
import { listLesionsByProfile } from '@/lib/db/queries/lesions';
import { listActiveRemindersByProfile } from '@/lib/db/queries/reminders';
import { listExaminationsByLesion } from '@/lib/db/queries/examinations';
import { loadLocalHomeProjection } from '@/lib/home/projection';

const listProfilesMock = jest.mocked(listProfiles);
const listLesionsByProfileMock = jest.mocked(listLesionsByProfile);
const listActiveRemindersByProfileMock = jest.mocked(listActiveRemindersByProfile);
const listExaminationsByLesionMock = jest.mocked(listExaminationsByLesion);

describe('loadLocalHomeProjection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listProfilesMock.mockResolvedValue([
      { id: 'profile-1', nickname: '本人', sort_order: 0 } as any,
      { id: 'profile-2', nickname: '妈妈', sort_order: 1 } as any,
    ]);
    listLesionsByProfileMock.mockImplementation(async (profileId) => {
      if (profileId === 'profile-1') {
        return [
          { id: 'lesion-active', profile_id: 'profile-1', disease_type: 'thyroid', label: '活动结节', location: '左叶', is_archived: 0 } as any,
          { id: 'lesion-archived', profile_id: 'profile-1', disease_type: 'breast', label: '归档结节', location: '右乳', is_archived: 1 } as any,
        ];
      }
      return [
        { id: 'lesion-mom', profile_id: 'profile-2', disease_type: 'lung', label: '妈妈肺结节', location: '右上叶', is_archived: 0 } as any,
      ];
    });
    listActiveRemindersByProfileMock.mockImplementation(async (profileId) => {
      if (profileId === 'profile-2') {
        return [{ id: 'reminder-mom', lesion_id: 'lesion-mom', next_exam_date: '2026-04-30T00:00:00.000Z', source: 'auto', is_active: 1 } as any];
      }
      return [];
    });
    listExaminationsByLesionMock.mockImplementation(async (lesionId) => {
      if (lesionId === 'lesion-active') {
        return [{ id: 'exam-active', lesion_id: lesionId, exam_date: '2026-04-01', size_x: 8, size_y: null, size_z: null, tirads: '3' } as any];
      }
      if (lesionId === 'lesion-mom') {
        return [{ id: 'exam-mom', lesion_id: lesionId, exam_date: '2026-04-02', size_x: 5, size_y: null, size_z: null, lung_rads: '2' } as any];
      }
      return [{ id: 'exam-archived', lesion_id: lesionId, exam_date: '2026-04-03' } as any];
    });
  });

  it('loads profile, active lesion, reminder, and examination rows into a home projection without querying archived timelines', async () => {
    const projection = await loadLocalHomeProjection({
      activeProfileId: 'profile-1',
      entitlement: { isActive: false, featureRemaining: { ai_recognize: 0 } },
      now: new Date('2026-04-27T00:00:00.000Z'),
    });

    expect(listProfilesMock).toHaveBeenCalledTimes(1);
    expect(listLesionsByProfileMock).toHaveBeenCalledWith('profile-1');
    expect(listLesionsByProfileMock).toHaveBeenCalledWith('profile-2');
    expect(listActiveRemindersByProfileMock).toHaveBeenCalledWith('profile-1');
    expect(listActiveRemindersByProfileMock).toHaveBeenCalledWith('profile-2');
    expect(listExaminationsByLesionMock).toHaveBeenCalledWith('lesion-active');
    expect(listExaminationsByLesionMock).toHaveBeenCalledWith('lesion-mom');
    expect(listExaminationsByLesionMock).not.toHaveBeenCalledWith('lesion-archived');
    expect(projection.profiles.map((item) => ({ id: item.id, lesionCount: item.lesionCount }))).toEqual([
      { id: 'profile-1', lesionCount: 1 },
      { id: 'profile-2', lesionCount: 1 },
    ]);
    expect(projection.diseaseGroups[0].lesionCards[0]).toEqual(expect.objectContaining({ id: 'lesion-active', latestExamId: 'exam-active' }));
    expect(projection.urgentReview).toEqual(expect.objectContaining({ profileId: 'profile-2', lesionId: 'lesion-mom', daysUntil: 3 }));
    expect(projection.quotaPrompt).toEqual(expect.objectContaining({ remaining: 0, severity: 'blocked' }));
  });
});
