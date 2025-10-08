import type { RowDataPacket } from 'mysql2/promise';
import { getAdminPool } from './mysql';
import type { AdminLogEntry, TestLogLevel, TestLogScope } from './types';

const LOG_TABLE = 'catalog_admin_logs';

type LogRow = RowDataPacket & {
  id: number;
  scope: TestLogScope;
  level: TestLogLevel;
  message: string;
  created_at: Date;
};

async function ensureLogTable() {
  const pool = getAdminPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${LOG_TABLE} (
      id BIGINT PRIMARY KEY AUTO_RANDOM,
      scope VARCHAR(32) NOT NULL,
      level VARCHAR(16) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function recordLog(scope: TestLogScope, level: TestLogLevel, message: string) {
  await ensureLogTable();
  const pool = getAdminPool();
  await pool.query(`INSERT INTO ${LOG_TABLE} (scope, level, message) VALUES (?, ?, ?)`, [
    scope,
    level,
    message,
  ]);
}

export async function fetchRecentLogs(limit = 10): Promise<AdminLogEntry[]> {
  await ensureLogTable();
  const pool = getAdminPool();
  const [rows] = await pool.query<LogRow[]>(
    `SELECT id, scope, level, message, created_at FROM ${LOG_TABLE} ORDER BY created_at DESC, id DESC LIMIT ?`,
    [limit],
  );

  return rows.map((row) => ({
    id: row.id,
    scope: row.scope,
    level: row.level,
    message: row.message,
    createdAt: row.created_at.toISOString(),
  }));
}
