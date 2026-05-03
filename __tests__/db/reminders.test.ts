jest.mock('@/lib/db', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

import { api } from '@/lib/api';
import { getDatabase } from '@/lib/db';
import type { Reminder } from '@/lib/db/types';
import {
  createReminder,
  deactivateReminder,
  listActiveReminderDeliveryItems,
  listActiveReminderSyncItems,
  listActiveRemindersByProfile,
  syncBackendRemindersToLocal,
  updateReminder,
} from '@/lib/db/queries/reminders';

const apiGetMock = jest.mocked(api.get);
const getDatabaseMock = jest.mocked(getDatabase);

describe('reminder queries', () => {
  const reminder: Reminder = {
    id: 'reminder-1',
    lesion_id: 'lesion-1',
    next_exam_date: '2026-07-13',
    source: 'auto',
    is_active: 1,
    created_at: '2026-04-13T00:00:00.000Z',
    updated_at: '2026-04-13T00:00:00.000Z',
  };

  const db = {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
  };

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    getDatabaseMock.mockResolvedValue(db as never);
  });

  it('lists active reminders by profile through lesion join', async () => {
    db.getAllAsync.mockResolvedValue([reminder]);

    await expect(listActiveRemindersByProfile('profile-1')).resolves.toEqual([reminder]);

    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('INNER JOIN lesions'),
      'profile-1'
    );
  });

  it('creates a reminder', async () => {
    db.getFirstAsync.mockResolvedValue(reminder);

    await expect(
      createReminder({
        id: reminder.id,
        lesion_id: reminder.lesion_id,
        next_exam_date: reminder.next_exam_date,
        source: reminder.source,
        is_active: reminder.is_active,
      })
    ).resolves.toEqual(reminder);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO reminders'),
      reminder.id,
      reminder.lesion_id,
      reminder.next_exam_date,
      reminder.source,
      reminder.is_active,
      0,
      0,
      0,
      0
    );
  });

  it('deactivates a reminder instead of deleting it', async () => {
    await deactivateReminder(reminder.id);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("SET is_active = 0, updated_at = datetime('now')"),
      reminder.id
    );
  });

  it('updates reminder sent flags', async () => {
    db.getFirstAsync.mockResolvedValue({ ...reminder, remind3d_sent: 1 });

    await expect(updateReminder(reminder.id, { remind3d_sent: 1 })).resolves.toMatchObject({ remind3d_sent: 1 });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE reminders SET remind3d_sent = ?, updated_at = datetime('now') WHERE id = ?"),
      1,
      reminder.id
    );
  });

  it('lists active reminder delivery items with persisted sent flags', async () => {
    db.getAllAsync.mockResolvedValue([
      {
        reminder_id: 'reminder-1',
        profile_id: 'profile-1',
        lesion_id: 'lesion-1',
        examination_id: 'exam-1',
        lesion_label: '重复结节',
        next_exam_date: '2026-07-13',
        source: 'manual',
        remind1m_sent: 1,
        remind1w_sent: 0,
        remind3d_sent: null,
        remind0d_sent: null,
      },
    ]);

    await expect(listActiveReminderDeliveryItems()).resolves.toEqual([
      {
        reminder_id: 'reminder-1',
        profile_id: 'profile-1',
        lesion_id: 'lesion-1',
        archive_profile_id: 'profile-1',
        archive_lesion_id: 'lesion-1',
        examination_id: 'exam-1',
        lesion_label: '重复结节',
        next_exam_date: '2026-07-13',
        source: 'manual',
        remind1m_sent: true,
        remind1w_sent: false,
        remind3d_sent: false,
        remind0d_sent: false,
      },
    ]);

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('reminders.remind1m_sent AS remind1m_sent'));
  });

  it('exports stable reminder sync identities instead of lesion labels', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-01T10:00:00.000Z'));
    db.getAllAsync.mockResolvedValue([
      {
        reminder_id: 'reminder-1',
        profile_id: 'profile-1',
        lesion_id: 'lesion-1',
        examination_id: 'exam-1',
        lesion_label: '重复结节',
        next_exam_date: '2026-07-13',
        source: 'manual',
        remind1m_sent: false,
        remind1w_sent: false,
        remind3d_sent: false,
        remind0d_sent: false,
      },
    ]);

    await expect(listActiveReminderSyncItems()).resolves.toEqual([
      {
        reminder_id: 'reminder-1',
        profile_id: 'profile-1',
        lesion_id: 'lesion-1',
        archive_profile_id: 'profile-1',
        archive_lesion_id: 'lesion-1',
        examination_id: 'exam-1',
        lesion_label: '重复结节',
        next_exam_date: '2026-07-13',
        source: 'manual',
        remind1m_sent: false,
        remind1w_sent: false,
        remind3d_sent: false,
        remind0d_sent: false,
      },
    ]);

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('reminders.id AS reminder_id'));
    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('lesions.profile_id AS profile_id'));
    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('latest_examinations.examination_id AS examination_id'));
  });

  it('matches backend reminder readback by stable ids when duplicate lesion labels exist', async () => {
    apiGetMock.mockResolvedValue({
      reminders: [
        {
          reminder_id: 'remote-reminder-2',
          profile_id: 'profile-1',
          lesion_id: 'lesion-2',
          examination_id: 'exam-2',
          lesion_label: '重复结节',
          next_exam_date: '2026-08-20',
          source: 'auto',
          remind1m_sent: false,
          remind1w_sent: false,
          remind3d_sent: false,
          remind0d_sent: false,
        },
      ],
    });
    db.getAllAsync
      .mockResolvedValueOnce([
        { id: 'lesion-1', label: '重复结节' },
        { id: 'lesion-2', label: '重复结节' },
      ])
      .mockResolvedValueOnce([]);
    db.getFirstAsync.mockResolvedValue({
      ...reminder,
      id: 'remote-reminder-2',
      lesion_id: 'lesion-2',
      next_exam_date: '2026-08-20',
      source: 'auto',
    });

    await expect(syncBackendRemindersToLocal('profile-1')).resolves.toBe(1);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO reminders'),
      'remote-reminder-2',
      'lesion-2',
      '2026-08-20',
      'auto',
      1,
      0,
      0,
      0,
      0
    );
  });

  it('preserves manual reminder overrides during sync readback and label rename', async () => {
    apiGetMock.mockResolvedValue({
      reminders: [
        {
          reminder_id: 'remote-auto-1',
          profile_id: 'profile-1',
          lesion_id: 'lesion-1',
          examination_id: 'exam-1',
          lesion_label: '旧标签',
          next_exam_date: '2026-09-01',
          source: 'auto',
          remind1m_sent: false,
          remind1w_sent: false,
          remind3d_sent: false,
          remind0d_sent: false,
        },
      ],
    });
    db.getAllAsync
      .mockResolvedValueOnce([{ id: 'lesion-1', label: '新标签' }])
      .mockResolvedValueOnce([{ ...reminder, id: 'manual-1', lesion_id: 'lesion-1', next_exam_date: '2026-10-10', source: 'manual' }]);

    await syncBackendRemindersToLocal('profile-1');

    expect(db.runAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE reminders SET'),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'manual-1'
    );
  });
});
