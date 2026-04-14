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
          ];
        }
        if (sql.includes('PRAGMA table_info(report_images)')) {
          return [
            { name: 'id' },
            { name: 'examination_id' },
            { name: 'uri' },
            { name: 'sort_order' },
            { name: 'mime_type' },
            { name: 'created_at' },
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
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 2;');
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
          ];
        }
        if (sql.includes('PRAGMA table_info(report_images)')) {
          return [
            { name: 'id' },
            { name: 'examination_id' },
            { name: 'uri' },
            { name: 'sort_order' },
            { name: 'mime_type' },
            { name: 'created_at' },
          ];
        }
        return [];
      }),
    };

    openDatabaseAsyncMock.mockResolvedValue(db as never);

    await getDatabase();
    await getDatabase();

    expect(openDatabaseAsyncMock).toHaveBeenCalledTimes(1);
    expect(db.execAsync).toHaveBeenCalledTimes(1);
  });
});
