import postgres from "postgres";

/**
 * Local Postgres client for the independent Weaver deployment on Contabo VPS.
 * Connects directly to the local Postgres container (weaver-db) with 245 tables.
 * Falls back to safe mock SQL if DATABASE_URL is not set, preventing crashes.
 */
export function getPostgresUrl(): string | undefined {
  return process.env["DATABASE_URL"] ?? process.env["WEAVER_DB_URL"];
}

let sqlInstance: postgres.Sql | null = null;
let mockSqlInstance: postgres.Sql | null = null;

function createMockSql(): postgres.Sql {
  const mockFn = (async () => []) as unknown as postgres.Sql;
  mockFn.unsafe = async () => [];
  mockFn.end = async () => {};
  return mockFn;
}

export function getSql(): postgres.Sql {
  const url = getPostgresUrl();
  if (!url) {
    console.warn("[Weaver DB] DATABASE_URL not set — using in-memory mock SQL.");
    if (!mockSqlInstance) mockSqlInstance = createMockSql();
    return mockSqlInstance;
  }

  if (!sqlInstance) {
    try {
      sqlInstance = postgres(url, {
        transform: {
          undefined: null,
        },
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      });
    } catch (err) {
      console.error("[Weaver DB] Failed to connect to Postgres, falling back to mock:", err);
      if (!mockSqlInstance) mockSqlInstance = createMockSql();
      return mockSqlInstance;
    }
  }
  return sqlInstance;
}

export async function closeSql(): Promise<void> {
  if (sqlInstance) {
    await sqlInstance.end();
    sqlInstance = null;
  }
}
