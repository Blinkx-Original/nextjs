import { NextResponse } from 'next/server';
import { fetchRecentLogs } from '@/lib/admin/logs';

export async function GET() {
  const logs = await fetchRecentLogs(10);
  return NextResponse.json({ logs });
}
