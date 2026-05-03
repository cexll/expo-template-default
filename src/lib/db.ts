import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'nodule-archive.db';
export const DATABASE_VERSION = 3;

type Migration = string | ((db: SQLiteDatabase) => Promise<void>);

const SCHEMA_V1 = `
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
`;

const SCHEMA_V2 = `
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
      mime_type TEXT,
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
`;

async function ensureReportImageMimeTypeColumn(db: SQLiteDatabase) {
  if (typeof (db as any).getAllAsync !== 'function') return;
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(report_images);');
  const hasMime = columns.some((col) => col.name === 'mime_type');
  if (hasMime) return;
  await db.execAsync('ALTER TABLE report_images ADD COLUMN mime_type TEXT;');
}

async function ensureColumn(db: SQLiteDatabase, table: string, name: string, definition: string) {
  if (typeof (db as any).getAllAsync !== 'function') return;
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
  if (columns.some((col) => col.name === name)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition};`);
}

async function ensureCloudArchiveSyncColumns(db: SQLiteDatabase) {
  await ensureColumn(db, 'profiles', 'sync_version', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'lesions', 'sync_version', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'examinations', 'sync_version', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'report_images', 'object_key', 'TEXT');
  await ensureColumn(db, 'report_images', 'size_bytes', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'report_images', 'sha256', 'TEXT');
  await ensureColumn(db, 'report_images', 'sync_version', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'report_images', 'updated_at', "TEXT NOT NULL DEFAULT (datetime('now'))");
  await ensureColumn(db, 'reminders', 'remind1m_sent', 'INTEGER');
  await ensureColumn(db, 'reminders', 'remind1w_sent', 'INTEGER');
  await ensureColumn(db, 'reminders', 'remind3d_sent', 'INTEGER');
  await ensureColumn(db, 'reminders', 'remind0d_sent', 'INTEGER');
  await ensureColumn(db, 'reminders', 'sync_version', 'INTEGER NOT NULL DEFAULT 0');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS archive_tombstones (
      entity_type TEXT NOT NULL,
      local_id TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      sync_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (entity_type, local_id)
    );
  `);
}

async function applyMigration(db: SQLiteDatabase, migration: Migration) {
  if (typeof migration === 'string') {
    await db.execAsync(migration);
    return;
  }
  await migration(db);
}

const migrations: Migration[] = [
  async (db) => {
    await db.execAsync(SCHEMA_V1);
  },
  async (db) => {
    await db.execAsync(SCHEMA_V2);
    await ensureReportImageMimeTypeColumn(db);
  },
  async (db) => {
    await ensureCloudArchiveSyncColumns(db);
  },
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

    await applyMigration(db, migration);
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
  const requiredTables = ['profiles', 'lesions', 'examinations', 'report_images', 'reminders', 'archive_tombstones'] as const;
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

  // Apply the latest table schema (idempotent because it uses IF NOT EXISTS), then ensure additive sync columns.
  await db.execAsync(SCHEMA_V2);
  await ensureReportImageMimeTypeColumn(db);
  await ensureCloudArchiveSyncColumns(db);
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
}

async function initializeDatabase() {
  const db = await openDatabaseAsync(DATABASE_NAME);

  await db.execAsync('PRAGMA foreign_keys = ON;');
  await migrateDatabase(db);
  await ensureCoreTables(db);
  await ensureReportImageMimeTypeColumn(db);
  await ensureCloudArchiveSyncColumns(db);

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
