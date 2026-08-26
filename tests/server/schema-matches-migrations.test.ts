/**
 * `drizzle/schema.ts` and `drizzle/migrations/` describe the same database.
 *
 * WHY THIS IS NOT COVERED BY ANYTHING ELSE. The schema file is the source the code queries
 * through; the migrations are what actually built the table. They are generated FROM the schema,
 * so they agree the moment they are written -- and then they can drift, silently, the first time
 * somebody edits a column and does not run `npm run db:generate`.
 *
 * A positive control found the gap: changing the composite primary key in schema.ts to a single
 * column failed nothing at all. The live table still had the old key, so every test that exercised
 * it passed, and the file the code reads its types from disagreed with the database. In production
 * that is the shape of failure where an insert the types permit is rejected by a constraint
 * nobody can see in the source.
 *
 * `drizzle-kit generate` writes a migration only when there is a diff. Running it into a scratch
 * directory and finding NOTHING NEW is the proof that the two agree.
 */
import { execFileSync } from "node:child_process";
import { cpSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");

/**
 * Generate into a copy of the migration folder and report any file the run added.
 *
 * A copy, not the real directory: a check that leaves a migration behind has changed the thing it
 * was inspecting, and the next run would then agree with itself.
 */
function migrationsAddedBy(schemaRelative: string): string[] {
  /*
   * EVERY PATH HERE IS REPOSITORY-RELATIVE, and that is not tidiness.
   *
   * `drizzle-kit` joins `out` onto the working directory even when it is already absolute --
   * "./" + "/tmp/..." -- so an absolute scratch directory makes it fail with ENOENT. It then
   * exits ZERO, produces no migration, and a check looking for new files reports perfect
   * agreement. The first version of this did exactly that, and the control below is what caught
   * it: the check was passing because the generator never ran.
   *
   * The config is in the repository for a related reason: it is loaded as a module and resolves
   * `drizzle-kit` relative to itself, so one in a temp directory cannot find it.
   */
  const scratch = `.drizzle-drift-${process.pid}`;
  const config = ".drizzle-drift.config.ts";
  try {
    cpSync(resolve(root, "drizzle/migrations"), resolve(root, scratch), { recursive: true });
    const before = new Set(readdirSync(resolve(root, scratch)));
    writeFileSync(
      resolve(root, config),
      `import { defineConfig } from "drizzle-kit";\n` +
        `export default defineConfig({ dialect: "mysql", schema: ${JSON.stringify(schemaRelative)}, out: ${JSON.stringify(scratch)} });\n`,
    );
    const output = execFileSync("npx", ["drizzle-kit", "generate", "--config", config], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    // drizzle-kit exits 0 on some failures, so the output is inspected rather than the exit code.
    expect(output, "the generator reported an error").not.toMatch(/ENOENT|Cannot find module/);
    return readdirSync(resolve(root, scratch)).filter((name) => !before.has(name));
  } finally {
    rmSync(resolve(root, scratch), { recursive: true, force: true });
    rmSync(resolve(root, config), { force: true });
  }
}

describe("the schema the code reads and the migrations that built the database agree", () => {
  it("generates no new migration from the committed schema", () => {
    const added = migrationsAddedBy("./drizzle/schema.ts");
    expect(
      added,
      "schema.ts has changes no migration carries -- run `npm run db:generate` and commit the result",
    ).toEqual([]);
  }, 120_000);

  it("does generate one when the schema really does change", () => {
    /*
     * The control this check cannot do without. A generator that silently produced nothing --
     * wrong path, failed run, swallowed error -- would report perfect agreement forever, which is
     * the exact failure mode this repository keeps finding in its own tests.
     */
    /*
     * The drifted copy sits BESIDE the real schema, not in a temp directory, for the same reason
     * the config does: schema.ts imports `../shared/claim.js` and friends by relative path, and a
     * copy anywhere else resolves none of them. drizzle-kit then produces nothing and the control
     * reports a clean bill -- which is the failure it exists to catch, arriving in the check
     * itself.
     */
    const drifted = resolve(root, "drizzle/.drift-probe.schema.ts");
    try {
      cpSync(resolve(root, "drizzle/schema.ts"), drifted);
      writeFileSync(
        drifted,
        `${readFileSync(drifted, "utf8")}\nexport const driftProbe = mysqlTable("drift_probe", {\n  id: varchar("id", { length: 8 }).primaryKey(),\n});\n`,
      );
      expect(migrationsAddedBy("./drizzle/.drift-probe.schema.ts").length).toBeGreaterThan(0);
    } finally {
      rmSync(drifted, { force: true });
    }
  }, 120_000);
});
