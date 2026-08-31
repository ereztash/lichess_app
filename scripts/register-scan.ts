/**
 * The reconciliation scanner: four registers, held against the tree and against each other.
 *
 * WHY THIS IS A GATE AND NOT A REVIEW. `MASTER_PRODUCT_DEBT.md` opens by saying that "what is still
 * open?" had four possible answers in this repository and no two agreed, and that the file closes
 * that debt. It closed it once. Nothing kept it closed, and one hand reconciliation across four
 * documents turned up four drifts in a single wave:
 *
 *   1. THE WORST ONE. A P0 found and fixed in that wave -- every blitz think time was a fractional
 *      millisecond, the stored schema wants an integer, so no blitz game had EVER been persisted in
 *      a real browser -- had no row. It was written up in `INERTIAL_UX_LAWS.md`, where a reader
 *      looking for open debt would never go. The register that answers "what is open?" did not know
 *      the defect had existed.
 *   2. `INERTIAL_UX_LAWS.md` named `GATE-NO-DUPLICATE-ACTION` as a Gate. No such gate was
 *      registered. That is the dangerous direction: it claims enforcement that does not exist, and
 *      it is the one direction a reader cannot check by reading.
 *   3. R-13 cited `55 useState` under a ceiling documented as one that may only go down. An
 *      extraction had taken the file to 53 and the ceiling had stayed at 55, quietly handing back
 *      the headroom the refactor had just paid for.
 *   4. `decisions/README.md` filed D04 under "not yet opened" with its trigger column reading
 *      "**now** -- M0 has passed". A met trigger, filed among unmet ones, is how a met trigger goes
 *      unnoticed for a wave -- and the Definition of Done turns on exactly that distinction.
 *
 * None of those is a documentation nit. Each is a register saying something about the build that
 * the build does not say about itself, and every one of them was invisible to `npm run verify`
 * because a markdown file is the one artefact here that no command reads.
 *
 * WHAT IS SCANNED AND WHAT DELIBERATELY IS NOT. Every predicate below is a claim one register makes
 * about something OUTSIDE itself: a path, a constant, a gate id, another register's table. Those
 * are checkable and they rot silently. The prose is not scanned -- an argument pinned to a string
 * is an assertion that a sentence equals itself, and it teaches whoever edits the sentence to edit
 * the scanner with it.
 *
 * EVERY PREDICATE RUNS OVER TWO ROOTS: the real tree, and `tests/fixtures/registers`, which holds
 * the four drifts above as the registers actually carried them. Same predicate, different input.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Finding } from "./gate-scan";

const DEBT = "docs/MASTER_PRODUCT_DEBT.md";
const LAWS = "docs/INERTIAL_UX_LAWS.md";
const LEDGER = "docs/decisions/README.md";
const RUNNER = "scripts/run_gates.ts";
const RATCHET = "tests/client/the-file-that-only-ever-grew.test.ts";
const HOME = "client/src/pages/Home.tsx";

const read = (root: string, file: string) => readFileSync(join(root, file), "utf8");
const has = (root: string, file: string) => existsSync(join(root, file));

/** The line a substring falls on, 1-indexed, so a finding points somewhere a reader can go. */
function lineOf(source: string, needle: string): number {
  const at = source.indexOf(needle);
  return at < 0 ? 1 : source.slice(0, at).split("\n").length;
}

/**
 * `GATE-EXPOSURE-CONTEXT` is the one gate name in the laws with nothing behind it, and the absence
 * is a decision: D21 found the record cannot represent feedback exposure at all, so a gate over the
 * schema would be a gate over nothing. It is exempt BECAUSE the file says so -- which is why the
 * second half of `findPhantomGates` checks that the sentence is still there.
 */
export const DECLARED_ABSENT = "GATE-EXPOSURE-CONTEXT";

/** Gate ids the runner actually declares. The one authority on what is enforced. */
function declaredGates(root: string): Set<string> {
  const runner = read(root, RUNNER);
  return new Set([...runner.matchAll(/\bid:\s*"(GATE-[A-Z0-9-]+)"/g)].map((m) => m[1]));
}

/** A law that claims a gate the runner does not register claims enforcement that does not exist. */
export function findPhantomGates(root: string): Finding[] {
  const laws = read(root, LAWS);
  const declared = declaredGates(root);
  const out: Finding[] = [];

  for (const id of new Set([...laws.matchAll(/GATE-[A-Z0-9-]+/g)].map((m) => m[0]))) {
    if (id === DECLARED_ABSENT || declared.has(id)) continue;
    out.push({ file: LAWS, line: lineOf(laws, id), text: `claims ${id} as a Gate; none runs` });
  }
  /* The exemption survives only while the file still says why it is an exemption. */
  if (laws.includes(DECLARED_ABSENT) && !/deliberately absent/.test(laws)) {
    out.push({
      file: LAWS,
      line: lineOf(laws, DECLARED_ABSENT),
      text: `${DECLARED_ABSENT} lost the sentence that makes its absence deliberate`,
    });
  }
  if (declared.has(DECLARED_ABSENT)) {
    out.push({ file: RUNNER, line: 1, text: `${DECLARED_ABSENT} now runs -- drop the exemption` });
  }
  return out;
}

/** Every file under a root, by basename, so a citation given as a bare filename can resolve. */
function everyFile(root: string, dir = root, out = new Set<string>()): Set<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) everyFile(root, full, out);
    else out.add(entry);
  }
  return out;
}

/** A register that cites a file which is not in the tree is citing something a reader cannot open. */
export function findDanglingCitations(root: string): Finding[] {
  const debt = read(root, DEBT);
  const names = everyFile(root);
  const cited = new Set(
    [...debt.matchAll(/`([A-Za-z0-9_./-]+\.(?:ts|tsx|py|md|sql|json))(?::\d+)?`/g)].map((m) => m[1]),
  );
  return [...cited]
    .filter((path) => !has(root, path) && !names.has(path.split("/").pop()!))
    .map((path) => ({ file: DEBT, line: lineOf(debt, path), text: `cites ${path}, not in the tree` }));
}

/**
 * The vocabulary a state cell may use.
 *
 * WHY IT IS CLOSED. A reader asking "what is open?" scans for `open`. Every synonym invented later
 * -- "partially addressed", "mostly done" -- answers that question wrongly to exactly the reader
 * the register exists for. `half fixed` is on the list because it is honest, and it is deliberately
 * ugly to read.
 */
export const STATE_VOCABULARY = [
  "open",
  "blocked",
  "refuted",
  "fixed",
  "half fixed",
  "measured and deferred",
] as const;

export function findStatesOutsideVocabulary(root: string): Finding[] {
  const debt = read(root, DEBT);
  const rows = [...debt.matchAll(/^### (R-\d+) · /gm)].length;
  const cells = [...debt.matchAll(/^\| state \| (.+?) \|?$/gm)].map((m) => m[1]);
  const out: Finding[] = [];

  /*
   * R-16 was once written as one squashed line -- `| type | UX · state | **refuted as framed** ·
   * basis | ...` -- so every scan over this register silently skipped it. A row that does not parse
   * is a row nobody counts, which is the same failure as a row that is missing.
   */
  if (cells.length !== rows) {
    out.push({
      file: DEBT,
      line: 1,
      text: `${rows} rows and ${cells.length} state cells -- a row's state does not parse`,
    });
  }
  for (const cell of cells) {
    const head = cell.replace(/\*/g, "").trim().toLowerCase();
    if (!STATE_VOCABULARY.some((word) => head.startsWith(word))) {
      out.push({ file: DEBT, line: lineOf(debt, cell), text: `"${cell}" is not a register state` });
    }
  }
  return out;
}

/**
 * The register's live numbers, against the constants they describe.
 *
 * A row that cites what it measured once decays the moment anything moves; a row that cites the
 * CONSTANT its gate enforces stays true or comes up here. And the second half is the one no test
 * held: that a ratchet documented as only ever going down has actually come down to meet the file.
 * Slack there is headroom a refactor already paid for, handed back without anyone deciding to.
 */
export function findBankedCeilingSlack(root: string): Finding[] {
  const debt = read(root, DEBT);
  const ratchet = read(root, RATCHET);
  const out: Finding[] = [];

  const lineCeiling = /const LINE_CEILING = (\d+);/.exec(ratchet)?.[1];
  const stateCeiling = /const STATE_CEILING = (\d+);/.exec(ratchet)?.[1];
  if (!lineCeiling || !stateCeiling) {
    return [{ file: RATCHET, line: 1, text: "the ratchet's ceilings are gone" }];
  }
  for (const [name, value] of [
    ["LINE_CEILING", lineCeiling],
    ["STATE_CEILING", stateCeiling],
  ] as const) {
    if (!debt.includes(`${name} = ${value}`)) {
      out.push({ file: DEBT, line: lineOf(debt, "R-13"), text: `R-13 does not quote ${name} = ${value}` });
    }
  }
  const held = read(root, HOME).match(/useState[<(]/g)?.length ?? 0;
  if (Number(stateCeiling) > held) {
    out.push({
      file: RATCHET,
      line: lineOf(ratchet, "const STATE_CEILING"),
      text: `Home holds ${held} and the ceiling is ${stateCeiling} -- lower it, do not bank the slack`,
    });
  }
  return out;
}

/**
 * The confidence ledger's node table, against the node files it summarises.
 *
 * The table is what a reader consults INSTEAD of opening nine files, so a summary that has stopped
 * matching is worse than no summary at all.
 */
export function findLedgerDrift(root: string): Finding[] {
  const ledger = read(root, LEDGER);
  const dir = join(root, "docs/decisions");
  const files = readdirSync(dir).filter((n) => /^D\d\d-.+\.md$/.test(n)).sort();
  const linked = [...new Set([...ledger.matchAll(/\]\((D\d\d-[a-z0-9-]+\.md)\)/g)].map((m) => m[1]))];
  const out: Finding[] = [];

  for (const file of files) {
    if (!linked.includes(file)) {
      out.push({ file: LEDGER, line: 1, text: `${file} exists and the node table does not link it` });
    }
  }
  for (const link of linked) {
    if (!files.includes(link)) {
      out.push({ file: LEDGER, line: lineOf(ledger, link), text: `links ${link}, which is not there` });
    }
  }
  for (const file of files.filter((f) => linked.includes(f))) {
    const node = file.slice(0, 3);
    const declared = /\*\*Mode:\*\*\s*`?([A-Z_]+)`?/.exec(readFileSync(join(dir, file), "utf8"))?.[1];
    if (!declared) continue;
    const row = ledger.split("\n").find((l) => l.startsWith(`| [${node}]`));
    if (!row?.includes(declared)) {
      out.push({ file: LEDGER, line: 1, text: `${node} declares ${declared}; its row says otherwise` });
    }
  }
  return out;
}

/**
 * A deferred node counts as closed debt only while its trigger is NOT met.
 *
 * THE DEFINITION OF DONE TURNS ON THIS. The moment a trigger fires the node is work, and a table of
 * unfired triggers is the last place anyone would look for work. D04 sat there for a whole wave
 * with "opens **now** -- M0 has passed" in the column that exists to say the opposite.
 */
export function findFiredTriggersFiledAsUnfired(root: string): Finding[] {
  const ledger = read(root, LEDGER);
  const section = ledger.split("### Not yet opened")[1] ?? "";
  const rows = section.split("\n").filter((l) => /^\| D\d\d/.test(l));
  if (!rows.length) {
    return [{ file: LEDGER, line: 1, text: "the not-yet-opened table is gone or no longer parses" }];
  }
  return rows
    .filter((row) => /\bnow\b|has passed|already/i.test(row))
    .map((row) => ({
      file: LEDGER,
      line: lineOf(ledger, row),
      text: `${row.split("|")[1].trim()} is filed as unfired and its trigger says otherwise`,
    }));
}

/** Every predicate, over one root. The gate is one call; the control is the same call, elsewhere. */
export function findRegisterDrift(root: string): Finding[] {
  return [
    ...findPhantomGates(root),
    ...findDanglingCitations(root),
    ...findStatesOutsideVocabulary(root),
    ...findBankedCeilingSlack(root),
    ...findLedgerDrift(root),
    ...findFiredTriggersFiledAsUnfired(root),
  ];
}
