// This suite verifies native report-image file cleanup behavior on failure paths.

import type { Lesion, Examination, Reminder, ReportImage } from '@/lib/db/types';

const mockFiles = new Set<string>();

jest.mock('expo-file-system/legacy', () => {
  return {
    documentDirectory: 'file:///doc/',
    cacheDirectory: 'file:///cache/',
    EncodingType: { Base64: 'base64' },
    makeDirectoryAsync: jest.fn(async () => {}),
    copyAsync: jest.fn(async ({ to }: { from: string; to: string }) => {
      mockFiles.add(to);
    }),
    readAsStringAsync: jest.fn(async () => {
      throw new Error('read fail');
    }),
    writeAsStringAsync: jest.fn(async () => {
      // In these tests we force read failure, so write should be unreachable.
    }),
    deleteAsync: jest.fn(async (uri: string) => {
      mockFiles.delete(uri);
    }),
  };
});

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
      }
      if (sql.includes('UPDATE reminders')) {
        if (options?.failOnReminderWrite) {
          throw new Error('reminder update failed');
        }
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

describe('native report-image persistence cleanup', () => {
  let originalPlatformOsValue: unknown = undefined;
  let platformOsWasOverridden = false;

  beforeAll(() => {
    const { Platform } = require('react-native');
    originalPlatformOsValue = Platform.OS;
    try {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true, writable: true });
      platformOsWasOverridden = true;
    } catch {
      try {
        // Fallback if OS is writable in this environment.
         
        Platform.OS = 'ios';
        platformOsWasOverridden = true;
      } catch {
        platformOsWasOverridden = false;
      }
    }
  });

  afterAll(() => {
    if (!platformOsWasOverridden) return;
    const { Platform } = require('react-native');
    try {
      Object.defineProperty(Platform, 'OS', { value: originalPlatformOsValue, configurable: true, writable: true });
    } catch {
      try {
         
        Platform.OS = originalPlatformOsValue;
      } catch {
        // ignore restore failures in test env
      }
    }
  });

  afterEach(() => {
    mockFiles.clear();
    jest.clearAllMocks();
  });

  it('cleans up native-copied report images when the DB transaction fails later (e.g. reminder write error)', async () => {
    const { db, state } = makeStubDb({ failOnReminderWrite: true });
    const { saveMatchRecordAtomic } = require('@/lib/db/save-match-record') as typeof import('@/lib/db/save-match-record');

    await expect(
      saveMatchRecordAtomic(
        {
          activeProfileId: 'profile-1',
          createNew: true,
          diseaseType: 'thyroid',
          recognized: { location: '左叶', exam_date: '2024-03-15' },
          rawRecognizedJson: '{}',
          reportImages: [{ uri: 'file:///tmp/source.png', mimeType: 'image/png' }],
        },
        { db: db as any }
      )
    ).rejects.toThrow(/reminder/i);

    // DB rolled back
    expect(state.lesions).toHaveLength(0);
    expect(state.examinations).toHaveLength(0);
    expect(state.report_images).toHaveLength(0);

    // Native file cleaned up
    expect(mockFiles.size).toBe(0);
    // @ts-expect-error jest mock type
    const { deleteAsync } = jest.requireMock('expo-file-system/legacy') as { deleteAsync: jest.Mock };
    expect(deleteAsync).toHaveBeenCalled();
    expect(deleteAsync.mock.calls[0]?.[0]).toMatch(/^file:\/\/\/doc\/report-images\//);
  });

  it('does not delete native report images on success (files remain for later rendering)', async () => {
    const { db } = makeStubDb();
    const { saveMatchRecordAtomic } = require('@/lib/db/save-match-record') as typeof import('@/lib/db/save-match-record');

    const result = await saveMatchRecordAtomic(
      {
        activeProfileId: 'profile-1',
        createNew: true,
        diseaseType: 'thyroid',
        recognized: { location: '左叶', exam_date: '2024-03-15' },
        rawRecognizedJson: '{}',
        reportImages: [{ uri: 'file:///tmp/source.png', mimeType: 'image/png' }],
      },
      { db: db as any }
    );

    expect(result.lesionId).toMatch(/^lesion_/);
    expect(result.examinationId).toMatch(/^exam_/);
    expect(mockFiles.size).toBe(1);
    // @ts-expect-error jest mock type
    const { deleteAsync } = jest.requireMock('expo-file-system/legacy') as { deleteAsync: jest.Mock };
    expect(deleteAsync).not.toHaveBeenCalled();
  });

  it('rolls back native-copied files if persistence fails mid-way (no partial native files remain)', async () => {
    // Make the 2nd copy fail so persistOneReportImage falls back to base64 read, which we force to fail.
    // @ts-expect-error jest mock type
    const { copyAsync } = jest.requireMock('expo-file-system/legacy') as { copyAsync: jest.Mock };
    const defaultCopy = copyAsync.getMockImplementation();
    let copyCount = 0;
    copyAsync.mockImplementation(async ({ to }: { from: string; to: string }) => {
      copyCount += 1;
      if (copyCount === 2) {
        throw new Error('copy fail');
      }
      mockFiles.add(to);
    });

    const { persistReportImages } = require('@/lib/report-image-storage') as typeof import('@/lib/report-image-storage');
    await expect(
      persistReportImages(
        [
          { uri: 'file:///tmp/source-1.png', mimeType: 'image/png' },
          { uri: 'file:///tmp/source-2.png', mimeType: 'image/png' },
        ],
        'exam-1'
      )
    ).rejects.toThrow(/read fail/i);

    expect(mockFiles.size).toBe(0);
    copyAsync.mockImplementation(defaultCopy);
  });
});
