jest.mock('@/lib/db', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '@/lib/db';
import type { Reminder } from '@/lib/db/types';
import {
  createReminder,
  deactivateReminder,
  listActiveRemindersByProfile,
} from '@/lib/db/queries/reminders';

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
      reminder.is_active
    );
  });

  it('deactivates a reminder instead of deleting it', async () => {
    await deactivateReminder(reminder.id);

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("SET is_active = 0, updated_at = datetime('now')"),
      reminder.id
    );
  });
});
