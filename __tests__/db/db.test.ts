jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

import { openDatabaseAsync } from 'expo-sqlite';

import { __resetDatabaseForTests, getDatabase } from '@/lib/db';

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
    };

    openDatabaseAsyncMock.mockResolvedValue(db as never);

    await getDatabase();

    expect(openDatabaseAsyncMock).toHaveBeenCalledWith('nodule-archive.db');
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS profiles'));
    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 1;');
  });

  it('reuses the opened database without rerunning migration', async () => {
    const db = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue({ user_version: 1 }),
    };

    openDatabaseAsyncMock.mockResolvedValue(db as never);

    await getDatabase();
    await getDatabase();

    expect(openDatabaseAsyncMock).toHaveBeenCalledTimes(1);
    expect(db.execAsync).toHaveBeenCalledTimes(1);
  });
});
