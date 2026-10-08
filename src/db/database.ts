import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS break_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  exercises_completed INTEGER NOT NULL DEFAULT 0,
  exercises_skipped INTEGER NOT NULL DEFAULT 0,
  exercises_total INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  session_type TEXT NOT NULL DEFAULT 'full-routine',
  status TEXT NOT NULL DEFAULT 'active',
  completed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS posture_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  cervical_angle INTEGER,
  shoulder_alignment INTEGER,
  distance_cm INTEGER,
  slouch_ratio REAL,
  status TEXT,
  status_message TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS body_discomfort (
  user_id TEXT NOT NULL,
  part TEXT NOT NULL,
  severity TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, part)
);

CREATE INDEX IF NOT EXISTS idx_posture_user_created
  ON posture_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_started
  ON break_sessions (user_id, started_at);
`;

let dbPromise: Promise<SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync('ergofocus.db').then(async (db) => {
      await db.execAsync(SCHEMA);
      await ensureColumn(db, 'break_sessions', 'exercises_skipped', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumn(db, 'break_sessions', 'duration_seconds', 'INTEGER NOT NULL DEFAULT 0');
      await ensureColumn(db, 'break_sessions', 'session_type', "TEXT NOT NULL DEFAULT 'full-routine'");
      await ensureColumn(db, 'break_sessions', 'status', "TEXT NOT NULL DEFAULT 'active'");
      return db;
    });
  }
  return dbPromise;
}

async function ensureColumn(
  db: SQLiteDatabase,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
