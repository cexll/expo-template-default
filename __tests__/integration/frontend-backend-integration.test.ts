import { api } from '@/lib/api';
import { buildCloudArchivePayload, syncCloudArchiveIfEntitled } from '@/lib/cloud-sync';
import { createBackendProfile } from '@/lib/db/queries/profiles';
import { createReminder, listActiveReminderSyncItems, syncBackendRemindersToLocal } from '@/lib/db/queries/reminders';
import { saveMatchRecordAtomic } from '@/lib/db/save-match-record';
import { normalizeRecognitionOutput } from '@/lib/recognition/normalization';
import { consumeSubscriptionQuota, normalizeSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

type DbState = {
  profiles: any[];
  lesions: any[];
  examinations: any[];
  reminders: any[];
  report_images: any[];
  archive_tombstones: any[];
};

function makeIntegrationDb(initial?: Partial<DbState>) {
  const state: DbState = {
    profiles: [],
    lesions: [],
    examinations: [],
    reminders: [],
    report_images: [],
    archive_tombstones: [],
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
          state.archive_tombstones = snap.archive_tombstones;
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
      if (sql.includes('INSERT INTO archive_tombstones')) {
        const [entity_type, local_id, deleted_at, sync_version] = params;
        state.archive_tombstones.push({ entity_type, local_id, deleted_at, sync_version, created_at: '2026-04-25T00:00:00.000Z' });
        return;
      }
      if (sql.includes('INSERT INTO reminders')) {
        const [id, lesion_id, next_exam_date, source, is_active, remind1m_sent, remind1w_sent, remind3d_sent, remind0d_sent] = params;
        state.reminders.push({ id, lesion_id, next_exam_date, source, is_active, remind1m_sent, remind1w_sent, remind3d_sent, remind0d_sent, created_at: '2026-04-25T00:00:00.000Z', updated_at: '2026-04-25T00:00:00.000Z' });
        return;
      }
      if (sql.includes('UPDATE reminders SET next_exam_date')) {
        const [next_exam_date, source, is_active, remind1m_sent, remind1w_sent, remind3d_sent, remind0d_sent, id] = params;
        const reminder = state.reminders.find((item) => item.id === id);
        if (reminder) Object.assign(reminder, { next_exam_date, source, is_active, remind1m_sent, remind1w_sent, remind3d_sent, remind0d_sent });
        return;
      }
      if (sql.includes('UPDATE reminders SET source')) {
        const [source, is_active, id] = params;
        const reminder = state.reminders.find((item) => item.id === id);
        if (reminder) Object.assign(reminder, { source, is_active });
        return;
      }
      if (sql.includes('UPDATE reminders SET is_active')) {
        const [id] = params;
        const reminder = state.reminders.find((item) => item.id === id);
        if (reminder) reminder.is_active = 0;
      }
      if (sql.includes('UPDATE report_images SET object_key')) {
        const [object_key, size_bytes, sha256, id] = params;
        const image = state.report_images.find((item) => item.id === id);
        if (image) Object.assign(image, { object_key, size_bytes, sha256, updated_at: '2026-04-25T00:00:00.000Z' });
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
      if (sql.includes('FROM profiles')) return state.profiles.find((profile) => profile.id === params[0]) ?? null;
      if (sql.includes('FROM reminders')) return state.reminders.find((reminder) => reminder.id === params[0]) ?? null;
      return null;
    }),
    getAllAsync: jest.fn(async (sql: string, ...params: any[]) => {
      if (sql.includes('reminders.id AS reminder_id')) {
        return state.reminders
          .filter((reminder) => reminder.is_active === 1)
          .map((reminder) => {
            const lesion = state.lesions.find((item) => item.id === reminder.lesion_id);
            const latestExam = state.examinations
              .filter((exam) => exam.lesion_id === reminder.lesion_id)
              .sort((a, b) => b.exam_date.localeCompare(a.exam_date))[0];
            return {
              reminder_id: reminder.id,
              profile_id: lesion?.profile_id ?? '',
              lesion_id: reminder.lesion_id,
              examination_id: latestExam?.id ?? null,
              lesion_label: lesion?.label ?? '',
              next_exam_date: reminder.next_exam_date,
              source: reminder.source,
              remind1m_sent: reminder.remind1m_sent ?? null,
              remind1w_sent: reminder.remind1w_sent ?? null,
              remind3d_sent: reminder.remind3d_sent ?? null,
              remind0d_sent: reminder.remind0d_sent ?? null,
            };
          });
      }
      if (sql.includes('INNER JOIN lesions') && sql.includes('reminders.is_active = 1')) {
        const [profileId] = params;
        const lesionIds = new Set(state.lesions.filter((lesion) => lesion.profile_id === profileId).map((lesion) => lesion.id));
        return state.reminders.filter((reminder) => reminder.is_active === 1 && lesionIds.has(reminder.lesion_id));
      }
      if (sql.includes('FROM profiles')) return state.profiles;
      if (sql.includes('FROM lesions')) return state.lesions;
      if (sql.includes('FROM examinations')) return state.examinations;
      if (sql.includes('FROM report_images')) return state.report_images;
      if (sql.includes('FROM archive_tombstones')) return state.archive_tombstones;
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

const apiMock = api as unknown as { get: jest.Mock; post: jest.Mock; upload: jest.Mock };
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
        rads_grade: { value: 'TI-RADS 3', normalized_value: 'TI-RADS 3', enum_value: 'ti_rads_3', confidence: 0.85 },
        echo_type: { value: '低回声', confidence: 0.81 },
        border: { value: '清晰', confidence: 0.82 },
        calcification: { value: '无', confidence: 0.8 },
        blood_flow: { value: '少量', confidence: 0.79 },
        exam_date: { value: '2026-04-25', confidence: 0.86 },
      },
      usage: { used: 1, limit: 2, is_premium: false },
      missing_required: [],
      source_images: [{ index: 0, ref: 'request-image-0', mime_type: 'image/jpeg' }],
      status: 'completed',
    });

    const reply = await api.post<any>('/api/v1/ai/recognize', { disease_type: 'thyroid', images: ['BASE64_A'] });
    const normalized = normalizeRecognitionOutput({
      requestedDiseaseType: 'thyroid',
      providerOutput: reply,
      reportImages: [{ uri: 'file:///report.png', mimeType: 'image/png' }],
    });

    await saveMatchRecordAtomic(
      {
        activeProfileId: 'profile-1',
        createNew: true,
        diseaseType: normalized.command.diseaseType,
        recognized: normalized.command.recognized,
        rawRecognizedJson: JSON.stringify(reply),
        reportImages: [{ uri: 'file:///report.png', mimeType: 'image/png' }],
      },
      { db: db as any, persistReportImages: async () => [{ uri: 'data:image/png;base64,AAAA', mimeType: 'image/png' }] }
    );

    expect(apiMock.post).toHaveBeenCalledWith('/api/v1/ai/recognize', { disease_type: 'thyroid', images: ['BASE64_A'] });
    expect(normalized.missingRequiredFields).toEqual([]);
    expect(normalized.reportImages).toEqual([{ uri: 'file:///report.png', mimeType: 'image/png', sourceIndex: 0 }]);
    expect(normalized.command.recognized).toMatchObject({ location: '左叶中下段', size_x: 8.3, tirads: '3', exam_date: '2026-04-25' });
    expect(state.lesions).toHaveLength(1);
    expect(state.examinations).toMatchObject([{ lesion_id: state.lesions[0].id, exam_date: '2026-04-25', size_x: 8.3, tirads: '3' }]);
    expect(state.report_images).toHaveLength(1);
    expect(state.reminders).toHaveLength(1);
    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('archive_projection_refresh'), state.lesions[0].id);
  });

  it('syncs backend reminder read/write while retaining local-first rows', async () => {
    const { db, state } = makeIntegrationDb({
      lesions: [{ id: 'lesion-1', profile_id: 'profile-1', label: '左叶结节' }],
    });
    dbMock.__setMockDatabase(db);

    await createReminder({ id: 'reminder-1', lesion_id: 'lesion-1', next_exam_date: '2026-05-25', source: 'manual', is_active: 1 });
    const outbound = await listActiveReminderSyncItems();
    await api.post('/api/v1/reminders/sync', { reminders: outbound });

    apiMock.get.mockResolvedValueOnce({
      reminders: [
        {
          reminder_id: 'reminder-1',
          archive_profile_id: 'profile-1',
          archive_lesion_id: 'lesion-1',
          lesion_label: '左叶结节',
          next_exam_date: '2026-06-01',
          source: 'manual',
          remind1m_sent: false,
          remind1w_sent: false,
          remind3d_sent: false,
          remind0d_sent: false,
        },
      ],
    });
    await syncBackendRemindersToLocal('profile-1');

    expect(apiMock.post).toHaveBeenCalledWith('/api/v1/reminders/sync', {
      reminders: [
        {
          reminder_id: 'reminder-1',
          profile_id: 'profile-1',
          lesion_id: 'lesion-1',
          archive_profile_id: 'profile-1',
          archive_lesion_id: 'lesion-1',
          examination_id: null,
          lesion_label: '左叶结节',
          next_exam_date: '2026-05-25',
          source: 'manual',
          remind1m_sent: false,
          remind1w_sent: false,
          remind3d_sent: false,
          remind0d_sent: false,
        },
      ],
    });
    expect(apiMock.get).toHaveBeenCalledWith('/api/v1/reminders');
    expect(state.reminders).toHaveLength(1);
    expect(state.reminders[0]).toMatchObject({ lesion_id: 'lesion-1', next_exam_date: '2026-06-01', source: 'manual', is_active: 1 });
  });

  it('keeps manual reminder override authoritative when backend readback still has stale auto date after lesion rename', async () => {
    const { db, state } = makeIntegrationDb({
      lesions: [{ id: 'lesion-1', profile_id: 'profile-1', label: '重命名结节' }],
      reminders: [{ id: 'manual-reminder-1', lesion_id: 'lesion-1', next_exam_date: '2026-10-10', source: 'manual', is_active: 1, created_at: '2026-04-25T00:00:00.000Z', updated_at: '2026-04-25T00:00:00.000Z' }],
    });
    dbMock.__setMockDatabase(db);

    apiMock.get.mockResolvedValueOnce({
      reminders: [
        {
          reminder_id: 'auto-reminder-1',
          archive_profile_id: 'profile-1',
          archive_lesion_id: 'lesion-1',
          lesion_label: '旧标签',
          next_exam_date: '2026-05-01',
          source: 'auto',
          remind1m_sent: false,
          remind1w_sent: false,
          remind3d_sent: false,
          remind0d_sent: false,
        },
      ],
    });

    await syncBackendRemindersToLocal('profile-1');

    expect(state.reminders).toEqual([
      expect.objectContaining({ id: 'manual-reminder-1', lesion_id: 'lesion-1', next_exam_date: '2026-10-10', source: 'manual', is_active: 1 }),
    ]);
  });

  it('uses subscription snapshots to gate, upgrade, refresh, and consume quota actions', async () => {
    apiMock.get
      .mockResolvedValueOnce({
        plan: 'free',
        status: 'inactive',
        is_premium: false,
        ai_quota: { key: 'ai_recognize', used: 2, limit: 2, remaining: 0, unlimited: false },
        summary_export_quota: { key: 'summary_export', used: 1, limit: 1, remaining: 0, unlimited: false },
        profile_limit: { key: 'profiles', limit: 3, unlimited: false },
        lesion_limit: { key: 'lesions_per_profile', limit: 5, unlimited: false },
        record_limit: { key: 'records_per_lesion', limit: 10, unlimited: false },
        cloud_sync_entitlement: { key: 'cloud_sync', enabled: false, reason: 'requires_active_subscription' },
      })
      .mockResolvedValueOnce({
        plan: 'yearly',
        status: 'active',
        is_premium: true,
        expires_at: '2026-12-31T00:00:00.000Z',
        ai_quota: { key: 'ai_recognize', used: 0, limit: -1, remaining: 0, unlimited: true },
        summary_export_quota: { key: 'summary_export', used: 0, limit: -1, remaining: 0, unlimited: true },
        profile_limit: { key: 'profiles', limit: -1, unlimited: true },
        lesion_limit: { key: 'lesions_per_profile', limit: -1, unlimited: true },
        record_limit: { key: 'records_per_lesion', limit: -1, unlimited: true },
        cloud_sync_entitlement: { key: 'cloud_sync', enabled: true, reason: 'active_subscription' },
      });
    apiMock.post.mockResolvedValueOnce({ used: 1, limit: 1, is_premium: false });

    const freeStatus = normalizeSubscriptionStatus(await api.get('/api/v1/subscription/status'));

    expect(freeStatus.featureRemaining).toMatchObject({ ai_recognize: 0, summary_export: 0 });
    expect(freeStatus.isCloudSyncEnabled).toBe(false);
    expect(freeStatus.freeLimits).toMatchObject({ profiles: 3, lesionsPerProfile: 5, recordsPerLesion: 10 });
    expect(freeStatus.cloudSyncReason).toBe('requires_active_subscription');

    await consumeSubscriptionQuota('summary_export');

    expect(apiMock.post).toHaveBeenCalledWith('/api/v1/subscription/quota/consume', { quota_type: 'summary_export' });

    const premiumStatus = normalizeSubscriptionStatus(await api.get('/api/v1/subscription/status'));

    expect(premiumStatus.isActive).toBe(true);
    expect(premiumStatus.plan).toBe('yearly');
    expect(premiumStatus.isCloudSyncEnabled).toBe(true);
    expect(premiumStatus.cloudSyncReason).toBe('active_subscription');
    expect(premiumStatus.freeLimits).toBeUndefined();
  });

  it('maps optional cloud sync to the backend full-fidelity archive DTO when entitlement enables it', async () => {
    const { db } = makeIntegrationDb({
      profiles: [{ id: 'profile-1', nickname: '本人', gender: 'female', birth_year: 1985, avatar_uri: 'file:///avatar.png', sort_order: 2, sync_version: 7, updated_at: '2026-04-25T00:00:00.000Z' }],
      lesions: [{ id: 'lesion-1', profile_id: 'profile-1', disease_type: 'thyroid', label: '左叶结节', location: '左叶', is_archived: 1, sync_version: 8, updated_at: '2026-04-25T00:00:00.000Z' }],
      examinations: [{ id: 'exam-1', lesion_id: 'lesion-1', exam_date: '2026-04-25', hospital: '市医院', size_x: 8.3, size_y: 4.2, size_z: 3.1, tirads: 'TI-RADS 4A', echo_type: '低回声', border: '欠清', calcification: '点状强回声', blood_flow: '少量', birads: null, shape: null, orientation: null, lung_rads: null, density: null, morphology: null, pleural_pull: null, ai_raw_json: '{"source":"ocr"}', notes: '甲状腺字段不可丢失', sync_version: 9, updated_at: '2026-04-25T00:00:00.000Z' }],
      reminders: [{ id: 'reminder-1', lesion_id: 'lesion-1', next_exam_date: '2026-10-25', source: 'manual', is_active: 1, remind1m_sent: 1, remind1w_sent: 1, remind3d_sent: 0, remind0d_sent: 0, sync_version: 10, updated_at: '2026-04-25T00:00:00.000Z' }],
      report_images: [
        { id: 'image-1', examination_id: 'exam-1', uri: 'reports/profile-1/exam-1/image-1.png', object_key: '************************************', mime_type: 'image/png', size_bytes: 3210, sha256: 'abc123', sort_order: 3, sync_version: 11, updated_at: '2026-04-25T00:00:00.000Z' },
        { id: 'image-local-only', examination_id: 'exam-1', uri: 'data:image/png;base64,LOCAL', object_key: null, mime_type: 'image/png', size_bytes: 6543, sha256: 'local123', sort_order: 4, sync_version: 11, updated_at: '2026-04-25T00:00:00.000Z' },
      ],
      archive_tombstones: [{ entity_type: 'report_image', local_id: 'old-image-1', deleted_at: '2026-04-25T12:00:00.000Z', sync_version: 12 }],
    });
    dbMock.__setMockDatabase(db);

    const freeResult = await syncCloudArchiveIfEntitled({ isCloudSyncEnabled: false } as any);
    expect(freeResult).toEqual({ skipped: true, reason: 'not_entitled' });
    expect(apiMock.post).not.toHaveBeenCalled();

    apiMock.upload.mockResolvedValueOnce({ object_key: 'reports/uploaded/image-local-only.png', mime_type: 'image/png', size_bytes: 6543, sha256: 'local123' });
    apiMock.post.mockResolvedValueOnce({ synced_count: 6 });
    apiMock.get.mockResolvedValueOnce({
      profiles: [{ local_id: 'profile-1', display_name: '本人', gender: 'female', birth_year: 1985, sync_version: 7 }],
      lesions: [{ local_id: 'lesion-1', profile_local_id: 'profile-1', disease_type: 'thyroid', label: '左叶结节', location: '左叶', is_archived: true, sync_version: 8 }],
      examinations: [{ local_id: 'exam-1', lesion_local_id: 'lesion-1', exam_date: '2026-04-25', size_x: 8.3, size_y: 4.2, tirads: 'TI-RADS 4A', echo_type: '低回声', sync_version: 9 }],
      report_images: [{ local_id: 'image-1', examination_local_id: 'exam-1', object_key: 'reports/profile-1/exam-1/image-1.png', mime_type: 'image/png', size_bytes: 3210, sha256: 'abc123', sync_version: 11 }],
      reminders: [{ local_id: 'reminder-1', lesion_local_id: 'lesion-1', next_exam_date: '2026-10-25', is_active: true, remind1m_sent: true, sync_version: 10 }],
      tombstones: [{ entity_type: 'report_image', local_id: 'old-image-1', deleted_at: '2026-04-25T12:00:00.000Z', sync_version: 12 }],
    });
    const premiumResult = await syncCloudArchiveIfEntitled({ isCloudSyncEnabled: true } as any);

    expect(premiumResult).toEqual({ skipped: false, syncedCount: 6, readbackCount: 6 });
    const expectedPayload = await buildCloudArchivePayload();
    expect(expectedPayload).toEqual({
      profiles: [
        expect.objectContaining({ local_id: 'profile-1', display_name: '本人', avatar_uri: 'file:///avatar.png', sort_order: 2, sync_version: 7 }),
      ],
      lesions: [
        expect.objectContaining({ local_id: 'lesion-1', is_archived: true, sync_version: 8 }),
      ],
      examinations: [
        expect.objectContaining({
          local_id: 'exam-1',
          size_x: 8.3,
          size_y: 4.2,
          size_z: 3.1,
          tirads: 'TI-RADS 4A',
          echo_type: '低回声',
          border: '欠清',
          calcification: '点状强回声',
          blood_flow: '少量',
          ai_raw_json: '{"source":"ocr"}',
          notes: '甲状腺字段不可丢失',
          sync_version: 9,
        }),
      ],
      report_images: [
        {
          local_id: 'image-1',
          examination_local_id: 'exam-1',
          object_key: expect.any(String),
          mime_type: 'image/png',
          size_bytes: 3210,
          sha256: 'abc123',
          sort_order: 3,
          sync_version: 11,
          updated_at: '2026-04-25T00:00:00.000Z',
        },
        {
          local_id: 'image-local-only',
          examination_local_id: 'exam-1',
          object_key: 'reports/uploaded/image-local-only.png',
          mime_type: 'image/png',
          size_bytes: 6543,
          sha256: 'local123',
          sort_order: 4,
          sync_version: 11,
          updated_at: '2026-04-25T00:00:00.000Z',
        },
      ],
      reminders: [
        expect.objectContaining({ local_id: 'reminder-1', source: 'manual', is_active: true, remind1m_sent: true, remind1w_sent: true, sync_version: 10 }),
      ],
      tombstones: [
        expect.objectContaining({ entity_type: 'report_image', local_id: 'old-image-1', deleted_at: '2026-04-25T12:00:00.000Z', sync_version: 12 }),
      ],
    });
    expect(expectedPayload.examinations[0]).not.toHaveProperty('size_mm');
    expect(apiMock.post).toHaveBeenCalledWith('/api/v1/archive/sync', expectedPayload);
    expect(apiMock.get).toHaveBeenCalledWith('/api/v1/archive');
  });
});
