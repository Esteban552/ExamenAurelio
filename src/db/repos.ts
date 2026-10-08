import { getDb } from './database';
import { PostureMetrics, BodyPartDiscomfort } from '../types';

const now = () => new Date().toISOString();

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function isoDayAfterToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

/* ---------------- break_sessions ---------------- */

export async function startBreakSession(
  userId: string,
  exercisesTotal: number,
  sessionType: 'full-routine' | 'directed-exercise'
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO break_sessions (user_id, started_at, exercises_total, session_type) VALUES (?, ?, ?, ?)',
    [userId, now(), exercisesTotal, sessionType]
  );
  return result.lastInsertRowId;
}

export async function completeBreakSession(
  sessionId: number,
  result: {
    exercisesCompleted: number;
    exercisesSkipped: number;
    durationSeconds: number;
  }
): Promise<void> {
  const db = await getDb();
  const completed = result.exercisesCompleted > 0 ? 1 : 0;
  const status = completed ? 'completed' : 'skipped';
  await db.runAsync(
    `UPDATE break_sessions
     SET completed_at = ?, exercises_completed = ?, exercises_skipped = ?,
         duration_seconds = ?, status = ?, completed = ?
     WHERE id = ?`,
    [
      now(),
      result.exercisesCompleted,
      result.exercisesSkipped,
      result.durationSeconds,
      status,
      completed,
      sessionId,
    ]
  );
}

export async function abandonBreakSession(sessionId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE break_sessions SET completed_at = ?, status = 'abandoned' WHERE id = ? AND status = 'active'",
    [now(), sessionId]
  );
}

export interface DayBucket {
  dayKey: string;
  breaks: number;
  completedBreaks: number;
}

/** Break sessions agrupados por día local en los últimos N días (incluye hoy). */
export async function getBreaksByDay(
  userId: string,
  days = 7
): Promise<Map<string, DayBucket>> {
  const db = await getDb();
  const since = isoDaysAgo(days - 1);
  const rows = await db.getAllAsync<{ started_at: string; completed: number }>(
    'SELECT started_at, completed FROM break_sessions WHERE user_id = ? AND started_at >= ?',
    [userId, since]
  );

  const buckets = new Map<string, DayBucket>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets.set(localDayKey(d), { dayKey: localDayKey(d), breaks: 0, completedBreaks: 0 });
  }
  for (const row of rows) {
    const key = localDayKey(new Date(row.started_at));
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.breaks += 1;
      if (row.completed) bucket.completedBreaks += 1;
    }
  }
  return buckets;
}

/** Total de micro-pausas completadas (progreso de insignias). */
export async function getCompletedBreaksCount(userId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) as n FROM break_sessions WHERE user_id = ? AND completed = 1',
    [userId]
  );
  return row?.n ?? 0;
}

/* ---------------- posture_logs ---------------- */

export async function logPosture(
  userId: string,
  metrics: PostureMetrics
): Promise<void> {
  if (
    metrics.score === null ||
    metrics.source !== 'detector' ||
    !metrics.detected
  ) {
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO posture_logs
      (user_id, score, cervical_angle, shoulder_alignment, distance_cm, slouch_ratio, status, status_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      Math.round(metrics.score),
      metrics.cervicalAngle === null ? null : Math.round(metrics.cervicalAngle),
      metrics.shoulderAlignment === null ? null : Math.round(metrics.shoulderAlignment),
      metrics.distanceCm === null ? null : Math.round(metrics.distanceCm),
      metrics.slouchRatio,
      metrics.status,
      metrics.statusMessage,
      now(),
    ]
  );
}

export interface PostureDayAvg {
  dayKey: string;
  avgScore: number | null;
}

export interface DashboardStats {
  completedBreaksToday: number;
  postureAverage7Days: number | null;
  postureAveragePrevious7Days: number | null;
  neutralPosturePercent7Days: number | null;
  postureAverageToday: number | null;
  postureSamples7Days: number;
}

/** Agregados reales para dashboard y comparación semanal con ventanas disjuntas. */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const db = await getDb();
  const todayStart = isoDaysAgo(0);
  const currentWeekStart = isoDaysAgo(6);
  const previousWeekStart = isoDaysAgo(13);
  const tomorrowStart = isoDayAfterToday();

  const [breaks, posture] = await Promise.all([
    db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM break_sessions
       WHERE user_id = ? AND completed = 1
         AND completed_at >= ? AND completed_at < ?`,
      [userId, todayStart, tomorrowStart]
    ),
    db.getFirstAsync<{
      avg7: number | null;
      avgPrevious7: number | null;
      neutral7: number | null;
      avgToday: number | null;
      samples7: number;
    }>(
      `SELECT
         AVG(CASE WHEN created_at >= ? AND created_at < ? THEN score END) AS avg7,
         AVG(CASE WHEN created_at >= ? AND created_at < ? THEN score END) AS avgPrevious7,
         AVG(CASE WHEN created_at >= ? AND created_at < ? AND score IS NOT NULL
                  THEN CASE WHEN score >= 85 THEN 100.0 ELSE 0.0 END END) AS neutral7,
         AVG(CASE WHEN created_at >= ? AND created_at < ? THEN score END) AS avgToday,
         COUNT(CASE WHEN created_at >= ? AND created_at < ? AND score IS NOT NULL THEN 1 END) AS samples7
       FROM posture_logs
       WHERE user_id = ? AND created_at >= ? AND created_at < ?`,
      [
        currentWeekStart,
        tomorrowStart,
        previousWeekStart,
        currentWeekStart,
        currentWeekStart,
        tomorrowStart,
        todayStart,
        tomorrowStart,
        currentWeekStart,
        tomorrowStart,
        userId,
        previousWeekStart,
        tomorrowStart,
      ]
    ),
  ]);

  return {
    completedBreaksToday: breaks?.count ?? 0,
    postureAverage7Days: posture?.avg7 ?? null,
    postureAveragePrevious7Days: posture?.avgPrevious7 ?? null,
    neutralPosturePercent7Days: posture?.neutral7 ?? null,
    postureAverageToday: posture?.avgToday ?? null,
    postureSamples7Days: posture?.samples7 ?? 0,
  };
}

/** Promedio de score postural por día local en los últimos N días. */
export async function getPostureAveragesByDay(
  userId: string,
  days = 7
): Promise<Map<string, number | null>> {
  const db = await getDb();
  const since = isoDaysAgo(days - 1);
  const rows = await db.getAllAsync<{ created_at: string; score: number }>(
    'SELECT created_at, score FROM posture_logs WHERE user_id = ? AND created_at >= ? AND score IS NOT NULL',
    [userId, since]
  );

  const byDay = new Map<string, number[]>();
  for (const row of rows) {
    const key = localDayKey(new Date(row.created_at));
    const arr = byDay.get(key) ?? [];
    arr.push(row.score);
    byDay.set(key, arr);
  }

  const result = new Map<string, number | null>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDayKey(d);
    const scores = byDay.get(key);
    if (scores && scores.length > 0) {
      result.set(key, scores.reduce((a, b) => a + b, 0) / scores.length);
    } else {
      result.set(key, null);
    }
  }
  return result;
}

/** Promedio general de score en los últimos N días, o null sin datos. */
export async function getPostureAverage(
  userId: string,
  days = 7
): Promise<number | null> {
  const db = await getDb();
  const since = isoDaysAgo(days - 1);
  const row = await db.getFirstAsync<{ avg: number | null }>(
    'SELECT AVG(score) as avg FROM posture_logs WHERE user_id = ? AND created_at >= ?',
    [userId, since]
  );
  return row?.avg ?? null;
}

/* ---------------- body_discomfort ---------------- */

export async function getDiscomforts(
  userId: string
): Promise<Record<string, BodyPartDiscomfort['severity']>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ part: string; severity: string }>(
    'SELECT part, severity FROM body_discomfort WHERE user_id = ?',
    [userId]
  );
  const map: Record<string, BodyPartDiscomfort['severity']> = {};
  for (const row of rows) {
    map[row.part] = row.severity as BodyPartDiscomfort['severity'];
  }
  return map;
}

export async function setDiscomfort(
  userId: string,
  part: string,
  severity: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO body_discomfort (user_id, part, severity, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, part) DO UPDATE SET severity = excluded.severity, updated_at = excluded.updated_at`,
    [userId, part, severity, now()]
  );
}

/* ---------------- helpers ---------------- */

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
