import { openDatabaseAsync } from 'expo-sqlite';

import { __resetDatabaseForTests, getDatabase } from '@/lib/db';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

const openDatabaseAsyncMock = jest.mocked(openDatabaseAsync);

describe('db init', () => {
  beforeEach(() => {
    __resetDatabaseForTests();
    jest.clearAllMocks();
  });

  it('opens the nodule archive database and runs first-time migration', async () => {
    const db = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue({ user_version: 0 }),
      getAllAsync: jest.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('sqlite_master')) {
          return [
            { name: 'profiles' },
            { name: 'lesions' },
            { name: 'examinations' },
            { name: 'report_images' },
            { name: 'reminders' },
            { name: 'archive_tombstones' },
          ];
        }
        if (sql.includes('PRAGMA table_info(report_images)')) {
          return [
            { name: 'id' },
            { name: 'examination_id' },
            { name: 'uri' },
            { name: 'sort_order' },
            { name: 'mime_type' },
            { name: 'object_key' },
            { name: 'size_bytes' },
            { name: 'sha256' },
            { name: 'sync_version' },
            { name: 'updated_at' },
            { name: 'created_at' },
          ];
        }
        if (sql.includes('PRAGMA table_info(profiles)') || sql.includes('PRAGMA table_info(lesions)') || sql.includes('PRAGMA table_info(examinations)')) {
          return [{ name: 'sync_version' }];
        }
        if (sql.includes('PRAGMA table_info(reminders)')) {
          return [
            { name: 'remind1m_sent' },
            { name: 'remind1w_sent' },
            { name: 'remind3d_sent' },
            { name: 'remind0d_sent' },
            { name: 'sync_version' },
          ];
        }
        return [];
      }),
    };

    openDatabaseAsyncMock.mockResolvedValue(db as never);

    await getDatabase();

    expect(openDatabaseAsyncMock).toHaveBeenCalledWith('nodule-archive.db');
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS profiles'));
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 3;');
  });

  it('reuses the opened database without rerunning migration', async () => {
    const db = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue({ user_version: 2 }),
      getAllAsync: jest.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('sqlite_master')) {
          return [
            { name: 'profiles' },
            { name: 'lesions' },
            { name: 'examinations' },
            { name: 'report_images' },
            { name: 'reminders' },
            { name: 'archive_tombstones' },
          ];
        }
        if (sql.includes('PRAGMA table_info(report_images)')) {
          return [
            { name: 'id' },
            { name: 'examination_id' },
            { name: 'uri' },
            { name: 'sort_order' },
            { name: 'mime_type' },
            { name: 'object_key' },
            { name: 'size_bytes' },
            { name: 'sha256' },
            { name: 'sync_version' },
            { name: 'updated_at' },
            { name: 'created_at' },
          ];
        }
        if (sql.includes('PRAGMA table_info(profiles)') || sql.includes('PRAGMA table_info(lesions)') || sql.includes('PRAGMA table_info(examinations)')) {
          return [{ name: 'sync_version' }];
        }
        if (sql.includes('PRAGMA table_info(reminders)')) {
          return [
            { name: 'remind1m_sent' },
            { name: 'remind1w_sent' },
            { name: 'remind3d_sent' },
            { name: 'remind0d_sent' },
            { name: 'sync_version' },
          ];
        }
        return [];
      }),
    };

    openDatabaseAsyncMock.mockResolvedValue(db as never);

    await getDatabase();
    await getDatabase();

    expect(openDatabaseAsyncMock).toHaveBeenCalledTimes(1);
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
    expect(db.execAsync).toHaveBeenCalledTimes(4);
  });
});
