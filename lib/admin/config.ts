import type { RowDataPacket } from 'mysql2/promise';
import { getAdminPool } from './mysql';
import type { AdminConfig } from './types';

const CONFIG_TABLE = 'catalog_admin_config';

type ConfigKey = 'tidb.database' | 'tidb.tables' | 'algolia.indexName';

const keyMap: Record<ConfigKey, keyof AdminConfig> = {
  'tidb.database': 'tidbDatabase',
  'tidb.tables': 'tidbTables',
  'algolia.indexName': 'algoliaIndexName',
};

const reverseKeyMap = Object.fromEntries(
  Object.entries(keyMap).map(([key, value]) => [value, key as ConfigKey]),
) as Record<keyof AdminConfig, ConfigKey>;

function getDefaultConfig(): AdminConfig {
  return {
    tidbDatabase: process.env.TIDB_DATABASE ?? '',
    tidbTables: '',
    algoliaIndexName: '',
  };
}

async function ensureTable() {
  const pool = getAdminPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${CONFIG_TABLE} (
      k VARCHAR(64) PRIMARY KEY,
      v TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

type ConfigRow = RowDataPacket & { k: ConfigKey; v: string };

export async function getAdminConfig(): Promise<AdminConfig> {
  await ensureTable();
  const pool = getAdminPool();
  const [rows] = await pool.query<ConfigRow[]>(`SELECT k, v FROM ${CONFIG_TABLE}`);

  const config = getDefaultConfig();
  for (const row of rows) {
    const key = keyMap[row.k];
    if (key) {
      config[key] = row.v;
    }
  }

  return config;
}

export async function upsertAdminConfig(values: Partial<AdminConfig>) {
  await ensureTable();
  const pool = getAdminPool();
  const entries = Object.entries(values) as [keyof AdminConfig, string | undefined][];

  for (const [key, value] of entries) {
    if (value === undefined) continue;
    const mappedKey = reverseKeyMap[key];
    await pool.query(
      `INSERT INTO ${CONFIG_TABLE} (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)`,
      [mappedKey, value],
    );
  }

  return getAdminConfig();
}
