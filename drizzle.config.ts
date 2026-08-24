/**
 * Schema generation only.
 *
 * The repository had `drizzle/schema.ts` and one hand-written migration for the verified-learning
 * tables, and NOTHING that created the base tables -- decisions, reveals, feedback, claims,
 * drills. A deployment with DATABASE_URL set had no way to build the schema the record layer
 * writes into, which is a large part of why nothing had ever executed a statement against MySQL.
 *
 * `npm run db:generate` writes SQL from schema.ts so the two cannot drift by hand.
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
});
