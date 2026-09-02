/**
 * Every blocking check, and the evidence that it can fail.
 *
 * WHY THIS IS AN INVENTORY AND NOT A RULE THAT EVERYTHING NEEDS A SYNTHETIC FIXTURE. `RNL-04` says
 * a gate that has not demonstrated failure is not a gate, and `npm run gates:controls` proves that
 * for thirty predicates. The study found the rule was not applied to the CI job itself: of ten
 * blocking steps in `verify-build.yml`, two could demonstrate their own failure and eight could not
 * (`G-02`, `G-10`).
 *
 * The obvious fix -- force all eight into a synthetic fixture -- is wrong, and the study said so
 * about one of them by name. `npm audit` fails when a real advisory is published against a
 * dependency this build ships. A synthetic vulnerability would not be that: it would be a fixture
 * asserting that npm can read a file it was handed, which is a claim about npm and not about this
 * repository's exposure. **A control that proves the wrong thing is worse than an absent one,
 * because it looks like coverage.**
 *
 * So each check is classified by what CAN honestly falsify it, and the classification is the
 * deliverable. Five kinds, and only the first is a fixture:
 *
 *   SYNTHETIC_CONTROL_APPROPRIATE   the same predicate over a deliberately broken input
 *   HISTORICAL_DEFECT_FIXTURE       the defect it actually had, preserved and re-run
 *   TOOL_SELF_TEST                  the tool's own contract, pinned, and observable
 *   EXTERNAL_CONDITION              it fails on the world changing; no fixture reproduces that
 *   NO_HONEST_SYNTHETIC_CONTROL     a fixture would prove something else. What is done instead
 *
 * THE INVENTORY IS DERIVED, NOT MAINTAINED. `blockingSteps()` reads the steps out of the workflow
 * file. `findUnclassifiedChecks` reddens when the workflow gains a step this table does not
 * classify, so the inventory cannot fall behind the job it describes -- which is the failure mode
 * of every hand-written register this repository has already had to fix.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Finding } from "./gate-scan";

export const WORKFLOW = ".github/workflows/verify-build.yml";

export type FalsificationKind =
  | "SYNTHETIC_CONTROL_APPROPRIATE"
  | "HISTORICAL_DEFECT_FIXTURE"
  | "TOOL_SELF_TEST"
  | "EXTERNAL_CONDITION"
  | "NO_HONEST_SYNTHETIC_CONTROL";

export interface Falsification {
  /** Matched against the workflow step's `name:`, lowercased, as a substring. */
  step: string;
  kind: FalsificationKind;
  /** The command that demonstrates the failure, when one exists and can be run here. */
  mechanism: string;
  /** Present when `mechanism` is a command in this repository, so the inventory can point at it. */
  runnable?: string;
  why: string;
}

/**
 * One row per blocking step in `verify-build.yml`.
 *
 * Ordered as the job runs them, because a reader checking this against the workflow should be able
 * to read both top to bottom.
 */
export const FALSIFICATIONS: Falsification[] = [
  {
    step: "install dependencies",
    kind: "TOOL_SELF_TEST",
    mechanism: "`npm ci` exits non-zero when package.json and package-lock.json disagree",
    why:
      "that refusal is npm's own contract and the reason the workflow uses `ci` rather than " +
      "`install`, stated in the workflow's own comment: `install` may resolve a dependency the " +
      "lock does not name, so a green run would be evidence about a tree no developer has. A " +
      "fixture here would test npm, not this repository",
  },
  {
    step: "audit the dependencies this build ships",
    kind: "NO_HONEST_SYNTHETIC_CONTROL",
    mechanism:
      "none. What is done instead: the step is scoped so its failures are meaningful -- " +
      "`--omit=dev` because a vulnerability in vitest is conveyed to nobody, `--audit-level=high` " +
      "because a step that fails on every low advisory gets disabled within a month",
    why:
      "a synthetic vulnerability would assert that npm can read a manifest it was handed, which " +
      "is a claim about npm rather than about this build's exposure. The check's real input is " +
      "the advisory database, and it can go red on a day nothing here changed -- which the " +
      "workflow names as the step working rather than as a fault. Q36 in scripts/authority-scan.ts " +
      "records the matching capability gap: this detects a problem and prescribes no response",
  },
  {
    step: "install chromium for the layout tests",
    kind: "EXTERNAL_CONDITION",
    mechanism:
      "`tests/layout/browser.ts` THROWS when no Chromium is present, so a runner without one " +
      "fails loudly in the suite rather than reporting green on tests that never ran",
    why:
      "the step itself fails on apt or a package mirror having a bad minute -- a 403 from a " +
      "Microsoft mirror once took `verify` down before a single test ran -- which is why the apt " +
      "half is allowed to fail. The guarantee is downstream and it is a refusal, not a fixture",
  },
  {
    step: "typecheck",
    kind: "SYNTHETIC_CONTROL_APPROPRIATE",
    mechanism: "`npm run check:control` compiles a value assigned to a union that does not admit it",
    runnable: "npm run check:control",
    why:
      "a green typecheck and a typecheck that is not running look identical from outside, and the " +
      "error in the fixture is the shape this project's types exist to catch: a grade outside the " +
      "closed union would render as a word no screen has a wording for",
  },
  {
    step: "typecheck positive control",
    kind: "TOOL_SELF_TEST",
    mechanism: "it IS the control: the step fails when `npm run check:control` succeeds",
    why:
      "a control step that reported green would mean the compiler had stopped rejecting the file, " +
      "which is the one failure a control cannot delegate to something else",
  },
  {
    step: "build the database schema",
    kind: "HISTORICAL_DEFECT_FIXTURE",
    mechanism:
      "the defect is preserved in the workflow's own comment and in the loop's shape: it once " +
      "loaded 0000 alone and called that the schema, which surfaces as `Unknown column ... in " +
      "'field list'` from a suite that passes locally because DATABASE_URL is unset there",
    why:
      "the step's failure mode needs a real MySQL, which is the service the job starts. A fixture " +
      "would need a second database to prove the first one is used. The standing evidence is that " +
      "the database suite RUNS in CI -- 26 tests that skip locally -- and fails rather than skips " +
      "when the schema is wrong",
  },
  {
    step: "build",
    kind: "TOOL_SELF_TEST",
    mechanism: "`vite build` exits non-zero on an unresolved import or a failed transform",
    why:
      "and one standing consumer proves the build is real rather than merely exiting zero: " +
      "`tests/layout/content-security-policy.layout.test.ts` serves `dist/public` under the exact " +
      "policy vercel.json sends, in a real browser, and throws rather than skipping when the " +
      "build is absent. That is why the build step runs BEFORE the tests",
  },
  {
    step: "test",
    kind: "NO_HONEST_SYNTHETIC_CONTROL",
    mechanism:
      "none at the suite level. What is done instead: thirty gate predicates with fixtures " +
      "(`npm run gates:controls`), and the disagreement fixtures added per repair -- the learning " +
      "queue's stored-versus-derived case is verified to fail against the pre-change read path",
    why:
      "G-10. A control for `npm test` as a whole would be a mutation run, and there is none. The " +
      "repository has recorded at least five cases of a test passing BECAUSE of a defect (cycles " +
      "7, 13 twice, 39, 40), so the absence is real and is recorded rather than papered over",
  },
  {
    step: "gates",
    kind: "SYNTHETIC_CONTROL_APPROPRIATE",
    mechanism: "`npm run gates:controls` -- every gate over a deliberately broken fixture, all red",
    runnable: "npm run gates:controls",
    why: "the two-mode contract this repository already had, and the model the rest of this table is measured against",
  },
  {
    step: "gate positive controls",
    kind: "TOOL_SELF_TEST",
    mechanism:
      "it IS the control. Its contract is that EVERY fixture goes red, and it exits non-zero if " +
      "any predicate passes over its broken input",
    why:
      "a control run that reported green would mean a gate had stopped checking, which is the one " +
      "failure a control cannot delegate to something else",
  },
  {
    step: "bundle budget positive control",
    kind: "TOOL_SELF_TEST",
    mechanism: "it IS the control: the step fails when `npm run bundle:budget:control` succeeds",
    why: "as with the typecheck control, and with `gates:controls` before both",
  },
  {
    step: "bundle budget",
    kind: "SYNTHETIC_CONTROL_APPROPRIATE",
    mechanism:
      "`npm run bundle:budget:control` -- the same script over `tests/fixtures/bundle`, whose " +
      "entry chunk is one kilobyte over the ratchet and whose index.html eagerly preloads the engine",
    runnable: "npm run bundle:budget:control",
    why:
      "G-02's named gap, and the study's own note says a fixture with a deliberately oversized " +
      "entry graph is buildable. It is, and it catches both halves: the ceiling and the R3 rule " +
      "that the engine may not be fetched before a reveal asks for it",
  },
];

const read = (root: string, path: string) => readFileSync(join(root, path), "utf8");

/**
 * The blocking steps the workflow actually declares.
 *
 * Read from the file rather than listed here, so this cannot describe a job that no longer exists.
 * A step with `continue-on-error` would not be blocking; there are none, and one appearing would
 * need a row of its own saying so.
 */
export function blockingSteps(root: string): string[] {
  if (!existsSync(join(root, WORKFLOW))) return [];
  const source = read(root, WORKFLOW);
  return [...source.matchAll(/^ {6}- name:\s*(.+)$/gm)].map((m) => m[1].trim());
}

/**
 * The row for a step, matching the MOST SPECIFIC pattern rather than the first.
 *
 * "Typecheck positive control (must fail)" contains "typecheck", so a first-match lookup classified
 * the control as the check it controls -- and reported the control as having a runnable control of
 * its own. Longest pattern wins, which is the only ordering that does not depend on where a row
 * happens to sit in the array.
 */
function rowFor(step: string): Falsification | undefined {
  const lower = step.toLowerCase();
  return FALSIFICATIONS.filter((f) => lower.includes(f.step)).sort(
    (a, b) => b.step.length - a.step.length,
  )[0];
}

/** A blocking step this table does not classify. The extension path, and the reason it is a gate. */
export function findUnclassifiedChecks(root: string): Finding[] {
  const findings: Finding[] = [];
  const steps = blockingSteps(root);
  if (!steps.length) {
    return [{ file: WORKFLOW, line: 1, text: "no blocking steps parsed; the workflow shape changed" }];
  }
  for (const step of steps) {
    if (!rowFor(step)) {
      findings.push({
        file: WORKFLOW,
        line: 1,
        text: `blocking step "${step}" has no falsification classification in falsification-scan.ts`,
      });
    }
  }
  /*
   * AND THE OTHER DIRECTION. A row for a step that no longer runs claims coverage of something that
   * is not there, which is the dangerous half: it makes the inventory look more complete than the
   * job it describes.
   */
  for (const f of FALSIFICATIONS) {
    if (!steps.some((s) => s.toLowerCase().includes(f.step))) {
      findings.push({
        file: "scripts/falsification-scan.ts",
        line: 1,
        text: `classified "${f.step}", which is no longer a step in ${WORKFLOW}`,
      });
    }
  }
  return findings;
}

/** A runnable mechanism that names a script `package.json` does not define. */
export function findMissingMechanisms(root: string): Finding[] {
  if (!existsSync(join(root, "package.json"))) return [];
  const scripts = JSON.parse(read(root, "package.json")).scripts ?? {};
  return FALSIFICATIONS.filter((f) => f.runnable)
    .filter((f) => !(f.runnable!.replace(/^npm run /, "") in scripts))
    .map((f) => ({
      file: "package.json",
      line: 1,
      text: `"${f.step}" names \`${f.runnable}\` as its falsification and no such script exists`,
    }));
}

export function findFalsificationDrift(root: string): Finding[] {
  return [...findUnclassifiedChecks(root), ...findMissingMechanisms(root)];
}

/** The inventory, for the report. Derived from the workflow, not transcribed. */
export function inventory(root: string): {
  step: string;
  kind: FalsificationKind | "UNCLASSIFIED";
  mechanism: string;
  runnable: string;
}[] {
  return blockingSteps(root).map((step) => {
    const match = rowFor(step);
    return {
      step,
      kind: match?.kind ?? "UNCLASSIFIED",
      mechanism: match?.mechanism ?? "-",
      runnable: match?.runnable ?? "-",
    };
  });
}
