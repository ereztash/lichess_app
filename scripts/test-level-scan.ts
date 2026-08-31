/**
 * How much reality each test runs against, and where the ladder has a rung missing.
 *
 * WHY THIS EXISTS. This repository has 246 test files and shipped five defects in one wave that
 * every one of them was green through. None of the five was a wrong test. Each was a test that
 * looked at a faithful shadow of the thing and was read as evidence about the thing:
 *
 *   1. Every blitz think time was a fractional millisecond and the schema wanted an integer, so no
 *      game was ever stored in a browser. Three layers were green: the shared suites used
 *      hand-built integer fixtures, every jsdom suite mocks `performance.now()` to whole
 *      milliseconds, and the browser audit asserted a CARD the screen drew from its own copy.
 *   2. The self-check reported "a Worker can be created" on a browser that had just refused one,
 *      because a CSP-refused worker does not throw -- it errors asynchronously with an empty
 *      message, and a `try`/`catch` sees success.
 *   3. `saveClaim` wrote two of the three fields the fold changes, so no claim on MySQL ever
 *      recorded which protocol graded it. Every test but the database ones runs against
 *      `MemoryRecordStore`, which replaces the whole row.
 *   4. Two gates were red on CI and green everywhere else, because vitest colours its summary when
 *      `CI` is set and the matcher was written against a pipe's plain text.
 *   5. The commit button said "חסר: בחרו מהלך על הלוח" while wearing a TICK. Every assertion about
 *      that button read `textContent`, which is blind to an icon.
 *
 * ONE SHAPE, FIVE TIMES: the test's fidelity was lower than the claim it was read as supporting.
 * Not "the test is wrong" -- the test is right about what it looks at.
 *
 * SO THE HIERARCHY IS A LADDER OF REALITY, and the parent/child relation is the useful one: a test
 * at a higher rung can fail where its parent passes, and every defect above lived in a gap where
 * the higher rung did not exist. Reading the ladder for a claim answers "where would this fall?"
 * before it falls.
 *
 * THE LEVEL IS DERIVED, NOT DECLARED, and that is deliberate. A declaration is a comment: it can
 * be wrong on the day it is written and stays wrong forever. What a file imports and what
 * environment it asks for are facts, and they are what decide its rung. A file may override with
 * `@level Ln because <reason>` -- the reason is required, so an override is an argument rather than
 * a number.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

export const LEVELS = [
  {
    id: "L1",
    name: "pure",
    runs: "one function, inputs built by hand",
    proves: "the algebra",
    blind: "whether those inputs ever occur",
  },
  {
    id: "L2",
    name: "contract",
    runs: "several shared modules and their schemas, together",
    proves: "that the pieces agree about shapes and rules",
    blind: "what a runtime actually produces",
  },
  {
    id: "L3",
    name: "render",
    runs: "components in jsdom",
    proves: "the DOM exists and its text says the right thing",
    blind: "layout, geometry, icons as meaning, anything a browser refuses",
  },
  {
    id: "L4",
    name: "store",
    runs: "the real store, against MySQL",
    proves: "what SQL actually writes and reads back",
    blind: "the client, and anything above the boundary",
  },
  {
    id: "L5",
    name: "browser",
    runs: "Chromium over the built assets",
    proves: "layout, policy, workers, geometry, the bundle as shipped",
    blind: "whatever the edge does to a response",
  },
  {
    id: "L6",
    name: "deployment",
    runs: "the deployed origin",
    proves: "headers, MIME types and CSP as actually served",
    blind: "nothing this repository can name",
  },
] as const;

export type LevelId = (typeof LEVELS)[number]["id"];

export interface TestFile {
  file: string;
  level: LevelId;
  /** What put it on that rung. A level with no evidence behind it is a guess. */
  because: string;
  /** True when the file overrode its derived level, which requires a stated reason. */
  overridden: boolean;
}

function walk(root: string, out: string[] = []): string[] {
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "fixtures" || entry === "node_modules") continue;
      walk(full, out);
    } else if (/\.test\.tsx?$/.test(full) && [".ts", ".tsx"].includes(extname(full))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * The rung a file's own contents put it on.
 *
 * ORDERED HIGH TO LOW, because the highest rung a file reaches is what it is: a browser test that
 * also calls a pure function is a browser test, and calling it L1 would credit it with less reality
 * than it has.
 */
function derive(source: string): { level: LevelId; because: string } {
  if (/SCAN_BASE|DEPLOY(ED)?_(BASE|ORIGIN)|_vercel_share/.test(source)) {
    return { level: "L6", because: "drives a deployed origin" };
  }
  /*
   * `launchChromium` IS THE TELL HERE, and missing it made this scan report zero browser tests
   * while eleven of them existed. `tests/layout/browser.ts` owns the launch -- one place to point
   * at the container's Chromium -- so no test file names playwright directly, and a pattern that
   * looked for `chromium.launch` saw none of them. A derivation that cannot see the repository's
   * own idiom reports a comfortable number instead of the true one, which is the failure this
   * whole file is about.
   */
  if (/from "playwright"|@playwright\/test|launchChromium|chromium\.launch/.test(source)) {
    return { level: "L5", because: "launches Chromium over the built assets" };
  }
  if (/DATABASE_URL|DrizzleRecordStore|drizzle\(/.test(source)) {
    return { level: "L4", because: "runs against the real store" };
  }
  if (/@vitest-environment jsdom/.test(source)) {
    return { level: "L3", because: "renders in jsdom" };
  }
  /*
   * L2 IS "MORE THAN ONE MODULE", not "imports something". A file that pulls in one shared module
   * and calls one of its functions is testing that function; the contract only comes into view when
   * two or more have to agree.
   */
  const shared = new Set(
    [...source.matchAll(/from "(?:@shared|\.\.\/\.\.\/shared|\.\.\/\.\.\/server)\/([a-z0-9-]+)/g)].map(
      (m) => m[1],
    ),
  );
  if (shared.size >= 2) {
    return { level: "L2", because: `${shared.size} shared modules, held against each other` };
  }
  return { level: "L1", because: "one module, inputs built by hand" };
}

const OVERRIDE = /@level\s+(L[1-6])\s+because\s+(\S.*)/;

/**
 * The file's opening docblock, which is the only place a level may be declared.
 *
 * A MENTION IS NOT A DECLARATION, and this gate fired on exactly that: its own comment explaining
 * what a bare `@level` looks like was read as one. Scanning the whole file cannot tell a rule from
 * a note about the rule, and a check that cannot is one people work around by not writing the note.
 * Pinning the declaration to the header also settles where a reader looks for it.
 */
function header(source: string): string {
  const start = source.indexOf("/**");
  if (start === -1) return "";
  const end = source.indexOf("*/", start);
  return end === -1 ? "" : source.slice(start, end + 2);
}

export function scanTests(root: string): TestFile[] {
  const base = join(root, "tests");
  return walk(base)
    .sort()
    .map((full) => {
      const source = readFileSync(full, "utf8");
      const stated = OVERRIDE.exec(header(source));
      const derived = derive(source);
      return stated
        ? {
            file: relative(root, full),
            level: stated[1] as LevelId,
            because: stated[2].replace(/\s*\*\/\s*$/, "").trim(),
            overridden: true,
          }
        : { file: relative(root, full), level: derived.level, because: derived.because, overridden: false };
    });
}

/** A `@level` tag with no `because` is a number pretending to be an argument. */
export function findUnreasonedOverrides(root: string): { file: string; line: number }[] {
  const base = join(root, "tests");
  const out: { file: string; line: number }[] = [];
  for (const full of walk(base)) {
    const source = readFileSync(full, "utf8");
    const head = header(source);
    if (!head) continue;
    const offset = source.indexOf(head);
    head.split("\n").forEach((line, i) => {
      if (/@level\s+L[1-6]/.test(line) && !OVERRIDE.test(line)) {
        out.push({
          file: relative(root, full),
          line: source.slice(0, offset).split("\n").length + i,
        });
      }
    });
  }
  return out;
}

export function census(files: TestFile[]): Record<LevelId, number> {
  const counts = Object.fromEntries(LEVELS.map((l) => [l.id, 0])) as Record<LevelId, number>;
  for (const f of files) counts[f.level] += 1;
  return counts;
}

/**
 * The rung each debt row's gate actually stands on.
 *
 * THIS IS THE REPORT THE LADDER EXISTS FOR. A row's severity says how bad the defect was; the level
 * of the test its `**Gate:**` names says how much reality the proof ran against. When the second is
 * far below the first, the row is a claim about the product resting on evidence about the code --
 * which is what every miss in this file's opening list turned out to be.
 *
 * It names a gap; it does not decide what to do about one. Some gaps are correct: a claim about a
 * pure fold belongs at L1 and would learn nothing from a browser. The point is that the gap is
 * VISIBLE rather than assumed away.
 */
export interface ClaimAnchor {
  id: string;
  severity: string;
  title: string;
  gates: { file: string; level: LevelId }[];
  /** The highest rung any of its gates reaches, or null when the row names no test. */
  anchor: LevelId | null;
}

const SEVERITY_EXPECTS: Record<string, LevelId> = {
  /*
   * WHAT A SEVERITY IMPLIES ABOUT REALITY, and it is a floor rather than a target.
   *
   * A P0 here is always "a record can be lost or made wrong" -- a claim about what survives a real
   * runtime, so its proof has to have met one. P1 is "the record cannot be trusted to mean what it
   * says", which is a claim about a contract between modules and is provable at L2. P2 rows are
   * governed rather than urgent and carry no floor.
   */
  P0: "L4",
  P1: "L2",
};

/**
 * The rung a registered gate stands on.
 *
 * A `**Gate:**` LINE MAY NAME A GATE RATHER THAN A FILE, and the first version of this resolver
 * could not read one -- so R-01, whose gate is `GATE-REGISTER-RECONCILED` and which runs over the
 * real documents on every build, was reported as having no evidence at all. A measurement that
 * cannot see a working check reports a gap that is not there, which is the same class of error as
 * the misses this whole file is about, pointed at itself.
 *
 * A gate that delegates to a vitest file inherits that file's rung. A gate that scans source or
 * documents is L2: it holds artefacts against each other, which is exactly what L2 means, and no
 * scan of a file has met a runtime.
 */
function gateLevels(root: string, files: TestFile[]): Map<string, LevelId> {
  const runner = readFileSync(join(root, "scripts/run_gates.ts"), "utf8");
  const levelOf = new Map(files.map((f) => [f.file, f.level]));
  const out = new Map<string, LevelId>();
  for (const block of runner.split(/\n  \{\n/).slice(1)) {
    const id = /\bid:\s*"(GATE-[A-Z0-9-]+)"/.exec(block)?.[1];
    if (!id) continue;
    const run = block.split("positiveControl")[0];
    const delegated = /runVitestFile\(\s*"([^"]+)"/.exec(run)?.[1];
    out.set(id, delegated ? (levelOf.get(delegated) ?? "L2") : "L2");
  }
  return out;
}

export function claimAnchors(root: string, files: TestFile[]): ClaimAnchor[] {
  const debt = readFileSync(join(root, "docs/MASTER_PRODUCT_DEBT.md"), "utf8");
  const levelOf = new Map(files.map((f) => [f.file.split("/").pop()!, f.level]));
  const gates = gateLevels(root, files);
  const out: ClaimAnchor[] = [];

  const sections = debt.split(/^### (R-\d+) · /m);
  for (let i = 1; i < sections.length; i += 2) {
    const id = sections[i];
    const body = sections[i + 1] ?? "";
    const title = body.split("\n")[0].slice(0, 46);
    const severity = /\| severity \| \*?\*?(P\d)/.exec(body)?.[1] ?? "-";
    const named = new Set(
      [...body.matchAll(/`([A-Za-z0-9_./-]*[a-z0-9-]+\.test\.tsx?)`/g)].map((m) =>
        m[1].split("/").pop()!,
      ),
    );
    const namedGates = [...body.matchAll(/`(GATE-[A-Z0-9-]+)`/g)].map((m) => m[1]);
    const evidence = [
      ...[...named]
        .filter((base) => levelOf.has(base))
        .map((base) => ({ file: base, level: levelOf.get(base)! })),
      ...namedGates
        .filter((id) => gates.has(id))
        .map((id) => ({ file: id, level: gates.get(id)! })),
    ];
    const anchor = evidence.length ? evidence.map((g) => g.level).sort().at(-1)! : null;
    out.push({ id, severity, title, gates: evidence, anchor });
  }
  return out;
}

/**
 * The number of under-anchored rows this build is allowed to have.
 *
 * SEVEN WHEN THIS WAS WRITTEN, AND ZERO NOW, which is what a ratchet is for. It started as a
 * ratchet rather than a bar because a gate red on the day it is added -- with seven pieces of
 * unplanned work between it and green -- gets deleted rather than met.
 *
 * WHAT THE SEVEN TURNED OUT TO BE, because the difference matters:
 *
 *   TWO were this scanner's fault. R-01's gate is `GATE-REGISTER-RECONCILED` and R-09's is
 *   `GATE-ENGINE-FAILURE-DISTINCT`; both run on every build, and the resolver could only read
 *   `*.test.ts` filenames. A measurement that cannot see a working check reports a gap that is not
 *   there -- the same class of error as the misses this file is about, pointed at itself.
 *
 *   FIVE WERE REAL. The four P0 rows -- every row saying a record can be lost or made wrong -- are
 *   now proven in a real browser, reading the record out of `localStorage` rather than off the
 *   screen. R-20, a MySQL-only defect, is proven against a real database.
 *
 * AT ZERO IT IS A BAR, and that is the point of having reached it: the next P0 row proven only in
 * jsdom fails immediately, with nothing to argue about.
 */
export const UNDER_ANCHORED_CEILING = 0;

/** Rows whose severity implies more reality than their gate ever ran against. */
export function findUnderAnchoredClaims(anchors: ClaimAnchor[]): ClaimAnchor[] {
  return anchors.filter((a) => {
    const floor = SEVERITY_EXPECTS[a.severity];
    if (!floor) return false;
    if (a.anchor === null) return true;
    return a.anchor < floor;
  });
}

if (process.argv[1]?.endsWith("test-level-scan.ts")) {
  const root = process.cwd();
  const files = scanTests(root);
  const counts = census(files);
  const total = files.length;

  console.log("\nHow much reality each test runs against");
  console.log("=======================================\n");
  for (const level of LEVELS) {
    const n = counts[level.id];
    const bar = "#".repeat(Math.round((n / total) * 60));
    console.log(
      `${level.id} ${level.name.padEnd(11)} ${String(n).padStart(4)}  ${((n / total) * 100).toFixed(1).padStart(5)}%  ${bar}`,
    );
    console.log(`   runs against: ${level.runs}`);
    console.log(`   blind to:     ${level.blind}\n`);
  }
  console.log(`${total} test files.\n`);

  const high = counts.L4 + counts.L5 + counts.L6;
  console.log(
    `${high} of ${total} (${((high / total) * 100).toFixed(1)}%) run against something the product ` +
      `actually meets: a real store, a real browser, or the deployment.\n`,
  );

  for (const level of ["L4", "L5", "L6"] as const) {
    const rows = files.filter((f) => f.level === level);
    console.log(`${level} (${rows.length}):`);
    for (const row of rows) console.log(`   ${row.file}  -- ${row.because}`);
    console.log("");
  }

  console.log("Which rung each debt row's proof stands on");
  console.log("=========================================\n");
  const anchors = claimAnchors(root, files);
  for (const a of anchors) {
    const floor = SEVERITY_EXPECTS[a.severity];
    const short = a.anchor ?? "--";
    const flag = floor && (a.anchor === null || a.anchor < floor) ? `  <- ${a.severity} implies ${floor}` : "";
    console.log(`${a.id} ${a.severity.padEnd(3)} ${short}  ${a.title.padEnd(48)}${flag}`);
  }
  const under = findUnderAnchoredClaims(anchors);
  console.log(
    `\n${under.length} row(s) claim more than their gate ever ran against.\n`,
  );
}
