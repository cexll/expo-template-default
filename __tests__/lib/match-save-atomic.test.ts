import type { Lesion, Examination, Reminder, ReportImage } from '@/lib/db/types';
import { saveMatchRecordAtomic } from '@/lib/db/save-match-record';

type DbState = {
  lesions: Lesion[];
  examinations: Examination[];
  reminders: Reminder[];
  report_images: (ReportImage & { mime_type: string | null })[];
};

type ProjectionSnapshot = {
  lesionCount: number;
  latestExamId: string | null;
  reportImageCount: number;
  activeReminderDate: string | null;
};

function makeStubDb(options?: { failOnReminderWrite?: boolean; failOnProjectionRefresh?: boolean }) {
  const state: DbState = { lesions: [], examinations: [], reminders: [], report_images: [] };
  const projections: ProjectionSnapshot = {
    lesionCount: 0,
    latestExamId: null,
    reportImageCount: 0,
    activeReminderDate: null,
  };
  const snapshots: { state: DbState; projections: ProjectionSnapshot }[] = [];

  const db = {
    execAsync: jest.fn(async (sql: string) => {
      if (sql === 'BEGIN;') {
        snapshots.push(JSON.parse(JSON.stringify({ state, projections })) as { state: DbState; projections: ProjectionSnapshot });
        return;
      }
      if (sql === 'COMMIT;') {
        snapshots.pop();
        return;
      }
      if (sql === 'ROLLBACK;') {
        const snap = snapshots.pop();
        if (snap) {
          state.lesions = snap.state.lesions;
          state.examinations = snap.state.examinations;
          state.reminders = snap.state.reminders;
          state.report_images = snap.state.report_images;
          projections.lesionCount = snap.projections.lesionCount;
          projections.latestExamId = snap.projections.latestExamId;
          projections.reportImageCount = snap.projections.reportImageCount;
          projections.activeReminderDate = snap.projections.activeReminderDate;
        }
        return;
      }
    }),
    runAsync: jest.fn(async (sql: string, ...params: any[]) => {
      if (sql.includes('INSERT INTO lesions')) {
        const [id, profile_id, disease_type, label, location, is_archived] = params;
        state.lesions.push({
          id,
          profile_id,
          disease_type,
          label,
          location,
          is_archived,
          created_at: 'now',
          updated_at: 'now',
        } as Lesion);
        return;
      }
      if (sql.includes('INSERT INTO examinations')) {
        const [id, lesion_id, exam_date] = params;
        state.examinations.push({
          id,
          lesion_id,
          exam_date,
          hospital: null,
          size_x: null,
          size_y: null,
          size_z: null,
          tirads: null,
          echo_type: null,
          border: null,
          calcification: null,
          blood_flow: null,
          birads: null,
          shape: null,
          orientation: null,
          lung_rads: null,
          density: null,
          morphology: null,
          pleural_pull: null,
          ai_raw_json: null,
          notes: null,
          created_at: 'now',
          updated_at: 'now',
        } as Examination);
        return;
      }
      if (sql.includes('INSERT INTO report_images')) {
        const [id, examination_id, uri, sort_order, mime_type] = params;
        state.report_images.push({
          id,
          examination_id,
          uri,
          sort_order,
          mime_type: mime_type ?? null,
          created_at: 'now',
        } as any);
        return;
      }
      if (sql.includes('INSERT INTO reminders')) {
        if (options?.failOnReminderWrite) {
          throw new Error('reminder write failed');
        }
        const [id, lesion_id, next_exam_date, source, is_active] = params;
        state.reminders.push({
          id,
          lesion_id,
          next_exam_date,
          source,
          is_active,
          created_at: 'now',
          updated_at: 'now',
        } as Reminder);
        return;
      }
      if (sql.includes('UPDATE reminders')) {
        if (options?.failOnReminderWrite) {
          throw new Error('reminder update failed');
        }
        if (sql.includes('remind1m_sent = 0')) {
          const [next_exam_date, source, is_active, id] = params;
          const reminder = state.reminders.find((item) => item.id === id);
          if (reminder) {
            Object.assign(reminder, {
              next_exam_date,
              source,
              is_active,
              remind1m_sent: 0,
              remind1w_sent: 0,
              remind3d_sent: 0,
              remind0d_sent: 0,
            });
          }
        }
        return;
      }
    }),
    getFirstAsync: jest.fn(async (sql: string, ...params: any[]) => {
      if (sql.includes('COUNT(*) AS count') && sql.includes('FROM lesions')) {
        const [profileId] = params;
        return { count: state.lesions.filter((lesion) => lesion.profile_id === profileId && lesion.is_archived === 0).length };
      }
      if (sql.includes('COUNT(*) AS count') && sql.includes('FROM examinations')) {
        const [lesionId] = params;
        return { count: state.examinations.filter((exam) => exam.lesion_id === lesionId).length };
      }
      return null;
    }),
    getAllAsync: jest.fn(async (sql: string, ...params: any[]) => {
      if (sql.includes('FROM reminders') && sql.includes('WHERE lesion_id = ?')) {
        const [lesionId] = params;
        return state.reminders.filter((r) => r.lesion_id === lesionId);
      }
      if (sql.includes('archive_projection_refresh')) {
        if (options?.failOnProjectionRefresh) {
          throw new Error('projection refresh failed');
        }
        projections.lesionCount = state.lesions.length;
        projections.latestExamId = state.examinations[state.examinations.length - 1]?.id ?? null;
        projections.reportImageCount = state.report_images.length;
        projections.activeReminderDate = state.reminders.find((reminder) => reminder.is_active === 1)?.next_exam_date ?? null;
        return [];
      }
      return [];
    }),
  };

  return { db, state, projections };
}

describe('saveMatchRecordAtomic', () => {
  it('prevents partial DB writes when report-image persistence fails (no lesion/exam writes behind)', async () => {
    const { db, state } = makeStubDb();

    await expect(
      saveMatchRecordAtomic(
        {
          activeProfileId: 'profile-1',
          createNew: true,
          diseaseType: 'thyroid',
          recognized: { location: '左叶', exam_date: '2024-03-15' },
          rawRecognizedJson: '{}',
          reportImages: [{ uri: 'blob:a', mimeType: 'image/png' }],
        },
        {
          db: db as any,
          persistReportImages: async () => {
            throw new Error('persist failed');
          },
        }
      )
    ).rejects.toThrow('persist failed');

    expect(state.lesions).toHaveLength(0);
    expect(state.examinations).toHaveLength(0);
    expect(state.report_images).toHaveLength(0);
    expect(state.reminders).toHaveLength(0);
  });

  it('rolls back lesion/exam/report-image rows when reminder persistence fails', async () => {
    const { db, state, projections } = makeStubDb({ failOnReminderWrite: true });

    await expect(
      saveMatchRecordAtomic(
        {
          activeProfileId: 'profile-1',
          createNew: true,
          diseaseType: 'thyroid',
          recognized: { location: '左叶', exam_date: '2024-03-15' },
          rawRecognizedJson: '{}',
          reportImages: [{ uri: 'blob:a', mimeType: 'image/png' }],
        },
        {
          db: db as any,
          persistReportImages: async () => [{ uri: 'data:image/png;base64,AAAA', mimeType: 'image/png' }],
        }
      )
    ).rejects.toThrow(/reminder/i);

    // transaction rollback should have restored empty state
    expect(state.lesions).toHaveLength(0);
    expect(state.examinations).toHaveLength(0);
    expect(state.report_images).toHaveLength(0);
    expect(state.reminders).toHaveLength(0);
    expect(projections).toEqual({
      lesionCount: 0,
      latestExamId: null,
      reportImageCount: 0,
      activeReminderDate: null,
    });
  });

  it('refreshes archive projections in the same transaction as matched record save', async () => {
    const { db, state, projections } = makeStubDb();

    await saveMatchRecordAtomic(
      {
        activeProfileId: 'profile-1',
        createNew: true,
        diseaseType: 'thyroid',
        recognized: { location: '左叶', exam_date: '2024-03-15', tirads: '3' },
        rawRecognizedJson: '{}',
        reportImages: [{ uri: 'blob:a', mimeType: 'image/png' }],
      },
      {
        db: db as any,
        persistReportImages: async () => [{ uri: 'data:image/png;base64,AAAA', mimeType: 'image/png' }],
      }
    );

    expect(state.lesions).toHaveLength(1);
    expect(state.examinations).toHaveLength(1);
    expect(state.report_images).toHaveLength(1);
    expect(state.reminders).toHaveLength(1);
    expect(projections).toEqual({
      lesionCount: 1,
      latestExamId: state.examinations[0]!.id,
      reportImageCount: 1,
      activeReminderDate: '2024-12-15',
    });
    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('archive_projection_refresh'), expect.any(String));
  });

  it('blocks free users from creating a new lesion after the per-profile limit', async () => {
    const { db, state } = makeStubDb();
    for (let i = 0; i < 5; i += 1) {
      state.lesions.push({
        id: `lesion-${i}`,
        profile_id: 'profile-1',
        disease_type: 'thyroid',
        label: `甲状腺结节${i}`,
        location: '左叶',
        is_archived: 0,
        created_at: 'now',
        updated_at: 'now',
      } as Lesion);
    }

    await expect(
      saveMatchRecordAtomic(
        {
          activeProfileId: 'profile-1',
          createNew: true,
          diseaseType: 'thyroid',
          recognized: { location: '右叶', exam_date: '2024-03-15' },
          rawRecognizedJson: '{}',
          reportImages: [],
          subscriptionStatus: { isActive: false, freeLimits: { lesionsPerProfile: 5, recordsPerLesion: 10 } },
        },
        { db: db as any }
      )
    ).rejects.toThrow('免费版每个档案人最多可管理5个病灶');

    expect(state.lesions).toHaveLength(5);
    expect(state.examinations).toHaveLength(0);
  });

  it('resets auto reminder sent flags when a new matched record updates the follow-up date', async () => {
    const { db, state } = makeStubDb();
    state.lesions.push({
      id: 'lesion-1',
      profile_id: 'profile-1',
      disease_type: 'thyroid',
      label: '甲状腺左叶结节',
      location: '左叶',
      is_archived: 0,
      created_at: 'now',
      updated_at: 'now',
    } as Lesion);
    state.reminders.push({
      id: 'reminder-1',
      lesion_id: 'lesion-1',
      next_exam_date: '2024-12-15',
      source: 'auto',
      is_active: 1,
      remind1m_sent: 1,
      remind1w_sent: 1,
      remind3d_sent: 1,
      remind0d_sent: 1,
      created_at: 'now',
      updated_at: 'now',
    } as Reminder);

    await saveMatchRecordAtomic(
      {
        activeProfileId: 'profile-1',
        createNew: false,
        diseaseType: 'thyroid',
        selectedLesionId: 'lesion-1',
        recognized: { location: '左叶', exam_date: '2025-03-15', tirads: '3' },
        rawRecognizedJson: '{}',
        reportImages: [],
      },
      { db: db as any }
    );

    expect(state.reminders[0]).toMatchObject({
      next_exam_date: '2025-12-15',
      source: 'auto',
      is_active: 1,
      remind1m_sent: 0,
      remind1w_sent: 0,
      remind3d_sent: 0,
      remind0d_sent: 0,
    });
  });

  it('refreshes archive projections after adding a record to an existing lesion', async () => {
    const { db, state, projections } = makeStubDb();
    state.lesions.push({
      id: 'lesion-1',
      profile_id: 'profile-1',
      disease_type: 'thyroid',
      label: '甲状腺左叶结节',
      location: '左叶',
      is_archived: 0,
      created_at: 'now',
      updated_at: 'now',
    } as Lesion);

    await saveMatchRecordAtomic(
      {
        activeProfileId: 'profile-1',
        createNew: false,
        diseaseType: 'thyroid',
        selectedLesionId: 'lesion-1',
        recognized: { location: '左叶', exam_date: '2024-03-15', tirads: '3' },
        rawRecognizedJson: '{}',
        reportImages: [],
        subscriptionStatus: { isActive: false, freeLimits: { recordsPerLesion: 10 } },
      },
      { db: db as any }
    );

    expect(state.examinations).toHaveLength(1);
    expect(projections.latestExamId).toBe(state.examinations[0]!.id);
    expect(projections.activeReminderDate).toBe('2024-12-15');
    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('archive_projection_refresh'), 'lesion-1');
  });

  it('blocks free users from adding a record after the per-lesion limit', async () => {
    const { db, state } = makeStubDb();
    state.lesions.push({
      id: 'lesion-1',
      profile_id: 'profile-1',
      disease_type: 'thyroid',
      label: '甲状腺左叶结节',
      location: '左叶',
      is_archived: 0,
      created_at: 'now',
      updated_at: 'now',
    } as Lesion);
    for (let i = 0; i < 10; i += 1) {
      state.examinations.push({
        id: `exam-${i}`,
        lesion_id: 'lesion-1',
        exam_date: '2024-03-15',
        hospital: null,
        size_x: null,
        size_y: null,
        size_z: null,
        tirads: null,
        echo_type: null,
        border: null,
        calcification: null,
        blood_flow: null,
        birads: null,
        shape: null,
        orientation: null,
        lung_rads: null,
        density: null,
        morphology: null,
        pleural_pull: null,
        ai_raw_json: null,
        notes: null,
        created_at: 'now',
        updated_at: 'now',
      } as Examination);
    }

    await expect(
      saveMatchRecordAtomic(
        {
          activeProfileId: 'profile-1',
          createNew: false,
          diseaseType: 'thyroid',
          selectedLesionId: 'lesion-1',
          recognized: { location: '左叶', exam_date: '2024-03-15' },
          rawRecognizedJson: '{}',
          reportImages: [],
          subscriptionStatus: { isActive: false, freeLimits: { recordsPerLesion: 10 } },
        },
        { db: db as any }
      )
    ).rejects.toThrow('免费版每个病灶最多可保存10次检查记录');

    expect(state.examinations).toHaveLength(10);
  });

  it('lets active subscribers bypass free archive quantity limits', async () => {
    const { db, state } = makeStubDb();
    for (let i = 0; i < 5; i += 1) {
      state.lesions.push({
        id: `lesion-${i}`,
        profile_id: 'profile-1',
        disease_type: 'thyroid',
        label: `甲状腺结节${i}`,
        location: '左叶',
        is_archived: 0,
        created_at: 'now',
        updated_at: 'now',
      } as Lesion);
    }

    await saveMatchRecordAtomic(
      {
        activeProfileId: 'profile-1',
        createNew: true,
        diseaseType: 'thyroid',
        recognized: { location: '右叶', exam_date: '2024-03-15' },
        rawRecognizedJson: '{}',
        reportImages: [],
        subscriptionStatus: { isActive: true, freeLimits: { lesionsPerProfile: 5, recordsPerLesion: 10 } },
      },
      { db: db as any }
    );

    expect(state.lesions).toHaveLength(6);
    expect(state.examinations).toHaveLength(1);
  });

  it('rolls back lesion, exam, report image, reminder, and projections when projection refresh fails', async () => {
    const { db, state, projections } = makeStubDb({ failOnProjectionRefresh: true });

    await expect(
      saveMatchRecordAtomic(
        {
          activeProfileId: 'profile-1',
          createNew: true,
          diseaseType: 'thyroid',
          recognized: { location: '左叶', exam_date: '2024-03-15', tirads: '3' },
          rawRecognizedJson: '{}',
          reportImages: [{ uri: 'blob:a', mimeType: 'image/png' }],
        },
        {
          db: db as any,
          persistReportImages: async () => [{ uri: 'data:image/png;base64,AAAA', mimeType: 'image/png' }],
        }
      )
    ).rejects.toThrow('projection refresh failed');

    expect(state.lesions).toHaveLength(0);
    expect(state.examinations).toHaveLength(0);
    expect(state.report_images).toHaveLength(0);
    expect(state.reminders).toHaveLength(0);
    expect(projections).toEqual({
      lesionCount: 0,
      latestExamId: null,
      reportImageCount: 0,
      activeReminderDate: null,
    });
  });
});
