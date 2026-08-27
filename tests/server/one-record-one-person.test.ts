/**
 * The product serves one person, and that is a decision rather than an omission.
 *
 * WHAT WAS DECIDED. Every record procedure is behind `ownerProcedure`, which admits exactly the
 * account `OWNER_OPEN_ID` names and refuses every other with a written sentence. No record table
 * carries an owner column, and none is going to: a deployment holds one person's record.
 *
 * WHY IT NEEDS A TEST AND NOT JUST A PARAGRAPH. "Single-tenant by gate" and "single-tenant by
 * schema" are different guarantees and the difference is invisible from the outside. If a table
 * ever gains a `user_id`, the deployment silently becomes one that STORES several people's records
 * while still admitting one -- and every query in `server/record.ts` selects without an owner
 * predicate, so the second person's rows would be served to the first. The failure would not be a
 * missing feature; it would be the cross-account leak this project has already closed twice, let
 * back in through the schema.
 *
 * So the declaration is enforced from both ends. No record table may carry an owner column while
 * the queries have no owner predicate. Adding one is allowed -- but it has to break this file
 * first, which is the point: it makes multi-tenancy a decision somebody takes rather than a
 * property that accumulates.
 *
 * `users` is exempt and must be: it is the OAuth identity table, it is not a record table, and
 * `openId` there is what the gate compares against.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TENANCY, RECORD_TABLES } from "../../shared/tenancy";

const root = resolve(__dirname, "../..");
const schema = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");

/** The `mysqlTable("name", { ... })` body for one table, comments stripped. */
function tableBody(name: string): string {
  const bare = schema.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const start = bare.search(new RegExp(`mysqlTable\\(\\s*"${name}"`));
  if (start < 0) throw new Error(`no table named ${name} in drizzle/schema.ts`);
  const end = bare.indexOf("\n);", start);
  return bare.slice(start, end < 0 ? undefined : end);
}

describe("the declaration is what the schema actually does", () => {
  it("declares one tenant", () => {
    expect(TENANCY).toBe("single");
  });

  it("names every record table that exists, so the check cannot go quiet", () => {
    /*
     * THE VACUITY GUARD. A list that drifted behind the schema would let a new table carry an
     * owner column with nothing to notice -- and a check that silently covers less than it claims
     * is the shape this session has found five times.
     */
    const declared = new Set<string>(RECORD_TABLES);
    /*
     * `\\s*` after the paren is load-bearing. Two tables -- `decisions` and
     * `learning_transfer_observations` -- have their name on the NEXT LINE, and the first version
     * of this regex missed both while `inSchema.length > 10` still passed on the other eleven. A
     * guard that silently covers less than it claims is the exact shape it exists to catch, and it
     * had it.
     */
    const inSchema = [...schema.matchAll(/mysqlTable\(\s*"([a-z_]+)"/g)].map((m) => m[1]);
    expect(inSchema, "the parse missed a table").toContain("decisions");
    expect(inSchema).toContain("learning_transfer_observations");
    expect(inSchema.length).toBeGreaterThanOrEqual(13);
    const unlisted = inSchema.filter((name) => name !== "users" && !declared.has(name));
    expect(unlisted, "a table exists that the tenancy declaration does not cover").toEqual([]);
  });

  it("carries no owner column on any record table", () => {
    /*
     * The enforcement. `server/record.ts` selects without an owner predicate throughout, so a
     * column here would mean rows belonging to two people served to whichever one holds the gate.
     */
    const offenders = RECORD_TABLES.filter((name) =>
      /\b(user_?id|userId|owner_?id|ownerId|open_?id|openId|tenant)\b/i.test(tableBody(name)),
    );
    expect(
      offenders,
      "a record table gained an owner column while the queries have no owner predicate",
    ).toEqual([]);
  });

  it("leaves the identity table alone, which is a different thing", () => {
    // `users` holds the OAuth identity the gate compares against. It is not part of the record.
    expect(RECORD_TABLES).not.toContain("users");
    expect(tableBody("users")).toMatch(/openId/);
  });
});

describe("the gate is the whole mechanism, and it is not partial", () => {
  it("puts every record procedure behind the owner gate", () => {
    /*
     * Asserted over the router source because the failure mode is a procedure that uses
     * `protectedProcedure` instead -- which asks "is somebody signed in", a different question,
     * and is exactly how the leak in `afca034` happened. A single `protectedProcedure` in this
     * file would be that again.
     */
    const router = readFileSync(resolve(root, "server/recordRouter.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const procedures = [...router.matchAll(/(\w+Procedure)\b/g)].map((m) => m[1]);
    expect(procedures.length, "the parse found no procedures at all").toBeGreaterThan(10);
    expect(new Set(procedures.filter((p) => p !== "ownerProcedure"))).toEqual(new Set());
  });
});
