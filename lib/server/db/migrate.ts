import { loadEnvConfig } from "@next/env";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { loadServerEnv } from "../env";

loadEnvConfig(process.cwd());

const env = loadServerEnv(process.env);
const migrationPool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });

try {
  await migrate(drizzle(migrationPool), { migrationsFolder: "drizzle" });
  console.info(JSON.stringify({ level: "info", event: "database.migrated" }));
} finally {
  await migrationPool.end();
}
