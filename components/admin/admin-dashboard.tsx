'use client';

import { useMemo, useState } from 'react';
import type {
  AdminConfig,
  AdminLogEntry,
  AlgoliaTestResult,
  TidbTestResult,
} from '@/lib/admin/types';

type StatusState = 'idle' | 'loading' | 'success' | 'error';

type Props = {
  initialConfig: AdminConfig;
  initialLogs: AdminLogEntry[];
};

const levelStyles: Record<'info' | 'warn' | 'error', string> = {
  info: 'text-neutral-600',
  warn: 'text-amber-600',
  error: 'text-red-600',
};

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });

  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

async function putConfig(config: Partial<AdminConfig>) {
  const response = await fetch('/api/admin/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error('Failed to save configuration.');
  }

  return (await response.json()) as AdminConfig;
}

async function loadLogs() {
  const response = await fetch('/api/admin/logs');
  if (!response.ok) {
    throw new Error('Failed to fetch logs');
  }
  const payload = (await response.json()) as { logs: AdminLogEntry[] };
  return payload.logs;
}

export function AdminDashboard({ initialConfig, initialLogs }: Props) {
  const [config, setConfig] = useState<AdminConfig>(initialConfig);
  const [logs, setLogs] = useState<AdminLogEntry[]>(initialLogs);

  const [tidbStatus, setTidbStatus] = useState<StatusState>('idle');
  const [tidbMessage, setTidbMessage] = useState<string | null>(null);
  const [tidbResult, setTidbResult] = useState<TidbTestResult | null>(null);

  const [algoliaStatus, setAlgoliaStatus] = useState<StatusState>('idle');
  const [algoliaMessage, setAlgoliaMessage] = useState<string | null>(null);
  const [algoliaResult, setAlgoliaResult] = useState<AlgoliaTestResult | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  const summaryText = useMemo(() => {
    if (tidbStatus === 'idle' && algoliaStatus === 'idle') return 'Tests idle';
    const segments: string[] = [];
    if (tidbResult) {
      segments.push(`TiDB ${tidbResult.ok ? 'ok' : 'error'}`);
    }
    if (algoliaResult) {
      segments.push(`Algolia ${algoliaResult.ok ? 'ok' : 'error'}`);
    }
    return segments.join(' · ');
  }, [tidbResult, algoliaResult, tidbStatus, algoliaStatus]);

  const refreshLogs = async () => {
    try {
      const freshLogs = await loadLogs();
      setLogs(freshLogs);
    } catch (error) {
      console.error(error);
    }
  };

  const syncConfig = async (nextConfig: Partial<AdminConfig>) => {
    setIsSaving(true);
    try {
      const saved = await putConfig(nextConfig);
      setConfig(saved);
      return saved;
    } finally {
      setIsSaving(false);
    }
  };

  const handleTidbTest = async () => {
    setTidbStatus('loading');
    setTidbMessage(null);
    try {
      const saved = await syncConfig({
        tidbDatabase: config.tidbDatabase,
        tidbTables: config.tidbTables,
      });

      const result = await postJson<TidbTestResult>('/api/admin/test/tidb', {
        tidbDatabase: saved.tidbDatabase,
        tidbTables: saved.tidbTables,
      });

      setTidbResult(result);
      setTidbStatus(result.ok ? 'success' : 'error');
      setTidbMessage(
        result.ok
          ? `Connected to ${result.db} in ${result.durationMs}ms.`
          : result.error?.message ?? 'Connection failed.',
      );
    } catch (error) {
      console.error(error);
      setTidbStatus('error');
      setTidbMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      await refreshLogs();
    }
  };

  const handleAlgoliaTest = async () => {
    setAlgoliaStatus('loading');
    setAlgoliaMessage(null);
    try {
      const saved = await syncConfig({
        algoliaIndexName: config.algoliaIndexName,
      });

      const result = await postJson<AlgoliaTestResult>('/api/admin/test/algolia', {
        algoliaIndexName: saved.algoliaIndexName,
      });

      setAlgoliaResult(result);
      setAlgoliaStatus(result.ok ? 'success' : 'error');
      setAlgoliaMessage(
        result.ok
          ? `Index \`${result.indexName}\` responded successfully.`
          : result.error?.message ?? 'Algolia connection failed.',
      );
    } catch (error) {
      console.error(error);
      setAlgoliaStatus('error');
      setAlgoliaMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      await refreshLogs();
    }
  };

  const handleRunAll = async () => {
    setTidbStatus('loading');
    setAlgoliaStatus('loading');
    setTidbMessage(null);
    setAlgoliaMessage(null);
    try {
      const saved = await syncConfig(config);
      const result = await postJson<{ tidb: TidbTestResult; algolia: AlgoliaTestResult }>(
        '/api/admin/test/all',
        saved,
      );

      setTidbResult(result.tidb);
      setAlgoliaResult(result.algolia);

      setTidbStatus(result.tidb.ok ? 'success' : 'error');
      setAlgoliaStatus(result.algolia.ok ? 'success' : 'error');

      setTidbMessage(
        result.tidb.ok
          ? `Connected to ${result.tidb.db} in ${result.tidb.durationMs}ms.`
          : result.tidb.error?.message ?? 'Connection failed.',
      );
      setAlgoliaMessage(
        result.algolia.ok
          ? `Index \`${result.algolia.indexName}\` responded successfully.`
          : result.algolia.error?.message ?? 'Algolia connection failed.',
      );
    } catch (error) {
      console.error(error);
      setTidbStatus('error');
      setAlgoliaStatus('error');
      const message = error instanceof Error ? error.message : 'Unknown error';
      setTidbMessage(message);
      setAlgoliaMessage(message);
    } finally {
      await refreshLogs();
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.35em] text-neutral-400">Admin</p>
        <h1 className="text-4xl font-semibold text-neutral-900">Connectivity Dashboard</h1>
        <p className="max-w-2xl text-sm text-neutral-500">
          Tools for keeping the catalog humming. Run quick checks to make sure TiDB and
          Algolia are reachable before diving into deeper debugging.
        </p>
      </header>

      <section className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-500">
              Access
            </h2>
            <p className="mt-2 text-lg font-medium text-neutral-900">Signed in as Admin.</p>
            <p className="text-sm text-neutral-500">{summaryText}</p>
          </div>
          <a
            href="/logout"
            className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
          >
            Log out
          </a>
        </div>
      </section>

      <section className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Access Connections</h2>
            <p className="text-sm text-neutral-500">Run these when something looks off.</p>
          </div>
          <button
            type="button"
            onClick={handleRunAll}
            className="self-start rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={tidbStatus === 'loading' || algoliaStatus === 'loading' || isSaving}
          >
            Run all tests
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-neutral-900">TiDB</h3>
                <p className="text-sm text-neutral-500">Primary catalog database.</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <label className="text-sm font-medium text-neutral-700">
                Database
                <input
                  type="text"
                  value={config.tidbDatabase}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, tidbDatabase: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 shadow-inner focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                  placeholder="catalog_db"
                />
              </label>
              <label className="text-sm font-medium text-neutral-700">
                Tables
                <input
                  type="text"
                  value={config.tidbTables}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, tidbTables: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 shadow-inner focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                  placeholder="products, categories"
                />
              </label>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleTidbTest}
                className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={tidbStatus === 'loading' || isSaving}
              >
                {tidbStatus === 'loading' ? 'Testing TiDB…' : 'Test TiDB Connection'}
              </button>
              {tidbMessage && (
                <p
                  className={`text-sm ${
                    tidbStatus === 'success' ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {tidbMessage}
                </p>
              )}
              {tidbResult?.tables?.length ? (
                <ul className="mt-2 space-y-1 rounded-xl bg-white p-3 text-xs text-neutral-600">
                  {tidbResult.tables.map((table) => (
                    <li key={table.name} className="flex items-center justify-between">
                      <span className="font-medium text-neutral-700">{table.name}</span>
                      <span className={table.exists ? 'text-emerald-600' : 'text-red-600'}>
                        {table.exists ? `${table.rowCount ?? 0} rows` : 'missing'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-neutral-900">Algolia</h3>
                <p className="text-sm text-neutral-500">Search index for the storefront.</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <label className="text-sm font-medium text-neutral-700">
                Index Name
                <input
                  type="text"
                  value={config.algoliaIndexName}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, algoliaIndexName: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 shadow-inner focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                  placeholder="catalog_index"
                />
              </label>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleAlgoliaTest}
                className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={algoliaStatus === 'loading' || isSaving}
              >
                {algoliaStatus === 'loading' ? 'Testing Algolia…' : 'Test Algolia Connection'}
              </button>
              {algoliaMessage && (
                <p
                  className={`text-sm ${
                    algoliaStatus === 'success' ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {algoliaMessage}
                </p>
              )}
            </div>

            <div className="hidden">
              <div className="mt-4 rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-400">
                Typesense block coming soon.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Recent results</h2>
          <span className="text-xs uppercase tracking-[0.25em] text-neutral-400">
            Showing last 10
          </span>
        </div>
        <div className="space-y-3">
          {logs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
              No test activity yet. Trigger a check to see history here.
            </p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col gap-1 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    {log.scope}
                  </span>
                  <span className={`text-sm font-medium ${levelStyles[log.level] ?? 'text-neutral-600'}`}>
                    {log.level}
                  </span>
                </div>
                <div className="flex flex-col gap-1 text-sm text-neutral-600 sm:flex-row sm:items-center sm:gap-3">
                  <span>{log.message}</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-neutral-400">
                    {formatTimestamp(log.createdAt)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
