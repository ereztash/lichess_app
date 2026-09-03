/**
 * Erase the record from the server, all of it.
 *
 * THE DEPLOYMENT HOLDS ONE PERSON'S RECORD (`shared/tenancy.ts`), so "delete my data" and "delete
 * the data" are the same request, and the answer is this: every row of every record table, `users`
 * untouched because it is the OAuth identity table and the gate reads it. There is no per-decision
 * delete and none is planned; the record is append-only by design (docs/RETENTION.md).
 *
 * Refuses without `--yes`, and without `DATABASE_URL`. Prints the count per table before and after,
 * because "it ran" and "it deleted 214 rows from decisions" are different claims and only the second
 * is checkable. `purgeRecord` is exported so the CI database suite can prove it on a real MySQL.
 *
 *   DATABASE_URL=mysql://... npm run purge -- --yes
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { RECORD_TABLES } from "../shared/tenancy";

type Db = ReturnType<typeof drizzle>;

/** Row count per record table, in the order the registry lists them. */
export async function recordCounts(db: Db): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of RECORD_TABLES) {
    const [rows] = await db.execute(sql.raw(`SELECT COUNT(*) AS n FROM \`${table}\``));
    const first = (rows as unknown as { n: number | string }[])[0];
    counts[table] = Number(first?.n ?? 0);
  }
  return counts;
}

/**
 * Delete every row of every record table. No foreign keys exist in the schema, so order does not
 * matter; the registry's order is used so two runs read the same.
 */
export async function purgeRecord(db: Db): Promise<Record<string, number>> {
  const before = await recordCounts(db);
  for (const table of RECORD_TABLES) {
    await db.execute(sql.raw(`DELETE FROM \`${table}\``));
  }
  return before;
}

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("refusing: this erases every record row. Re-run with --yes if that is what you mean.");
    process.exit(2);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("refusing: DATABASE_URL is not set, so there is no server record to erase.");
    process.exit(2);
  }
  const db = drizzle(url);
  const before = await purgeRecord(db);
  const after = await recordCounts(db);
  for (const table of RECORD_TABLES) {
    console.log(`${table}: ${before[table]} -> ${after[table]}`);
  }
  const left = Object.values(after).reduce((a, b) => a + b, 0);
  if (left > 0) {
    console.error(`${left} rows remain`);
    process.exit(1);
  }
  process.exit(0);
}

if (process.argv[1] && /purge\.ts$/.test(process.argv[1])) {
  void main();
}
