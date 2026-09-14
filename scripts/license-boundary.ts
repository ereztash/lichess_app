/**
 * THE LICENSING BOUNDARY, AS A PREDICATE OVER A TREE.
 *
 * WHY THIS EXISTS. This product ships one GPL component -- Stockfish -- behind a Worker boundary,
 * and its first-party code is intended to move to a proprietary default. Both halves of that
 * arrangement are invisible at a glance and easy to undo by accident: an `npm install` of a
 * copyleft package, a snippet pasted with its licence header intact, a manifest edited back to a
 * whole-project GPL claim, an engine version bumped without its compliance record. None of those
 * produce a test failure, a type error, or a broken screen. They produce a licensing problem that
 * surfaces at a due-diligence review, years later, priced accordingly.
 *
 * IT TAKES A TREE RATHER THAN READING THE REPOSITORY. That is the whole of what makes the positive
 * control meaningful: the gate and its control run THIS function over different directories, so a
 * control that goes red proves the predicate can detect the violation rather than proving that
 * some other, weaker predicate can. `scripts/gate-scan.ts` states the same rule for the gates it
 * serves, and this follows it.
 *
 * WHAT IT DOES NOT DO. It is not a licence scanner and does not attempt to be one: it reads
 * declared licences from a lockfile and declared headers from source. Code copied from a copyleft
 * project with its header stripped is invisible here and is invisible to any scanner of this kind.
 * `IP_PROVENANCE_AUDIT.md` §2 says so in the same words. What this gate catches is DRIFT -- the
 * boundary being moved by ordinary work -- which is the failure that actually happens.
 *
 * IT ALSO DOES NOT ESTABLISH BUNDLE PROVENANCE, and that limit is now named rather than implied.
 * The earlier revision decided whether a weak-copyleft package was conveyed by searching emitted
 * chunks for its npm package name, and then treated ABSENCE of that string as evidence the package
 * is not conveyed. A bundler makes no promise to preserve package-name strings, so absence
 * establishes nothing. The string search survives as `DRIFT_HEURISTIC` -- a POSITIVE-only signal --
 * and permission now comes from an explicit reviewed classification in `LICENSING.md` instead. See
 * `weakCopyleftClassification` below.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import { type Finding } from "./gate-scan.js";

/**
 * A single path held outside the ordinary proprietary-source rule, with the reason attached.
 *
 * THE REASON IS A REQUIRED FIELD BECAUSE THE CHEAP FIX IS THE DANGEROUS ONE. Widening this gate to
 * cover `scripts/**` and `tests/**` turns up files that name a copyleft licence for reasons that
 * are not a grant -- a control fixture that exists to be caught, a test whose SUBJECT is the
 * historical GPL licence, a harness that loads the engine in-process on purpose. Every one of them
 * can be silenced by deleting a directory from `proprietary`, and a gate silenced that way reports
 * itself green over territory it no longer reads. So exceptions are per-path, carry a reason, and
 * a directory exception broad enough to cover a whole proprietary root is itself a finding.
 */
export interface LicenseException {
  /** Repository-relative path. A trailing `/` makes it a directory prefix. */
  readonly path: string;
  /**
   * `gpl` — first-party code deliberately held on the GPL side of the boundary.
   * `not-a-grant` — the file names a licence as data under test or as a deliberate violation,
   * rather than licensing itself.
   */
  readonly side: "gpl" | "not-a-grant";
  readonly why: string;
}

/**
 * A tree to check, named so the gate and the control differ only in their input.
 *
 * `root` is the directory containing the manifests; `proprietary` the paths whose files must carry
 * no copyleft notice; `exceptions` the individually justified paths held outside that rule.
 */
export interface LicenseTree {
  readonly root: string;
  readonly proprietary: readonly string[];
  readonly exceptions: readonly LicenseException[];
}

/**
 * The real repository.
 *
 * `proprietary` NOW NAMES EVERY FIRST-PARTY SOURCE FAMILY `LICENSING.md` §1 CLAIMS, which it did
 * not before. The component map listed `scripts/**` and `tests/**` as first-party from the start,
 * and §3 rule 1 named `scripts` explicitly -- while this predicate scanned three directories. A
 * rule the map states and the machine does not check is a rule that holds until somebody tests it.
 */
export const REPOSITORY: LicenseTree = {
  root: ".",
  proprietary: ["client/src", "server", "shared", "scripts", "tests"],
  exceptions: [
    {
      path: "scripts/sf-wasm.mjs",
      side: "gpl",
      why:
        "first-party code that calls require('stockfish') and drives the engine IN-PROCESS -- the " +
        "one place in this repository where first-party and engine code share a process. " +
        "LICENSING.md §6 holds it on the GPL side deliberately.",
    },
    {
      path: "tests/docs/a-licence-that-is-actually-there.test.ts",
      side: "not-a-grant",
      why:
        "its subject IS the root LICENSE, so it holds the SPDX identifier as data under test. The " +
        "file licenses nothing; removing the string would defeat the test that keeps the " +
        "repository's own licence statements agreeing with each other.",
    },
    {
      path: "tests/fixtures/licensing/",
      side: "not-a-grant",
      why: "GATE-LICENSE-BOUNDARY's own positive control fixture: a boundary lost on purpose.",
    },
    {
      path: "tests/fixtures/licensing-stale-notices/",
      side: "not-a-grant",
      why:
        "the second positive-control fixture: compliance files present but naming an engine " +
        "version that is not the installed one.",
    },
  ],
};

/**
 * STRONG COPYLEFT: reaches the whole work it is combined with.
 *
 * GPL, AGPL, LGPL and SSPL are the licences whose obligations can propagate beyond the files they
 * cover. A strong-copyleft package that is not the engine is a change to this product's licensing
 * architecture.
 */
const STRONG_COPYLEFT = /\b(A?GPL|LGPL|SSPL)[-\s]?[0-9]/i;

/**
 * WEAK, FILE-LEVEL COPYLEFT: reaches the covered files and stops.
 *
 * MPL-2.0 §3.3 permits distributing a Larger Work under other terms provided the MPL-covered files
 * stay MPL. EPL and CDDL work the same way. Treating these as violations was this gate's first
 * design and it was WRONG: the real tree carries thirteen of them -- `axe-core` and twelve
 * `lightningcss` builds, pulled in by the CSS toolchain -- and every one is build-time tooling. A
 * gate that calls those a licensing violation is a gate somebody switches off.
 *
 * Treating them as harmless because a string was missing from a bundle was the SECOND design and
 * was also wrong, for the opposite reason. What replaces both is a classification somebody wrote
 * down: see `weakCopyleftClassification`.
 */
const WEAK_COPYLEFT = /\b(MPL|EPL|CDDL)[-\s]?[0-9]/i;

/**
 * A COPYLEFT NOTICE AS IT IS ACTUALLY WRITTEN IN A FILE HEADER, which is not an SPDX identifier.
 *
 * THIS GATE'S POSITIVE CONTROL CAUGHT THIS, and it is worth recording because the miss was silent.
 * The dependency checks read `license` fields out of a lockfile, and those really are SPDX strings
 * -- `GPL-3.0`, `MPL-2.0` -- so a pattern like `GPL[-\s]?[0-9]` reads them correctly. The header
 * check was given the same pattern and therefore matched almost nothing: a real GPL header says
 * *"the terms of the GNU General Public License"*, spelled out, and contains no `GPL` token at all.
 * The fixture was written the way a real pasted header looks, the control went red on four checks
 * out of five, and the fifth -- the one that catches a PASTE, which is the commonest way a boundary
 * is lost -- was dead.
 *
 * Both spellings are matched here: the prose names and the SPDX identifiers.
 */
const COPYLEFT_NOTICE = new RegExp(
  [
    String.raw`GNU\s+(Affero\s+)?(Lesser\s+)?General\s+Public\s+Licen[cs]e`,
    String.raw`Mozilla\s+Public\s+Licen[cs]e`,
    String.raw`Eclipse\s+Public\s+Licen[cs]e`,
    String.raw`Common\s+Development\s+and\s+Distribution\s+Licen[cs]e`,
    String.raw`Server\s+Side\s+Public\s+Licen[cs]e`,
    String.raw`\b(A?GPL|LGPL|SSPL|MPL|EPL|CDDL)[-\s]?[0-9]`,
  ].join("|"),
  "i",
);

/**
 * The one strong-copyleft package this product is permitted to depend on.
 *
 * A SET OF ONE, AND THE SIZE IS THE POINT. The migration is tractable precisely because the
 * strong-copyleft surface is a single engine behind a message boundary. A second entry here is a
 * change to the product's licensing architecture and must be a decision somebody makes in a diff,
 * which is what an allowlist of one buys that a "no new copyleft" rule of thumb does not.
 */
const PERMITTED_COPYLEFT_PACKAGES = new Set(["stockfish"]);

/** The compliance record a conveyed GPL component must carry. Losing any of it is a violation. */
const REQUIRED_COMPLIANCE_PATHS = [
  "THIRD_PARTY_NOTICES.md",
  "client/public/licenses/stockfish/COPYING.txt",
];

/**
 * The canonical component map, checked SEPARATELY from the compliance record above.
 *
 * It is a different failure with a different consequence. Deleting `COPYING.txt` breaks a GPL §4
 * obligation to a recipient of Stockfish; deleting `LICENSING.md` restores the whole-repository
 * ambiguity the migration exists to remove, and leaves every other statement here unanchored. The
 * checks are split so the positive control can demonstrate each one independently rather than
 * inferring both from one red count.
 */
const COMPONENT_MAP = "LICENSING.md";

/** Source extensions a first-party licence header can appear in. */
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/**
 * Every source file under a root, INCLUDING `.mjs`.
 *
 * `gate-scan.ts`'s `sourceFiles` collects `.ts` and `.tsx` only, which is right for the gates it
 * serves and wrong here: the single most important entry on this gate's exception list is
 * `scripts/sf-wasm.mjs`, and under a `.ts`-only walk that entry was INERT -- the scanner could not
 * have seen the file whether it was allowlisted or not. An exception that cannot fire is not an
 * exception, it is a comment. This walk is licensing-specific so that widening it here does not
 * change what any other gate reads.
 */
function licensedSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) out.push(...licensedSourceFiles(full));
    else if (SOURCE_EXTENSIONS.has(extname(full))) out.push(full);
  }
  return out;
}

/** Package names that appear in emitted chunks. POSITIVE EVIDENCE ONLY -- see `DRIFT_HEURISTIC`. */
function namesVisibleInDistributedOutput(root: string, candidates: readonly string[]): Set<string> {
  const out = new Set<string>();
  const assets = join(root, "dist", "public", "assets");
  if (!existsSync(assets)) return out;
  let blob = "";
  for (const file of readdirSync(assets)) {
    if (extname(file) !== ".js") continue;
    blob += readFileSync(join(assets, file), "utf8");
  }
  for (const name of candidates) {
    if (blob.includes(name)) out.add(name);
  }
  return out;
}

/**
 * WHAT THE STRING SEARCH ABOVE IS, STATED SO IT CANNOT BE QUOTED AS SOMETHING STRONGER.
 *
 * `DRIFT_HEURISTIC`. It answers one question in one direction: if a package's npm name appears
 * verbatim in an emitted chunk, something from that package probably reached the distribution.
 * It cannot answer the other direction. Minification renames, tree-shaking drops identifiers,
 * inlining erases module boundaries, and no bundler undertakes to preserve a package name at all.
 * ABSENCE OF THE STRING IS NOT ABSENCE OF THE CODE.
 *
 * So nothing here is permitted by absence. Permission comes from `weakCopyleftClassification` --
 * a table a person wrote and a reviewer read. The heuristic's only remaining job is to CONTRADICT
 * that table: a package classified "does not reach the distribution" whose name turns up in a
 * chunk is a classification that has gone stale, and that is a finding.
 */
const DRIFT_HEURISTIC =
  "package-name string search over emitted chunks; positive evidence only, absence proves nothing";

/** One row of the reviewed weak-copyleft classification in `LICENSING.md`. */
interface WeakCopyleftRow {
  /** Package name, or a prefix ending in `*` covering a platform-build family. */
  readonly pattern: string;
  /** Whether the reviewer recorded this package as reaching the distributed output. */
  readonly conveyed: boolean;
  readonly line: number;
}

/** A wildcard row must name a real package family, not stand in for the whole ecosystem. */
const MIN_WILDCARD_PREFIX = 8;

/**
 * Read the reviewed classification out of `LICENSING.md`, between explicit markers.
 *
 * THE DOCUMENT IS THE AUTHORITY AND THE GATE IS THE READER, rather than the gate holding a second
 * copy of the list for a test to compare against. A second copy is a second thing to keep in sync,
 * and this repository has been bitten by that four times over (`a-licence-that-is-actually-there`
 * exists because of it). Markers rather than table-shape sniffing, so reformatting the document
 * cannot silently empty the list.
 */
function weakCopyleftClassification(root: string): WeakCopyleftRow[] | null {
  const path = join(root, COMPONENT_MAP);
  if (!existsSync(path)) return null;
  const lines = readFileSync(path, "utf8").split("\n");
  const begin = lines.findIndex((l) => l.includes("weak-copyleft-classification:begin"));
  const end = lines.findIndex((l) => l.includes("weak-copyleft-classification:end"));
  if (begin < 0 || end < 0 || end < begin) return null;
  const rows: WeakCopyleftRow[] = [];
  for (let i = begin + 1; i < end; i += 1) {
    const cells = lines[i].split("|").map((c) => c.trim());
    if (cells.length < 5) continue;
    const pattern = /`([^`]+)`/.exec(cells[1])?.[1];
    if (!pattern) continue;
    rows.push({ pattern, conveyed: /\byes\b/i.test(cells[3]), line: i + 1 });
  }
  return rows;
}

const matchesRow = (row: WeakCopyleftRow, name: string): boolean =>
  row.pattern.endsWith("*")
    ? name.startsWith(row.pattern.slice(0, -1))
    : row.pattern === name;

/**
 * Check one tree. Findings mean the boundary moved.
 *
 * SEVEN CHECKS, AND EACH ONE IS A WAY THE BOUNDARY HAS ACTUALLY BEEN LOST BY SOMEBODY. They are
 * not a taxonomy invented for completeness: a pasted header, an installed package, an unreviewed
 * transitive licence, a manifest edited back, a deleted notice, a deleted map, an engine bumped in
 * a routine dependency update.
 *
 * EACH FINDING CARRIES A STABLE PREFIX, because the control asserts that each detector fired
 * INDIVIDUALLY. A fixture that trips six rules at once and a fixture that trips one rule six times
 * produce the same count, and only one of them proves anything.
 */
export function licenseBoundaryFindings(tree: LicenseTree): Finding[] {
  const findings: Finding[] = [];
  const at = (file: string, line: number, text: string) => findings.push({ file, line, text });
  const norm = (p: string) => p.replaceAll("\\", "/").replace(/^\.\//, "");

  /*
   * 0. NO EXCEPTION MAY BE WIDE ENOUGH TO DISABLE THE RULE IT EXCEPTS.
   *
   * The whole risk of widening `proprietary` to `scripts` and `tests` is that the next person to
   * meet a red gate reaches for the one-line fix: drop the directory, or except it wholesale. This
   * check makes that fix fail. An exception whose prefix covers a declared proprietary root is not
   * an exception to a rule, it is the deletion of one.
   */
  for (const ex of tree.exceptions) {
    const p = norm(ex.path);
    if (!ex.why.trim()) at(p, 1, `exception carries no reason: ${p}`);
    if (!p.endsWith("/")) continue;
    const covers = tree.proprietary.some((dir) => norm(`${dir}/`).startsWith(p));
    if (covers) {
      at(p, 1, `exception is broad enough to disable the rule it excepts: ${p}`);
    }
  }

  const excepted = (rel: string) =>
    tree.exceptions.some((ex) => {
      const p = norm(ex.path);
      return p.endsWith("/") ? rel.startsWith(p) : rel === p;
    });

  /*
   * 1. NO COPYLEFT NOTICE IN A PROPRIETARY DIRECTORY.
   *
   * Reads the header region rather than the whole file, because a licence notice lives at the top
   * and prose further down that happens to name a licence -- this repository's own documentation
   * does, at length -- is discussion rather than a grant.
   */
  for (const dir of tree.proprietary) {
    const full = join(tree.root, dir);
    if (!existsSync(full)) continue;
    for (const file of licensedSourceFiles(full)) {
      const rel = norm(file).replace(`${norm(tree.root)}/`, "");
      if (excepted(rel)) continue;
      const head = readFileSync(file, "utf8").split("\n").slice(0, 30);
      head.forEach((line, i) => {
        if (!COPYLEFT_NOTICE.test(line)) return;
        at(rel, i + 1, `copyleft notice in a proprietary path: ${line.trim().slice(0, 80)}`);
      });
    }
  }

  /*
   * 2. NO NEW COPYLEFT DEPENDENCY, read from the RESOLVED tree and not the declared ranges.
   *
   * `package.json` says what was asked for; the lockfile says what is actually installed and
   * therefore what is actually conveyed. A transitive copyleft package appears only in the second.
   *
   * 3. EVERY WEAK-COPYLEFT PACKAGE HAS BEEN CLASSIFIED BY A PERSON.
   *
   * Weak copyleft is permitted here and usually harmless, and the harmless case and the harmful one
   * differ by exactly one fact: whether the package is CONVEYED. This gate cannot measure that
   * fact -- see `DRIFT_HEURISTIC` -- so it does not pretend to. It requires the fact to have been
   * recorded, and reports the table and the tree disagreeing in either direction.
   */
  const lockPath = join(tree.root, "package-lock.json");
  const classification = weakCopyleftClassification(tree.root);
  const weakInTree: string[] = [];
  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, "utf8")) as {
      packages?: Record<string, { license?: string; version?: string }>;
    };
    for (const [path, meta] of Object.entries(lock.packages ?? {})) {
      const name = /node_modules\/((?:@[^/]+\/)?[^/]+)$/.exec(path)?.[1];
      if (!name || !meta.license) continue;
      if (PERMITTED_COPYLEFT_PACKAGES.has(name)) continue;
      if (STRONG_COPYLEFT.test(meta.license)) {
        at(
          "package-lock.json",
          1,
          `strong-copyleft dependency not on the allowlist: ${name} (${meta.license})`,
        );
        continue;
      }
      if (!WEAK_COPYLEFT.test(meta.license)) continue;
      weakInTree.push(name);
      if (classification === null) {
        at(
          COMPONENT_MAP,
          1,
          `weak-copyleft dependency is unclassified, the classification table is unreadable: ` +
            `${name} (${meta.license})`,
        );
        continue;
      }
      if (!classification.some((row) => matchesRow(row, name))) {
        at(
          COMPONENT_MAP,
          1,
          `weak-copyleft dependency is unclassified in the component map: ${name} ` +
            `(${meta.license})`,
        );
      }
    }
  }

  if (classification) {
    for (const row of classification) {
      if (!weakInTree.some((name) => matchesRow(row, name))) {
        at(
          COMPONENT_MAP,
          row.line,
          `the weak-copyleft classification names a package that is not in the resolved tree: ` +
            `${row.pattern}`,
        );
      }
      if (row.pattern.endsWith("*") && row.pattern.length - 1 < MIN_WILDCARD_PREFIX) {
        at(
          COMPONENT_MAP,
          row.line,
          `a weak-copyleft classification wildcard is too broad to name a family: ${row.pattern}`,
        );
      }
    }
    /*
     * The heuristic's one remaining job: CONTRADICT a stale classification. It never permits.
     */
    const claimedAbsent = classification.filter((r) => !r.conveyed).map((r) => r.pattern);
    const visible = namesVisibleInDistributedOutput(
      tree.root,
      weakInTree.filter((n) => claimedAbsent.some((p) => matchesRow({ pattern: p, conveyed: false, line: 0 }, n))),
    );
    for (const name of visible) {
      at(
        COMPONENT_MAP,
        1,
        `the component map records ${name} as not reaching the distribution, and the ` +
          `${DRIFT_HEURISTIC} found its name in an emitted chunk`,
      );
    }
  }

  /*
   * 4. NO WHOLE-PRODUCT GPL CLAIM IN PACKAGE METADATA.
   *
   * Deliberately checks `package.json`'s `license` field and not the root `LICENSE` file. This
   * repository IS the historical GPL line and its root licence is correct as it stands; what must
   * never happen is the PROPRIETARY product carrying a GPL declaration. The check is therefore
   * conditional on the manifest claiming to be the proprietary product, which is what
   * the `decisionLabLicenseScope` field marks.
   */
  const pkgPath = join(tree.root, "package.json");
  if (existsSync(pkgPath)) {
    const raw = readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { license?: string; decisionLabLicenseScope?: string };
    if (pkg.decisionLabLicenseScope === "proprietary" && COPYLEFT_NOTICE.test(pkg.license ?? "")) {
      at(
        "package.json",
        raw.split("\n").findIndex((l) => l.includes('"license"')) + 1,
        `the proprietary product declares a copyleft licence: ${pkg.license}`,
      );
    }
  }

  /*
   * 5. THE COMPLIANCE RECORD IS STILL THERE.
   *
   * A conveyed GPL component owes a licence text and a notice. Deleting either is not a licensing
   * OPINION anybody would defend -- it is a file that went missing in a refactor.
   */
  for (const required of REQUIRED_COMPLIANCE_PATHS) {
    if (!existsSync(join(tree.root, required))) {
      at(required, 1, `required licence/compliance file is missing: ${required}`);
    }
  }

  /*
   * 6. THE CANONICAL COMPONENT MAP IS STILL THERE. A different loss from check 5: see COMPONENT_MAP.
   */
  if (!existsSync(join(tree.root, COMPONENT_MAP))) {
    at(COMPONENT_MAP, 1, `the canonical component licensing map is missing: ${COMPONENT_MAP}`);
  }

  /*
   * 7. THE ENGINE VERSION AND ITS COMPLIANCE RECORD AGREE.
   *
   * The failure this catches is mundane and is exactly why it needs a machine: a dependency bump
   * changes the conveyed engine, and the notices go on naming the old version, the old hashes and
   * the old corresponding source. The distribution is then out of compliance while every test is
   * green.
   */
  if (existsSync(lockPath) && existsSync(join(tree.root, "THIRD_PARTY_NOTICES.md"))) {
    const lock = JSON.parse(readFileSync(lockPath, "utf8")) as {
      packages?: Record<string, { version?: string }>;
    };
    const installed = Object.entries(lock.packages ?? {}).find(([p]) =>
      p.endsWith("node_modules/stockfish"),
    )?.[1]?.version;
    const notices = readFileSync(join(tree.root, "THIRD_PARTY_NOTICES.md"), "utf8");
    if (installed && !notices.includes(installed)) {
      at(
        "THIRD_PARTY_NOTICES.md",
        1,
        `stockfish@${installed} is installed and conveyed, and the notices do not name that version`,
      );
    }
  }

  return findings;
}

/**
 * The detectors the positive control must observe firing, each on its own.
 *
 * WHY THIS LIST IS EXPORTED RATHER THAN INLINED IN THE CONTROL. A control that asserts "the count
 * is above zero" proves that SOMETHING is detectable, which is what this gate's header check
 * already got away with once while being dead. Naming the detectors means adding a check without
 * proving it becomes a failure here rather than a silence.
 */
export const REQUIRED_DETECTORS = [
  { id: "paste-in-application", match: "copyleft notice in a proprietary path" },
  { id: "strong-copyleft-dependency", match: "strong-copyleft dependency not on the allowlist" },
  { id: "unclassified-weak-copyleft", match: "weak-copyleft dependency is unclassified" },
  { id: "manifest-declares-copyleft", match: "the proprietary product declares a copyleft licence" },
  { id: "compliance-material-deleted", match: "required licence/compliance file is missing" },
  { id: "component-map-deleted", match: "the canonical component licensing map is missing" },
  { id: "engine-version-disagreement", match: "is installed and conveyed, and the notices do not" },
] as const;
