import { NextResponse } from 'next/server';
import { getAdminConfig } from '@/lib/admin/config';
import { runTidbTest } from '@/lib/admin/tests';
import type { AdminConfig } from '@/lib/admin/types';

function parsePayload(payload: Record<string, unknown>, base: AdminConfig) {
  return {
    tidbDatabase:
      typeof payload.tidbDatabase === 'string' && payload.tidbDatabase.trim()
        ? payload.tidbDatabase
        : base.tidbDatabase,
    tidbTables:
      typeof payload.tidbTables === 'string' ? payload.tidbTables : base.tidbTables,
  } satisfies Pick<AdminConfig, 'tidbDatabase' | 'tidbTables'>;
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const baseConfig = await getAdminConfig();
  const config = parsePayload(payload, baseConfig);

  const result = await runTidbTest(config);
  return NextResponse.json(result);
}
