import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/** Drizzle client. The pool is cached on globalThis so Next.js dev HMR does not
 *  leak connections (common pg-in-dev pattern). */
const g = globalThis as unknown as { __pgPool?: Pool } & Record<string, unknown>;

function makePool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example; scripts/pg-start.sh starts the local cluster)");
  return new Pool({ connectionString: url, max: 10 });
}

export const pool = (g.__pgPool ??= makePool());

export const db = drizzle(pool, { schema });
export type Db = typeof db;
