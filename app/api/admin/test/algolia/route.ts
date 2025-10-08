import { NextResponse } from 'next/server';
import { getAdminConfig } from '@/lib/admin/config';
import { runAlgoliaTest } from '@/lib/admin/tests';
import type { AdminConfig } from '@/lib/admin/types';

function parsePayload(payload: Record<string, unknown>, base: AdminConfig) {
  return {
    algoliaIndexName:
      typeof payload.algoliaIndexName === 'string' && payload.algoliaIndexName.trim()
        ? payload.algoliaIndexName
        : base.algoliaIndexName,
  } satisfies Pick<AdminConfig, 'algoliaIndexName'>;
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const baseConfig = await getAdminConfig();
  const config = parsePayload(payload, baseConfig);
  const result = await runAlgoliaTest(config);

  return NextResponse.json(result);
}
