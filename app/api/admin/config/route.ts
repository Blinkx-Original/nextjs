import { NextResponse } from 'next/server';
import { getAdminConfig, upsertAdminConfig } from '@/lib/admin/config';
import type { AdminConfig } from '@/lib/admin/types';

export async function GET() {
  const config = await getAdminConfig();
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Partial<AdminConfig> = {};

  if (typeof payload.tidbDatabase === 'string') {
    updates.tidbDatabase = payload.tidbDatabase;
  }

  if (typeof payload.tidbTables === 'string') {
    updates.tidbTables = payload.tidbTables;
  }

  if (typeof payload.algoliaIndexName === 'string') {
    updates.algoliaIndexName = payload.algoliaIndexName;
  }

  const nextConfig = await upsertAdminConfig(updates);

  return NextResponse.json(nextConfig);
}
