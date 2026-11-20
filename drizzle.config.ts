import { defineConfig } from "drizzle-kit";

// User-space Postgres cluster (scripts/pg-start.sh), non-default port 5433.
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://safar@127.0.0.1:5433/safar" },
  verbose: true,
});
