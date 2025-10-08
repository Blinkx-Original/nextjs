import { NextResponse } from 'next/server';
import { getAdminConfig } from '@/lib/admin/config';
import { runAllTests } from '@/lib/admin/tests';
import type { AdminConfig } from '@/lib/admin/types';

function mergeConfig(payload: Record<string, unknown>, base: AdminConfig): AdminConfig {
  return {
    tidbDatabase:
      typeof payload.tidbDatabase === 'string' && payload.tidbDatabase.trim()
        ? payload.tidbDatabase
        : base.tidbDatabase,
    tidbTables:
      typeof payload.tidbTables === 'string' ? payload.tidbTables : base.tidbTables,
    algoliaIndexName:
      typeof payload.algoliaIndexName === 'string' && payload.algoliaIndexName.trim()
        ? payload.algoliaIndexName
        : base.algoliaIndexName,
  };
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const baseConfig = await getAdminConfig();
  const config = mergeConfig(payload, baseConfig);
  const result = await runAllTests(config);

  return NextResponse.json(result);
}
