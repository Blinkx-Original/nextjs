import { getAdminConfig } from '@/lib/admin/config';
import { fetchRecentLogs } from '@/lib/admin/logs';
import type { AdminConfig, AdminLogEntry } from '@/lib/admin/types';
import { AdminDashboard } from '@/components/admin/admin-dashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  let config: AdminConfig;
  let logs: AdminLogEntry[];

  try {
    config = await getAdminConfig();
  } catch (error) {
    console.error('Failed to load admin config', error);
    config = {
      tidbDatabase: process.env.TIDB_DATABASE ?? '',
      tidbTables: '',
      algoliaIndexName: '',
    };
  }

  try {
    logs = await fetchRecentLogs(10);
  } catch (error) {
    console.error('Failed to load admin logs', error);
    logs = [];
  }

  return <AdminDashboard initialConfig={config} initialLogs={logs} />;
}
