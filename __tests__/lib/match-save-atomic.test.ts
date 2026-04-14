import type { Lesion, Examination, Reminder, ReportImage } from '@/lib/db/types';
import { saveMatchRecordAtomic } from '@/lib/db/save-match-record';

type DbState = {
  lesions: Lesion[];
  examinations: Examination[];
  reminders: Reminder[];
  report_images: (ReportImage & { mime_type: string | null })[];
};

function makeStubDb(options?: { failOnReminderWrite?: boolean }) {
  const state: DbState = { lesions: [], examinations: [], reminders: [], report_images: [] };
  const snapshots: DbState[] = [];

  const db = {
    execAsync: jest.fn(async (sql: string) => {
      if (sql === 'BEGIN;') {
        snapshots.push(JSON.parse(JSON.stringify(state)) as DbState);
        return;
      }
      if (sql === 'COMMIT;') {
        snapshots.pop();
        return;
      }
      if (sql === 'ROLLBACK;') {
        const snap = snapshots.pop();
        if (snap) {
          state.lesions = snap.lesions;
          state.examinations = snap.examinations;
          state.reminders = snap.reminders;
          state.report_images = snap.report_images;
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
        return;
      }
    }),
    getAllAsync: jest.fn(async (sql: string, ...params: any[]) => {
      if (sql.includes('FROM reminders') && sql.includes('WHERE lesion_id = ?')) {
        const [lesionId] = params;
        return state.reminders.filter((r) => r.lesion_id === lesionId);
      }
      return [];
    }),
  };

  return { db, state };
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
    const { db, state } = makeStubDb({ failOnReminderWrite: true });

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
  });
});
