/**
 * One authority per question, held against the tree.
 *
 * WHY A SCANNER AND NOT A DOCUMENT. `AUTHORITY_MAP.md` answers "who decides X?" for every question a
 * reader can ask, and it is prose. Prose is the one artefact here that no command reads, which is
 * the exact debt `register-scan.ts` was written to pay off for the debt register and
 * `research-scan.ts` for the research corpus. An authority map that nothing checks decays the same
 * way: the named authority is deleted, the competitor stops being scoped, the capability gap is
 * quietly closed and the record still says it is open.
 *
 * WHAT THIS CHECKS, AND WHAT IT CANNOT. It does not check that the right file was chosen as the
 * authority -- that is a judgement, and pinning a judgement to a string teaches the next editor to
 * edit the scanner. It checks the three things that rot on their own:
 *
 *   1. an authority that no longer exists;
 *   2. a competitor that was scoped and is not scoped any more;
 *   3. a CAPABILITY GAP that has quietly become a capability.
 *
 * THE THIRD ONE IS THE INTERESTING ONE and it is why this file exists rather than six new markdown
 * files. The process-mining study found six critical questions with no authority at all -- rollback,
 * observability, retention, supported runtimes, who may deploy, dependency upgrades -- and every one
 * of them is a question about a capability this repository does not have. A document cannot become
 * the authority for a capability that does not exist; writing `docs/ROLLBACK.md` would answer "who
 * decides how we roll back?" with a file that describes a rollback nobody can perform.
 *
 * So a capability gap is recorded as an ABSENCE with a trigger, in the repository's own `DEFER`
 * idiom, and the absence is CHECKED: if any of the named artefacts appears, this gate goes red,
 * because the gap has closed and the record is now the stale one. A gap you cannot claim without
 * evidence is a gap that cannot be used to look finished.
 *
 * THE REGISTRY IS THE DENOMINATOR. Thirty-six questions, from two rounds of the completeness attack
 * in `docs/consolidation-research/AUTHORITY_MAP_V2_ATTACK.md`. It may only grow. A question removed
 * to improve a ratio is the defect that made the first study report 24/24.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Finding } from "./gate-scan";

/** Why a question has no single current authority. The mission's classes, not invented ones. */
export type GapClass =
  | "RESOLVED"
  | "DOCUMENTATION_GAP"
  | "CAPABILITY_GAP"
  | "DERIVABLE_BUT_NOT_DERIVED"
  | "MULTIPLE_COMPETING_AUTHORITIES"
  | "DELIBERATELY_UNOWNED"
  | "EXTERNAL_AUTHORITY"
  | "UNKNOWN";

export type Resolution =
  /** One current authority. Every path must exist; every named competitor must carry its scoping marker. */
  | {
      kind: "ONE_CURRENT_AUTHORITY";
      authority: string[];
      scopedCompetitors?: { path: string; marker: string }[];
    }
  /** No capability, so no authority. The named artefacts must STAY absent, or the record is stale. */
  | { kind: "CAPABILITY_GAP"; absent: string[]; trigger: string }
  /**
   * An authority for PART of the question and none for the rest.
   *
   * Kept distinct from `ONE_CURRENT_AUTHORITY` so nothing reads as more resolved than it is. The
   * named paths are still checked for existence -- a partial authority that vanishes is worse than
   * one that was never claimed -- and the question stays outside the resolved count.
   */
  | { kind: "PARTIAL_AUTHORITY"; covers: string; authority: string[]; uncovered: string }
  /** Decided outside this repository. Something in the tree must point at it. */
  | { kind: "EXTERNAL_AUTHORITY"; where: string; pointerInTree: string }
  /** Owned by nobody on purpose. The reason must be written somewhere a reader will find it. */
  | { kind: "DELIBERATELY_UNOWNED"; why: string; writtenAt: string };

export interface AuthorityQuestion {
  id: string;
  question: string;
  gap: GapClass;
  resolution: Resolution;
}

const one = (authority: string[], scopedCompetitors?: { path: string; marker: string }[]):
  Resolution => ({ kind: "ONE_CURRENT_AUTHORITY", authority, scopedCompetitors });

/**
 * The thirty-six questions.
 *
 * Q01-Q24 are the rows `AUTHORITY_MAP.md` enumerated. Q25-Q32 are round one of the completeness
 * attack; Q33-Q36 are round two, which found four more after round one had "finished" -- which is
 * why the denominator is published as a lower bound rather than a measurement.
 */
export const AUTHORITY_QUESTIONS: AuthorityQuestion[] = [
  // ---------------------------------------------------------------- product and contract
  { id: "Q01", question: "What is the product's promise?", gap: "RESOLVED",
    resolution: one(["shared/promise.ts"]) },
  { id: "Q02", question: "What rule does everything rest on?", gap: "RESOLVED",
    resolution: one(["shared/interaction-mode.ts", "README.md"]) },
  { id: "Q03", question: "Which mode is the player in, and what does it permit?", gap: "RESOLVED",
    resolution: one(["shared/interaction-mode.ts"], [
      { path: "client/src/pages/Home.tsx", marker: "MODE" },
    ]) },
  { id: "Q04", question: "What should the player do next?", gap: "RESOLVED",
    resolution: one(["shared/next-action.ts"]) },
  { id: "Q05", question: "What may be said about a claim on screen?", gap: "RESOLVED",
    resolution: one(["shared/evidence-authority.ts"]) },
  { id: "Q06", question: "Which observations may an analysis read?", gap: "RESOLVED",
    resolution: one(["shared/evidence-policy.ts"]) },
  { id: "Q07", question: "What protocol may judge a claim?", gap: "RESOLVED",
    resolution: one(["shared/discovery/claim-class.ts", "shared/validation-protocol.ts"]) },
  { id: "Q08", question: "What did the player see at the reveal?", gap: "RESOLVED",
    resolution: one(["shared/reveal.ts"]) },
  { id: "Q09", question: "What is a learning rule's grade?", gap: "RESOLVED",
    resolution: one(["shared/record-service.ts"]) },

  // ---------------------------------------------------------------- debt, plan and process
  { id: "Q10", question: "What debt is currently open?", gap: "RESOLVED",
    resolution: one(["docs/MASTER_PRODUCT_DEBT.md"]) },
  { id: "Q11", question: "Which gates are enforced?", gap: "RESOLVED",
    resolution: one(["scripts/run_gates.ts"]) },
  { id: "Q12", question: "What is the state vocabulary for a debt row?", gap: "RESOLVED",
    resolution: one(["scripts/register-scan.ts"]) },
  { id: "Q13", question: "Which decision node is current, and what would reverse it?", gap: "RESOLVED",
    resolution: one(["docs/decisions/README.md"]) },
  { id: "Q14", question: "What is the interaction law set?", gap: "RESOLVED",
    resolution: one(["docs/INERTIAL_UX_LAWS.md"]) },
  { id: "Q15", question: "How much reality does a test run against?", gap: "RESOLVED",
    resolution: one(["scripts/test-level-scan.ts"], [
      { path: "tests/LEVELS.md", marker: "scan" },
    ]) },
  { id: "Q16", question: "May a debt row claim what it claims?", gap: "RESOLVED",
    resolution: one(["scripts/run_gates.ts"]) },

  // ---------------------------------------------------------------- research and evidence
  { id: "Q17", question: "What is the strongest permitted claim about the learning construct?", gap: "RESOLVED",
    resolution: one(["docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM.json"], [
      { path: "docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM.md", marker: ".json" },
    ]) },
  { id: "Q18", question: "What is the canonical engine-scored record?", gap: "RESOLVED",
    resolution: one(["research/harness-shipped/harness_report.json"]) },
  { id: "Q19", question: "Is a raw second the right unit for a blitz decision?", gap: "RESOLVED",
    resolution: one(["docs/research/TIME_REPRESENTATION_RESULTS.md"], [
      { path: "research/b2/as-published-75/harness_report.json", marker: "" },
    ]) },
  { id: "Q20", question: "What is the B3 verdict?", gap: "RESOLVED",
    resolution: one(["research/b3_population_expertise/results/verdict_repaired.json"], [
      { path: "research/b3_population_expertise/results/verdict.json", marker: "INVALID_EXPERIMENT" },
    ]) },
  { id: "Q21", question: "What is the identity of B3's frozen documents?", gap: "RESOLVED",
    resolution: one(["research/b3_population_expertise/results/FINAL_HOLDOUT_SEALED.json"], [
      {
        path: "research/b3_population_expertise/results/PREREGISTRATION_FREEZE.json",
        marker: "amended_sha256_superseded_by",
      },
    ]) },
  { id: "Q22", question: "What experiment is active?", gap: "RESOLVED",
    resolution: one(["docs/consolidation-research/BASELINE.md"]) },
  { id: "Q23", question: "What may the acquisition ledger record?", gap: "RESOLVED",
    resolution: one(["docs/ACQUISITION_EVIDENCE.md"]) },
  { id: "Q24", question: "What is legible versus what is wanted?", gap: "RESOLVED",
    resolution: one(["docs/VALUE_CLARITY.md"]) },

  // ---------------------------------------------------------------- round one of the attack
  {
    id: "Q25",
    question: "What defines the database schema?",
    gap: "RESOLVED",
    /*
     * WAS `MULTIPLE_COMPETING_AUTHORITIES`. Three artefacts answered this: the generated migrations
     * CI applies in order, `schema.ts` that drizzle-kit generates them from, and
     * `drizzle/0001_verified_learning.sql` -- a hand-numbered migration sitting OUTSIDE the
     * directory CI's glob reads, so it has never been applied by any pipeline.
     *
     * Column-by-column comparison settled it: all three tables it creates (`learning_rules`,
     * `learning_transfers`, `learning_transfer_results`) are IDENTICAL to their definitions in
     * `drizzle/migrations/0000_cold_titanium_man.sql`. It is not a rival schema, it is a leftover
     * that reads like one. Scoped rather than deleted, because a reader who finds it needs to be
     * told what happened to it, and `findUnscopedMigrations` below reddens if any future `.sql`
     * outside `drizzle/migrations/` fails to say the same.
     */
    resolution: one(["drizzle/migrations", "drizzle/schema.ts"], [
      { path: "drizzle/0001_verified_learning.sql", marker: "SUPERSEDED" },
    ]),
  },
  {
    id: "Q26",
    question: "How is a bad deployment rolled back?",
    gap: "RESOLVED",
    /*
     * WAS `CAPABILITY_GAP`. Vercel's rollback affordance existed and nothing here said when to
     * use it or what closed the incident. `docs/ROLLBACK.md` now does, and the evidence step is
     * mechanical: `deployed.yml` takes the commit the origin must be serving, the L6 suite binds
     * to it through `servesExpectedBuild`, and a control shows the binding fails on a mismatch.
     * `GATE-ROLLBACK-EVIDENCE` holds the four files to the document. The alias-moving rehearsal
     * is FIELD-REQUIRED and the document says it has not been done.
     */
    resolution: one(["docs/ROLLBACK.md", ".github/workflows/deployed.yml", "tests/deployment/origin.ts"]),
  },
  {
    id: "Q27",
    question: "Where do runtime errors go, and what is observable in production?",
    gap: "RESOLVED",
    /*
     * WAS `CAPABILITY_GAP`, absent `docs/OBSERVABILITY.md`, `server/_core/telemetry.ts` and
     * `client/src/lib/error-sink.ts`. All three now exist: every server failure is one structured
     * stderr line carrying a class, the platform request id and the build; the health body names
     * the build and the storage subsystem by role; browsers report an enumerated failure name and
     * nothing else to `/api/client-event`. The document states what the platform still does not
     * give (one-hour retention, no alerting) as EXTERNAL_CONFIGURATION_REQUIRED rather than as
     * solved, and `tests/docs/the-observability-vocabulary-is-written-down.test.ts` holds it to the
     * code.
     */
    resolution: one(["docs/OBSERVABILITY.md", "server/_core/telemetry.ts", "client/src/lib/error-sink.ts"]),
  },
  {
    id: "Q28",
    question: "What may the product record about a person, and what may it never record?",
    gap: "DERIVABLE_BUT_NOT_DERIVED",
    /*
     * `ACQUISITION_EVIDENCE.md` is a real authority for the acquisition ledger -- "opaque id +
     * enums + a counter. No FEN, no move, no confidence value, no typed text" -- and
     * `read_vocabulary.ts` states a rule locally about what the self-check drawer may hand over.
     * Neither answers the question for the decision record as a whole, and the answer IS derivable:
     * the columns are declared in `drizzle/schema.ts`.
     *
     * NOT RESOLVED, and deliberately not made to look resolved. `schema.ts` says what the record
     * CAN hold; the question asks what it MAY hold, and those differ by a policy nobody has
     * written. Naming both files as "the authority" would answer a question about permission with
     * a description of capacity, which is the move `AUTHORITY_MAP.md` v1 made when it counted
     * 24 of the 24 questions it had already answered.
     */
    resolution: {
      kind: "PARTIAL_AUTHORITY",
      covers: "the acquisition ledger, where ACQUISITION_EVIDENCE.md states the rule per event",
      authority: ["docs/ACQUISITION_EVIDENCE.md", "scripts/read_vocabulary.ts"],
      uncovered:
        "the decision record itself, which carries FENs, moves, confidences and free text with no " +
        "statement of what may never be recorded. drizzle/schema.ts declares what it CAN hold, " +
        "which is a different question.",
    },
  },
  {
    id: "Q29",
    question: "How long is a record kept, and how is it deleted?",
    gap: "CAPABILITY_GAP",
    resolution: {
      kind: "CAPABILITY_GAP",
      absent: ["docs/RETENTION.md", "scripts/purge.ts", "server/_core/retention.ts"],
      trigger:
        "the first record belonging to somebody who is not the author, or the first request to " +
        "delete one. There is no retention statement, no deletion path and no erasure procedure; " +
        "the only 'retention' in the tree is the retrieval-interval literature, a different word.",
    },
  },
  {
    id: "Q30",
    question: "Which browsers and runtimes are supported?",
    gap: "RESOLVED",
    /*
     * The tree carries the CONSEQUENCES of a baseline -- a 44 px tap floor, 200% zoom,
     * forced-colors, prefers-reduced-motion -- and the browser the layout tests actually run
     * against is pinned by Playwright. The baseline is derivable from what is enforced; it was
     * never stated. `docs/SUPPORTED_RUNTIMES.md` states it and names its derivation.
     */
    resolution: one(["docs/SUPPORTED_RUNTIMES.md", "package.json"]),
  },
  {
    id: "Q31",
    question: "What is the release identity, and what changed between two deployments?",
    gap: "RESOLVED",
    /* Answered by the build identity generated at build time; see TARGET 3. */
    resolution: one(["shared/build-identity.ts", "scripts/write-build-identity.ts"]),
  },
  {
    id: "Q32",
    question: "Who is authoritative for the reconstruction study's own numbers?",
    gap: "RESOLVED",
    /*
     * Repaired during Study v2 itself, before this mission: section B of the OS document is the
     * authority for law text and class, LAW_SUPPORT.json for the counts behind it, and selfcheck.py
     * holds every other study file against both. Counted UNRESOLVED in the frozen baseline because
     * that is what the baseline published; the reclassification is disclosed separately from this
     * mission's own changes in FINAL_REPORT.md.
     */
    resolution: one([
      "docs/consolidation-research/REPO_NATIVE_OPERATING_SYSTEM.md",
      "docs/consolidation-research/LAW_SUPPORT.json",
      "docs/consolidation-research/selfcheck.py",
    ]),
  },

  // ---------------------------------------------------------------- round two of the attack
  { id: "Q33", question: "What is the licence, and what may be reused?", gap: "RESOLVED",
    resolution: one(["LICENSE", "package.json"]) },
  {
    id: "Q34",
    question: "Who may deploy, and what approves a merge to the branch that deploys?",
    gap: "CAPABILITY_GAP",
    resolution: {
      kind: "CAPABILITY_GAP",
      absent: [".github/CODEOWNERS", "CODEOWNERS"],
      trigger:
        "the second person with write access. `main` is unprotected and Vercel deploys it on " +
        "push, so the gate that must pass is written down and who may cause it to run is not. A " +
        "CODEOWNERS file alone would not close this: it is inert without a branch protection rule, " +
        "which lives in repository settings rather than in this tree.",
    },
  },
  {
    id: "Q35",
    question: "What accessibility conformance target must the UI meet?",
    gap: "RESOLVED",
    /*
     * WCAG 2.2 AA is cited in seven documents and specific criteria are named and enforced -- 1.4.3,
     * 2.5.8, a 44 px tap floor, forced-colors, 200% zoom. The TARGET was never stated, so a
     * reviewer could not tell whether a new surface was compliant or merely unmentioned. Stated in
     * `docs/SUPPORTED_RUNTIMES.md` beside the runtime baseline, because they are the same question
     * asked of two different substrates.
     */
    resolution: one(["docs/SUPPORTED_RUNTIMES.md"]),
  },
  {
    id: "Q36",
    question: "How is a dependency upgraded, and what proves an upgrade safe?",
    gap: "RESOLVED",
    /*
     * WAS `CAPABILITY_GAP`, and its trigger fired: `npm audit` went red on `qs` with the fix
     * outside express's range, which is exactly the case "`npm audit fix` cannot" names. The
     * response is now written: `docs/DEPENDENCY_POLICY.md` says what proves an upgrade safe (the
     * `verify` job, nothing else), when an `overrides` entry is allowed (an advisory behind it),
     * and that an exception carries an expiry a test enforces. Dependabot proposes; actions are
     * pinned to commits.
     */
    resolution: one(["docs/DEPENDENCY_POLICY.md", ".github/dependabot.yml"]),
  },
];

const has = (root: string, path: string) => existsSync(join(root, path));
const read = (root: string, path: string) => readFileSync(join(root, path), "utf8");

/** An authority that is not in the tree, or a competitor that stopped being scoped. */
export function findBrokenAuthorities(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const q of AUTHORITY_QUESTIONS) {
    if (q.resolution.kind === "PARTIAL_AUTHORITY") {
      for (const path of q.resolution.authority) {
        if (!has(root, path)) {
          findings.push({
            file: "scripts/authority-scan.ts",
            line: 1,
            text: `${q.id} names ${path} as a partial authority, and it is not in the tree`,
          });
        }
      }
      continue;
    }
    if (q.resolution.kind !== "ONE_CURRENT_AUTHORITY") continue;
    for (const path of q.resolution.authority) {
      if (!has(root, path)) {
        findings.push({
          file: "scripts/authority-scan.ts",
          line: 1,
          text: `${q.id} names ${path} as an authority, and it is not in the tree`,
        });
      }
    }
    for (const competitor of q.resolution.scopedCompetitors ?? []) {
      if (!has(root, competitor.path)) continue;
      if (competitor.marker && !read(root, competitor.path).includes(competitor.marker)) {
        findings.push({
          file: competitor.path,
          line: 1,
          text:
            `${q.id}: this competes with ${q.resolution.authority[0]} and no longer carries ` +
            `\`${competitor.marker}\`, the marker that scoped it`,
        });
      }
    }
  }
  return findings;
}

/**
 * A capability gap that has quietly stopped being one.
 *
 * THIS IS THE PREDICATE THAT KEEPS THE CLASSIFICATION HONEST IN BOTH DIRECTIONS. A gap recorded and
 * never re-checked lets the repository keep saying it cannot roll back long after somebody wrote
 * the script; and it lets a reader who adds `docs/ROLLBACK.md` believe the question is answered
 * when the record still says otherwise. Either way two parts of the repository tell different
 * stories about the same reality, which is the whole thing this pass is against.
 */
export function findClosedCapabilityGaps(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const q of AUTHORITY_QUESTIONS) {
    if (q.resolution.kind !== "CAPABILITY_GAP") continue;
    for (const path of q.resolution.absent) {
      if (has(root, path)) {
        findings.push({
          file: path,
          line: 1,
          text:
            `${q.id} is recorded as a CAPABILITY_GAP and ${path} now exists. ` +
            `Either the gap closed and this record is stale, or the file is not what it looks like`,
        });
      }
    }
  }
  return findings;
}

/**
 * A `.sql` outside the directory CI applies, not declaring itself superseded.
 *
 * `verify-build.yml` states the rule in its own words -- "Schema from the generated SQL, not from a
 * hand-written file that can drift from schema.ts" -- and applies `drizzle/migrations/*.sql` in
 * order. A migration-shaped file anywhere else is never applied by any pipeline, so it can say
 * whatever it likes about the schema for as long as it exists. One does, and it is scoped; this
 * keeps the next one from not being.
 */
export function findUnscopedMigrations(root: string): Finding[] {
  const findings: Finding[] = [];
  const dir = join(root, "drizzle");
  if (!existsSync(dir)) return findings;
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".sql")) continue;
    const rel = join("drizzle", entry);
    const source = read(root, rel);
    if (!/SUPERSEDED/i.test(source)) {
      findings.push({
        file: rel,
        line: 1,
        text:
          "a migration outside drizzle/migrations/, which CI never applies, and it does not say " +
          "what superseded it",
      });
    }
  }
  return findings;
}

/** Every predicate, over one root. The gate is one call; the control is the same call, elsewhere. */
export function findAuthorityDrift(root: string): Finding[] {
  return [
    ...findBrokenAuthorities(root),
    ...findClosedCapabilityGaps(root),
    ...findUnscopedMigrations(root),
  ];
}

/** The counts the hardening report publishes, derived rather than asserted. */
export function authorityCoverage(): {
  total: number;
  resolved: number;
  byGap: Record<string, number>;
  mechanicallyChecked: number;
} {
  const byGap: Record<string, number> = {};
  for (const q of AUTHORITY_QUESTIONS) byGap[q.gap] = (byGap[q.gap] ?? 0) + 1;
  return {
    total: AUTHORITY_QUESTIONS.length,
    resolved: AUTHORITY_QUESTIONS.filter((q) => q.gap === "RESOLVED").length,
    byGap,
    mechanicallyChecked: AUTHORITY_QUESTIONS.filter((q) =>
      ["ONE_CURRENT_AUTHORITY", "CAPABILITY_GAP", "PARTIAL_AUTHORITY"].includes(q.resolution.kind),
    ).length,
  };
}
