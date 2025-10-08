import algoliasearch from 'algoliasearch';
import { performance } from 'perf_hooks';
import { createDirectConnection } from './mysql';
import { recordLog } from './logs';
import type {
  AdminConfig,
  AlgoliaTestResult,
  TestLogLevel,
  TidbTableCheck,
  TidbTestResult,
} from './types';

function normalizeTables(input: string): string[] {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function runTidbTest(
  config: Pick<AdminConfig, 'tidbDatabase' | 'tidbTables'>,
  { log = true }: { log?: boolean } = {},
): Promise<TidbTestResult> {
  const start = performance.now();
  let connection: Awaited<ReturnType<typeof createDirectConnection>> | null = null;

  try {
    connection = await createDirectConnection(config.tidbDatabase || undefined);

    await connection.query('SELECT 1');
    const tables: TidbTableCheck[] = [];
    const tableNames = normalizeTables(config.tidbTables);

    for (const name of tableNames) {
      try {
        const [rows] = await connection.query<{ c: number }[]>(
          `SELECT COUNT(*) as c FROM \`${name}\``,
        );
        const row = rows[0];
        tables.push({
          name,
          exists: true,
          rowCount: typeof row?.c === 'number' ? Number(row.c) : undefined,
        });
      } catch (error) {
        const err = error as { message?: string };
        tables.push({
          name,
          exists: false,
          message: err?.message,
        });
      }
    }

    const allTablesPresent = tables.every((table) => table.exists);

    const result: TidbTestResult = {
      ok: allTablesPresent,
      db: config.tidbDatabase || '',
      tables,
      durationMs: Math.round(performance.now() - start),
    };

    if (log) {
      const summaryTables =
        tables.length > 0
          ? tables
              .map((table) => `${table.name}:${table.exists ? 'ok' : 'missing'}`)
              .join(', ')
          : 'no tables provided';
      const statusLabel = result.ok ? 'TiDB OK' : 'TiDB issues';
      await recordLog(
        'tidb',
        result.ok ? 'info' : 'error',
        `${statusLabel} in ${result.durationMs}ms (${summaryTables})`,
      );
    }

    return result;
  } catch (error) {
    const err = error as { code?: string; message?: string };
    const result: TidbTestResult = {
      ok: false,
      db: config.tidbDatabase || '',
      tables: [],
      durationMs: Math.round(performance.now() - start),
      error: {
        code: err?.code,
        message: err?.message ?? 'Unknown TiDB error',
      },
    };

    if (log) {
      await recordLog('tidb', 'error', `TiDB error: ${result.error?.message ?? 'Unknown error'}`);
    }

    return result;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function runAlgoliaTest(
  config: Pick<AdminConfig, 'algoliaIndexName'>,
  { log = true }: { log?: boolean } = {},
): Promise<AlgoliaTestResult> {
  const appId = process.env.ALGOLIA_APP_ID;
  const apiKey = process.env.ALGOLIA_ADMIN_API_KEY;

  if (!appId || !apiKey) {
    const errorResult: AlgoliaTestResult = {
      ok: false,
      indexName: config.algoliaIndexName,
      error: {
        message: 'Algolia credentials are not configured.',
      },
    };

    if (log) {
      await recordLog('algolia', 'error', errorResult.error!.message);
    }

    return errorResult;
  }

  const client = algoliasearch(appId, apiKey);
  const indexName = config.algoliaIndexName;

  try {
    const index = client.initIndex(indexName);
    await index.getSettings();
    await client.searchSingleIndex({
      indexName,
      searchParams: { query: '', hitsPerPage: 0 },
    });

    const result: AlgoliaTestResult = {
      ok: true,
      indexName,
      hasSettings: true,
    };

    if (log) {
      await recordLog('algolia', 'info', `Algolia index \`${indexName}\` reachable.`);
    }

    return result;
  } catch (error) {
    const err = error as { name?: string; message?: string };
    const result: AlgoliaTestResult = {
      ok: false,
      indexName,
      error: {
        code: err?.name,
        message: err?.message ?? 'Unknown Algolia error',
      },
    };

    if (log) {
      await recordLog(
        'algolia',
        'error',
        `Algolia error for \`${indexName}\`: ${result.error?.message ?? 'Unknown error'}`,
      );
    }

    return result;
  }
}

export async function runAllTests(config: AdminConfig) {
  const tidb = await runTidbTest(
    { tidbDatabase: config.tidbDatabase, tidbTables: config.tidbTables },
    { log: false },
  );
  const algolia = await runAlgoliaTest({ algoliaIndexName: config.algoliaIndexName }, { log: false });

  const overallOk = tidb.ok && algolia.ok;
  const level: TestLogLevel = overallOk ? 'info' : algolia.ok || tidb.ok ? 'warn' : 'error';
  const summaryParts = [
    `TiDB: ${tidb.ok ? 'ok' : tidb.error?.message ?? 'error'}`,
    `Algolia: ${algolia.ok ? 'ok' : algolia.error?.message ?? 'error'}`,
  ];

  await recordLog('all', level, `All tests → ${summaryParts.join(' | ')}`);

  return { tidb, algolia };
}
