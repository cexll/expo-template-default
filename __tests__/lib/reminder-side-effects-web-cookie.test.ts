describe('reminder side effects web cookie session', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    delete (global as any).Notification;
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
        {
          reminder_id: 'reminder-1',
          profile_id: 'profile-1',
          lesion_id: 'lesion-1',
          examination_id: 'exam-1',
          lesion_label: '左叶结节',
          next_exam_date: '2026-09-15',
          source: 'manual',
          remind1m_sent: false,
          remind1w_sent: false,
          remind3d_sent: false,
          remind0d_sent: false,
        },
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
      reminders: [
        {
          reminder_id: 'reminder-1',
          profile_id: 'profile-1',
          lesion_id: 'lesion-1',
          examination_id: 'exam-1',
          lesion_label: '左叶结节',
          next_exam_date: '2026-09-15',
          source: 'manual',
          remind1m_sent: false,
          remind1w_sent: false,
          remind3d_sent: false,
          remind0d_sent: false,
        },
      ],
    });
  });

  it('delivers due browser notifications and marks the sent node locally', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-03T10:00:00.000Z'));
    const notificationMock = jest.fn();
    (global as any).Notification = Object.assign(notificationMock, {
      permission: 'granted',
      requestPermission: jest.fn(),
    });
    const updateReminder = jest.fn().mockResolvedValue(null);

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
      listActiveReminderDeliveryItems: jest.fn().mockResolvedValue([
        {
          reminder_id: 'reminder-1',
          profile_id: 'profile-1',
          lesion_id: 'lesion-1',
          examination_id: 'exam-1',
          lesion_label: '左叶结节',
          next_exam_date: '2026-05-06',
          source: 'manual',
          remind1m_sent: true,
          remind1w_sent: true,
          remind3d_sent: false,
          remind0d_sent: false,
        },
      ]),
      listActiveReminderSyncItems: jest.fn().mockResolvedValue([]),
      updateReminder,
    }));

    const { Platform } = require('react-native') as typeof import('react-native');
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    const { deliverDueWebReminderNotifications } = require('@/lib/reminder-side-effects') as typeof import('@/lib/reminder-side-effects');

    await expect(deliverDueWebReminderNotifications({ supported: true, permission: 'granted' })).resolves.toEqual({ ok: true, delivered: 1 });
    expect(notificationMock).toHaveBeenCalledWith('3天后需要复查', {
      body: '左叶结节 的复查日是 2026-05-06，建议提前预约。',
      tag: 'reminder:reminder-1:remind3d_sent',
    });
    expect(updateReminder).toHaveBeenCalledWith('reminder-1', {
      remind1m_sent: 1,
      remind1w_sent: 1,
      remind3d_sent: 1,
    });
  });

  it('does not resend reminder nodes that are already marked sent', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-03T10:00:00.000Z'));
    const notificationMock = jest.fn();
    (global as any).Notification = Object.assign(notificationMock, {
      permission: 'granted',
      requestPermission: jest.fn(),
    });
    const updateReminder = jest.fn();

    jest.doMock('@/lib/auth/token-storage', () => ({
      getAccessToken: jest.fn().mockResolvedValue(null),
    }));
    jest.doMock('@/lib/api', () => ({
      api: {
        post: jest.fn().mockResolvedValue({}),
      },
      AuthError: class AuthError extends Error {},
      ApiError: class ApiError extends Error {},
    }));
    jest.doMock('@/lib/db/queries/reminders', () => ({
      listActiveReminderDeliveryItems: jest.fn().mockResolvedValue([
        {
          reminder_id: 'reminder-1',
          profile_id: 'profile-1',
          lesion_id: 'lesion-1',
          examination_id: 'exam-1',
          lesion_label: '左叶结节',
          next_exam_date: '2026-05-03',
          source: 'manual',
          remind1m_sent: true,
          remind1w_sent: true,
          remind3d_sent: true,
          remind0d_sent: true,
        },
      ]),
      listActiveReminderSyncItems: jest.fn().mockResolvedValue([]),
      updateReminder,
    }));

    const { Platform } = require('react-native') as typeof import('react-native');
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    const { deliverDueWebReminderNotifications } = require('@/lib/reminder-side-effects') as typeof import('@/lib/reminder-side-effects');

    await expect(deliverDueWebReminderNotifications({ supported: true, permission: 'granted' })).resolves.toEqual({ ok: true, delivered: 0 });
    expect(notificationMock).not.toHaveBeenCalled();
    expect(updateReminder).not.toHaveBeenCalled();
  });

  it('does not query or mark reminders when browser notification permission is denied', async () => {
    const notificationMock = jest.fn();
    (global as any).Notification = Object.assign(notificationMock, {
      permission: 'denied',
      requestPermission: jest.fn(),
    });
    const listActiveReminderDeliveryItems = jest.fn();
    const updateReminder = jest.fn();

    jest.doMock('@/lib/auth/token-storage', () => ({
      getAccessToken: jest.fn().mockResolvedValue(null),
    }));
    jest.doMock('@/lib/api', () => ({
      api: {
        post: jest.fn().mockResolvedValue({}),
      },
      AuthError: class AuthError extends Error {},
      ApiError: class ApiError extends Error {},
    }));
    jest.doMock('@/lib/db/queries/reminders', () => ({
      listActiveReminderDeliveryItems,
      listActiveReminderSyncItems: jest.fn().mockResolvedValue([]),
      updateReminder,
    }));

    const { Platform } = require('react-native') as typeof import('react-native');
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    const { deliverDueWebReminderNotifications } = require('@/lib/reminder-side-effects') as typeof import('@/lib/reminder-side-effects');

    await expect(deliverDueWebReminderNotifications({ supported: true, permission: 'denied' })).resolves.toEqual({ ok: true, delivered: 0 });
    expect(listActiveReminderDeliveryItems).not.toHaveBeenCalled();
    expect(notificationMock).not.toHaveBeenCalled();
    expect(updateReminder).not.toHaveBeenCalled();
  });

  it('skips startup delivery without requesting permission or syncing reminders when permission is not already granted', async () => {
    const notificationMock = jest.fn();
    (global as any).Notification = Object.assign(notificationMock, {
      permission: 'default',
      requestPermission: jest.fn(),
    });
    const listActiveReminderDeliveryItems = jest.fn();
    const listActiveReminderSyncItems = jest.fn();

    jest.doMock('@/lib/auth/token-storage', () => ({
      getAccessToken: jest.fn().mockResolvedValue(null),
    }));
    jest.doMock('@/lib/api', () => ({
      api: {
        post: jest.fn(),
      },
      AuthError: class AuthError extends Error {},
      ApiError: class ApiError extends Error {},
    }));
    jest.doMock('@/lib/db/queries/reminders', () => ({
      listActiveReminderDeliveryItems,
      listActiveReminderSyncItems,
      updateReminder: jest.fn(),
    }));

    const { Platform } = require('react-native') as typeof import('react-native');
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    const { applyStartupReminderNotificationDelivery } = require('@/lib/reminder-side-effects') as typeof import('@/lib/reminder-side-effects');
    const { api } = require('@/lib/api') as { api: { post: jest.Mock } };

    await expect(applyStartupReminderNotificationDelivery()).resolves.toEqual({ delivery: { ok: true, delivered: 0 } });
    expect((global as any).Notification.requestPermission).not.toHaveBeenCalled();
    expect(listActiveReminderDeliveryItems).not.toHaveBeenCalled();
    expect(listActiveReminderSyncItems).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
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
