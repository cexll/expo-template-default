import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'nodule-archive.db';
export const DATABASE_VERSION = 1;

const migrations = [
  `
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      gender TEXT NOT NULL CHECK(gender IN ('male', 'female')),
      birth_year INTEGER NOT NULL,
      avatar_uri TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lesions (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      disease_type TEXT NOT NULL CHECK(disease_type IN ('thyroid', 'breast', 'lung')),
      label TEXT NOT NULL,
      location TEXT NOT NULL,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS examinations (
      id TEXT PRIMARY KEY,
      lesion_id TEXT NOT NULL REFERENCES lesions(id) ON DELETE CASCADE,
      exam_date TEXT NOT NULL,
      hospital TEXT,
      size_x REAL,
      size_y REAL,
      size_z REAL,
      tirads TEXT,
      echo_type TEXT,
      border TEXT,
      calcification TEXT,
      blood_flow TEXT,
      birads TEXT,
      shape TEXT,
      orientation TEXT,
      lung_rads TEXT,
      density TEXT,
      morphology TEXT,
      pleural_pull INTEGER,
      ai_raw_json TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS report_images (
      id TEXT PRIMARY KEY,
      examination_id TEXT NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
      uri TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      lesion_id TEXT NOT NULL REFERENCES lesions(id) ON DELETE CASCADE,
      next_exam_date TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('auto', 'manual')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_lesions_profile ON lesions(profile_id);
    CREATE INDEX IF NOT EXISTS idx_examinations_lesion ON examinations(lesion_id);
    CREATE INDEX IF NOT EXISTS idx_examinations_date ON examinations(exam_date);
    CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders(next_exam_date) WHERE is_active = 1;
    CREATE INDEX IF NOT EXISTS idx_report_images_exam ON report_images(examination_id);
  `,
];

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function migrateDatabase(db: SQLiteDatabase, targetVersion = DATABASE_VERSION) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = Number(row?.user_version ?? 0);

  for (let version = currentVersion + 1; version <= targetVersion; version += 1) {
    const migration = migrations[version - 1];

    if (!migration) {
      throw new Error(`Missing migration for database version ${version}`);
    }

    await db.execAsync(migration);
    await db.execAsync(`PRAGMA user_version = ${version};`);
  }
}

async function ensureCoreTables(db: SQLiteDatabase) {
  if (typeof (db as any).getAllAsync !== 'function') {
    return;
  }
  // expo-sqlite on web can occasionally end up with a persisted database file where
  // PRAGMA user_version is already set but the core schema is missing (e.g. an interrupted init).
  // To keep the app bootable and the local-first contract valid, defensively re-apply the
  // latest schema when required tables are absent.
  const requiredTables = ['profiles', 'lesions', 'examinations', 'report_images', 'reminders'] as const;
  const existing = new Set(
    (
      await db.getAllAsync<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${requiredTables
          .map(() => '?')
          .join(',')});`,
        ...requiredTables
      )
    ).map((row) => row.name)
  );

  const missing = requiredTables.filter((name) => !existing.has(name));
  if (missing.length === 0) return;

  // Apply the latest schema (idempotent because it uses IF NOT EXISTS).
  const latestSchema = migrations[DATABASE_VERSION - 1];
  if (!latestSchema) throw new Error('Missing latest schema migration');
  await db.execAsync(latestSchema);
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
}

async function initializeDatabase() {
  const db = await openDatabaseAsync(DATABASE_NAME);

  await db.execAsync('PRAGMA foreign_keys = ON;');
  await migrateDatabase(db);
  await ensureCoreTables(db);

  return db;
}

export async function getDatabase() {
  if (!databasePromise) {
    databasePromise = initializeDatabase();
  }

  return databasePromise;
}

export function __resetDatabaseForTests() {
  databasePromise = null;
}
