export type TestLogScope = 'tidb' | 'algolia' | 'all';
export type TestLogLevel = 'info' | 'warn' | 'error';

export type TidbTableCheck = {
  name: string;
  exists: boolean;
  rowCount?: number;
  message?: string;
};

export type TidbTestResult = {
  ok: boolean;
  db: string;
  tables: TidbTableCheck[];
  durationMs: number;
  error?: {
    code?: string;
    message: string;
  };
};

export type AlgoliaTestResult = {
  ok: boolean;
  indexName: string;
  hasSettings?: boolean;
  error?: {
    code?: string;
    message: string;
  };
};

export type AdminConfig = {
  tidbDatabase: string;
  tidbTables: string;
  algoliaIndexName: string;
};

export type AdminLogEntry = {
  id: number;
  scope: TestLogScope;
  level: TestLogLevel;
  message: string;
  createdAt: string;
};
