import { createRequire } from "node:module";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { loadServerEnv } from "../env";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");
loadEnvConfig(process.cwd());

const env = loadServerEnv(process.env);
const migrationPool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });

try {
  await migrate(drizzle(migrationPool), { migrationsFolder: "drizzle" });
  console.info(JSON.stringify({ level: "info", event: "database.migrated" }));
} finally {
  await migrationPool.end();
}
