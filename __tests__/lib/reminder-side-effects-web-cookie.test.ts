describe('reminder side effects web cookie session', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('syncs reminders on web without a readable access token', async () => {
    jest.doMock('@/lib/auth/token-storage', () => ({
      getAccessToken: jest.fn().mockResolvedValue(null),
    }));
    jest.doMock('@/lib/api', () => ({
      api: {
        post: jest.fn().mockResolvedValue({}),
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
    jest.doMock('@/lib/db/queries/reminders', () => ({
      listActiveReminderSyncItems: jest.fn().mockResolvedValue([
        { lesion_label: '左叶结节', next_exam_date: '2026-09-15' },
      ]),
    }));

    const { Platform } = require('react-native') as typeof import('react-native');
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    const { syncRemindersToBackend } = require('@/lib/reminder-side-effects') as typeof import('@/lib/reminder-side-effects');
    const { api } = require('@/lib/api') as {
      api: { post: jest.Mock };
    };

    await expect(syncRemindersToBackend()).resolves.toEqual({ ok: true, sent: 1 });
    expect(api.post).toHaveBeenCalledWith('/api/v1/reminders/sync', {
      reminders: [{ lesion_label: '左叶结节', next_exam_date: '2026-09-15' }],
    });
  });

  it('still reports unauthenticated sync on native when no token exists', async () => {
    jest.doMock('@/lib/auth/token-storage', () => ({
      getAccessToken: jest.fn().mockResolvedValue(null),
    }));
    jest.doMock('@/lib/api', () => ({
      api: {
        post: jest.fn(),
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
    jest.doMock('@/lib/db/queries/reminders', () => ({
      listActiveReminderSyncItems: jest.fn(),
    }));

    const { Platform } = require('react-native') as typeof import('react-native');
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });

    const { syncRemindersToBackend } = require('@/lib/reminder-side-effects') as typeof import('@/lib/reminder-side-effects');
    const { api } = require('@/lib/api') as {
      api: { post: jest.Mock };
    };

    await expect(syncRemindersToBackend()).resolves.toEqual({
      ok: false,
      error: '未登录，无法同步提醒',
    });
    expect(api.post).not.toHaveBeenCalled();
  });
});
