import { api } from '@/lib/api';
import { buildCloudArchivePayload, syncCloudArchiveIfEntitled } from '@/lib/cloud-sync';
import { createBackendProfile } from '@/lib/db/queries/profiles';
import { createReminder, listActiveReminderSyncItems, syncBackendRemindersToLocal } from '@/lib/db/queries/reminders';
import { saveMatchRecordAtomic } from '@/lib/db/save-match-record';
import { consumeSubscriptionQuota, normalizeSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

type DbState = {
  profiles: any[];
  lesions: any[];
  examinations: any[];
  reminders: any[];
  report_images: any[];
};

function makeIntegrationDb(initial?: Partial<DbState>) {
  const state: DbState = {
    profiles: [],
    lesions: [],
    examinations: [],
    reminders: [],
    report_images: [],
    ...initial,
  };
  const snapshots: DbState[] = [];

  const db = {
    execAsync: jest.fn(async (sql: string) => {
      if (sql === 'BEGIN;') snapshots.push(JSON.parse(JSON.stringify(state)) as DbState);
      if (sql === 'COMMIT;') snapshots.pop();
      if (sql === 'ROLLBACK;') {
        const snap = snapshots.pop();
        if (snap) {
          state.profiles = snap.profiles;
          state.lesions = snap.lesions;
          state.examinations = snap.examinations;
          state.reminders = snap.reminders;
          state.report_images = snap.report_images;
        }
      }
    }),
    runAsync: jest.fn(async (sql: string, ...params: any[]) => {
      if (sql.includes('INSERT INTO profiles')) {
        const [id, nickname, gender, birth_year, avatar_uri, sort_order] = params;
        state.profiles.push({ id, nickname, gender, birth_year, avatar_uri, sort_order, created_at: '2026-04-25T00:00:00.000Z', updated_at: '2026-04-25T00:00:00.000Z' });
        return;
      }
      if (sql.includes('INSERT INTO lesions')) {
        const [id, profile_id, disease_type, label, location, is_archived] = params;
        state.lesions.push({ id, profile_id, disease_type, label, location, is_archived, created_at: '2026-04-25T00:00:00.000Z', updated_at: '2026-04-25T00:00:00.000Z' });
        return;
      }
      if (sql.includes('INSERT INTO examinations')) {
        const [id, lesion_id, exam_date, hospital, size_x, size_y, size_z, tirads, echo_type, border, calcification, blood_flow, birads, shape, orientation, lung_rads, density, morphology, pleural_pull, ai_raw_json, notes] = params;
        state.examinations.push({ id, lesion_id, exam_date, hospital, size_x, size_y, size_z, tirads, echo_type, border, calcification, blood_flow, birads, shape, orientation, lung_rads, density, morphology, pleural_pull, ai_raw_json, notes, created_at: '2026-04-25T00:00:00.000Z', updated_at: '2026-04-25T00:00:00.000Z' });
        return;
      }
      if (sql.includes('INSERT INTO report_images')) {
        const [id, examination_id, uri, sort_order, mime_type] = params;
        state.report_images.push({ id, examination_id, uri, sort_order, mime_type, created_at: '2026-04-25T00:00:00.000Z' });
        return;
      }
      if (sql.includes('INSERT INTO reminders')) {
        const [id, lesion_id, next_exam_date, source, is_active] = params;
        state.reminders.push({ id, lesion_id, next_exam_date, source, is_active, created_at: '2026-04-25T00:00:00.000Z', updated_at: '2026-04-25T00:00:00.000Z' });
        return;
      }
      if (sql.includes('UPDATE reminders SET next_exam_date')) {
        const [next_exam_date, source, is_active, id] = params;
        const reminder = state.reminders.find((item) => item.id === id);
        if (reminder) Object.assign(reminder, { next_exam_date, source, is_active });
        return;
      }
      if (sql.includes('UPDATE reminders SET is_active')) {
        const [id] = params;
        const reminder = state.reminders.find((item) => item.id === id);
        if (reminder) reminder.is_active = 0;
      }
    }),
    getFirstAsync: jest.fn(async (sql: string, ...params: any[]) => {
      if (sql.includes('FROM profiles')) return state.profiles.find((profile) => profile.id === params[0]) ?? null;
      if (sql.includes('FROM reminders')) return state.reminders.find((reminder) => reminder.id === params[0]) ?? null;
      return null;
    }),
    getAllAsync: jest.fn(async (sql: string, ...params: any[]) => {
      if (sql.includes('FROM profiles')) return state.profiles;
      if (sql.includes('FROM lesions')) return state.lesions;
      if (sql.includes('FROM examinations')) return state.examinations;
      if (sql.includes('FROM report_images')) return state.report_images;
      if (sql.includes('SELECT lesions.label AS lesion_label')) {
        return state.reminders
          .filter((reminder) => reminder.is_active === 1)
          .map((reminder) => ({
            lesion_label: state.lesions.find((lesion) => lesion.id === reminder.lesion_id)?.label ?? '',
            next_exam_date: reminder.next_exam_date,
          }));
      }
      if (sql.includes('INNER JOIN lesions') && sql.includes('reminders.is_active = 1')) {
        const [profileId] = params;
        const lesionIds = new Set(state.lesions.filter((lesion) => lesion.profile_id === profileId).map((lesion) => lesion.id));
        return state.reminders.filter((reminder) => reminder.is_active === 1 && lesionIds.has(reminder.lesion_id));
      }
      if (sql.includes('FROM reminders') && sql.includes('WHERE lesion_id = ?')) {
        const [lesionId] = params;
        return state.reminders.filter((reminder) => reminder.lesion_id === lesionId);
      }
      if (sql.includes('FROM reminders')) return state.reminders;
      return [];
    }),
  };

  return { db, state };
}

jest.mock('@/lib/db', () => {
  let currentDb: any;
  return {
    getDatabase: jest.fn(async () => currentDb),
    __setMockDatabase: (db: any) => {
      currentDb = db;
    },
  };
});

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    upload: jest.fn(),
  },
  AuthError: class AuthError extends Error {},
  ApiError: class ApiError extends Error {
    code: number;
    status: number;

    constructor(message: string, code: number, status: number) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.status = status;
    }
  },
}));

const apiMock = api as unknown as { get: jest.Mock; post: jest.Mock };
const dbMock = require('@/lib/db') as { __setMockDatabase: (db: any) => void };

describe('frontend/backend integration acceptance', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates the first local profile from backend session onboarding state', async () => {
    const { db, state } = makeIntegrationDb();
    dbMock.__setMockDatabase(db);
    apiMock.get.mockResolvedValueOnce({ id: 'user-1', phone: '13800000000', nickname: null, is_new_user: true });

    const session = await api.get<{ id: string; is_new_user: boolean }>('/api/v1/auth/me');
    const profile = await createBackendProfile({
      sessionUserId: session.id,
      nickname: '本人',
      gender: 'female',
      birthYear: 1985,
      existingCount: state.profiles.length,
    });

    expect(apiMock.get).toHaveBeenCalledWith('/api/v1/auth/me');
    expect(profile).toMatchObject({ id: 'profile_user-1', nickname: '本人', sort_order: 0 });
    expect(state.profiles).toHaveLength(1);
  });

  it('persists backend AI recognition into local match/timeline rows atomically', async () => {
    const { db, state } = makeIntegrationDb({ profiles: [{ id: 'profile-1' }] });
    dbMock.__setMockDatabase(db);
    apiMock.post.mockResolvedValueOnce({
      disease_type: 'thyroid',
      fields: {
        location: { value: '左叶中下段', confidence: 0.9 },
        size_x: { value: '8.3', confidence: 0.92 },
        tirads: { value: '3', confidence: 0.85 },
        exam_date: { value: '2026-04-25', confidence: 0.86 },
      },
    });

    const reply = await api.post<any>('/api/v1/ai/recognize', { disease_type: 'thyroid', images: ['BASE64_A'] });
    const recognized = Object.fromEntries(
      Object.entries(reply.fields).map(([key, field]: [string, any]) => [key, field.value])
    );

    await saveMatchRecordAtomic(
      {
        activeProfileId: 'profile-1',
        createNew: true,
        diseaseType: reply.disease_type,
        recognized,
        rawRecognizedJson: JSON.stringify(reply),
        reportImages: [{ uri: 'file:///report.png', mimeType: 'image/png' }],
      },
      { db: db as any, persistReportImages: async () => [{ uri: 'data:image/png;base64,AAAA', mimeType: 'image/png' }] }
    );

    expect(apiMock.post).toHaveBeenCalledWith('/api/v1/ai/recognize', { disease_type: 'thyroid', images: ['BASE64_A'] });
    expect(state.lesions).toHaveLength(1);
    expect(state.examinations).toMatchObject([{ lesion_id: state.lesions[0].id, exam_date: '2026-04-25', size_x: 8.3, tirads: '3' }]);
    expect(state.report_images).toHaveLength(1);
    expect(state.reminders).toHaveLength(1);
  });

  it('syncs backend reminder read/write while retaining local-first rows', async () => {
    const { db, state } = makeIntegrationDb({
      lesions: [{ id: 'lesion-1', profile_id: 'profile-1', label: '左叶结节' }],
    });
    dbMock.__setMockDatabase(db);

    await createReminder({ id: 'reminder-1', lesion_id: 'lesion-1', next_exam_date: '2026-05-25', source: 'manual', is_active: 1 });
    const outbound = await listActiveReminderSyncItems();
    await api.post('/api/v1/reminders/sync', { reminders: outbound });

    apiMock.get.mockResolvedValueOnce({ reminders: [{ lesion_label: '左叶结节', next_exam_date: '2026-06-01' }] });
    await syncBackendRemindersToLocal('profile-1');

    expect(apiMock.post).toHaveBeenCalledWith('/api/v1/reminders/sync', {
      reminders: [{ lesion_label: '左叶结节', next_exam_date: '2026-05-25' }],
    });
    expect(apiMock.get).toHaveBeenCalledWith('/api/v1/reminders');
    expect(state.reminders).toHaveLength(1);
    expect(state.reminders[0]).toMatchObject({ lesion_id: 'lesion-1', next_exam_date: '2026-06-01', source: 'manual', is_active: 1 });
  });

  it('uses subscription snapshots to gate and consume AI/summary actions', async () => {
    apiMock.get.mockResolvedValueOnce({
      plan: 'free',
      is_premium: false,
      ai_recognize_used: 2,
      ai_recognize_limit: 2,
      summary_export_used: 0,
      summary_export_limit: 1,
      cloud_sync_enabled: false,
    });
    const status = normalizeSubscriptionStatus(await api.get('/api/v1/subscription/status'));

    expect(status.featureRemaining).toMatchObject({ ai_recognize: 0, summary_export: 1 });
    expect(status.isCloudSyncEnabled).toBe(false);

    await consumeSubscriptionQuota('summary_export');

    expect(apiMock.post).toHaveBeenCalledWith('/api/v1/subscription/quota/consume', { quota_type: 'summary_export' });
  });

  it('only calls optional cloud sync when the backend entitlement snapshot enables it', async () => {
    const { db } = makeIntegrationDb({
      profiles: [{ id: 'profile-1', nickname: '本人', gender: 'female', birth_year: 1985, updated_at: '2026-04-25T00:00:00.000Z' }],
      lesions: [{ id: 'lesion-1', profile_id: 'profile-1', disease_type: 'thyroid', label: '左叶结节', location: '左叶', updated_at: '2026-04-25T00:00:00.000Z' }],
      examinations: [{ id: 'exam-1', lesion_id: 'lesion-1', exam_date: '2026-04-25', hospital: '市医院', size_x: 8.3, tirads: '3', updated_at: '2026-04-25T00:00:00.000Z' }],
      reminders: [{ id: 'reminder-1', lesion_id: 'lesion-1', next_exam_date: '2026-10-25', is_active: 1, updated_at: '2026-04-25T00:00:00.000Z' }],
      report_images: [{ id: 'image-1', examination_id: 'exam-1', uri: 'file:///report.png', mime_type: 'image/png', updated_at: '2026-04-25T00:00:00.000Z' }],
    });
    dbMock.__setMockDatabase(db);

    const freeResult = await syncCloudArchiveIfEntitled({ isCloudSyncEnabled: false } as any);
    expect(freeResult).toEqual({ skipped: true, reason: 'not_entitled' });
    expect(apiMock.post).not.toHaveBeenCalled();

    apiMock.post.mockResolvedValueOnce({ synced_count: 5 });
    const premiumResult = await syncCloudArchiveIfEntitled({ isCloudSyncEnabled: true } as any);

    expect(premiumResult).toEqual({ skipped: false, syncedCount: 5 });
    expect(apiMock.post).toHaveBeenCalledWith('/api/v1/archive/sync', await buildCloudArchivePayload());
  });
});
