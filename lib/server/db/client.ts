import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getServerEnv } from "../env";
import * as schema from "./schema";

const globalDatabase = globalThis as typeof globalThis & {
  aunoPool?: Pool;
};

export const pool =
  globalDatabase.aunoPool ??
  new Pool({
    connectionString: getServerEnv().DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") globalDatabase.aunoPool = pool;

export const db = drizzle(pool, { schema });
