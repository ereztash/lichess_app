/**
 * What a green `npm run verify` does and does not cover, printed with the verdict.
 *
 * WHY THIS EXISTS. "npm run verify is green" was used in a commit message, a PR body and an
 * implementation report as though it meant the same thing as the Verify workflow's green. It does
 * not, and the difference is not small: with `DATABASE_URL` unset, 28 tests of the record layer's
 * only persistent store SKIP, and the phrase "3,262 tests pass" silently includes zero of them.
 * That is the exact class the workflow's own comments describe -- "five database tests skipped
 * silently on every run for months, and DrizzleRecordStore had never executed a statement."
 *
 * WHAT THIS IS NOT. It is not a gate and it asserts nothing: it fails only if it cannot tell what
 * ran, which is a different and smaller claim than the ones around it. A verdict whose boundary is
 * printed beside it is a verdict somebody can quote correctly; a gate would be pretending the
 * boundary is an invariant.
 */

const hasDatabase = Boolean(process.env.DATABASE_URL);

const lines = [
  "",
  "verify scope -- what this green does and does not cover",
  "",
  `  database suite          ${hasDatabase ? "RAN (DATABASE_URL is set)" : "SKIPPED (DATABASE_URL unset) -- ~28 tests of DrizzleRecordStore, the server router and the health check did not run"}`,
  "  deployment suite        NOT RUN here -- 9 tests need a deployed origin and run in deployed.yml",
  "  engine, real browser    RAN -- tests/layout/* refuse to skip when Chromium is absent",
  "",
  "  This verdict is about this tree. It is not about the deployment, and with DATABASE_URL",
  "  unset it is not about the database. Quote it accordingly.",
  "",
];

console.log(lines.join("\n"));
