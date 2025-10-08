import mysql from 'mysql2/promise';

const globalForMysql = global as unknown as {
  __catalogAdminPool?: mysql.Pool;
};

function getSslConfig() {
  const ca = process.env.TIDB_SSL_CA_PEM;
  if (!ca) {
    return undefined;
  }

  return { ca };
}

function buildConnectionOptions(database?: string) {
  const host = process.env.TIDB_HOST;
  const port = process.env.TIDB_PORT ? Number(process.env.TIDB_PORT) : undefined;
  const user = process.env.TIDB_USER;
  const password = process.env.TIDB_PASSWORD;
  const defaultDb = process.env.TIDB_DATABASE;

  if (!host || !user || !password || !(database ?? defaultDb)) {
    throw new Error('TiDB environment variables are not fully configured.');
  }

  return {
    host,
    port,
    user,
    password,
    database: database ?? defaultDb,
    ssl: getSslConfig(),
  } satisfies mysql.PoolOptions;
}

export function getAdminPool() {
  if (!globalForMysql.__catalogAdminPool) {
    globalForMysql.__catalogAdminPool = mysql.createPool({
      ...buildConnectionOptions(),
      waitForConnections: true,
      connectionLimit: 5,
    });
  }

  return globalForMysql.__catalogAdminPool;
}

export async function createDirectConnection(database?: string) {
  return mysql.createConnection(buildConnectionOptions(database));
}
