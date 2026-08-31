/**
 * Gate runner.
 *
 * Two modes:
 *   npm run gates            -- run every gate against the real code. Any FAIL exits non-zero.
 *   npm run gates:controls   -- run every gate against a deliberately-broken fixture.
 *                               Any control that does NOT go red exits non-zero, because a gate
 *                               that has never failed has not been shown to be a gate.
 *
 * A gate that cannot run reports NOT-MEASURED, which is distinct from PASS and is never
 * silently counted as success.
 */

// server/_core/env.ts snapshots process.env at module load, and the gates import server code
// transitively. These must be set before ANY server import, so they live at the top of the file.
process.env.JWT_SECRET ||= "gate-runner-secret";
process.env.OWNER_OPEN_ID ||= "gate-owner";

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ATOM_FIELDS } from "../shared/decision-atom";
import {
  findDenominatorlessPercents,
  findFakeValues,
  findStaticEngineImports,
  findUnimplementedAriaPatterns,
  sourceFiles,
  type Finding,
} from "./gate-scan";
import {
  findPendingWorkLeaks,
  findReadingsOutsideTheirSurface,
  findScreensWithTwoBoards,
  findSurfacesThatAskAgain,
} from "./inertia-scan";
import { findRegisterDrift } from "./register-scan";
import { BLITZ_BLOCKERS, type BlitzStanding } from "../shared/blitz-reading";
import {
  deriveNextAction,
  producesEvidence,
  type NextAction,
  type ProductState,
} from "../shared/next-action";

export type GateStatus = "PASS" | "FAIL" | "NOT-MEASURED";
export interface GateResult {
  status: GateStatus;
  detail: string;
}
export interface Gate {
  id: string;
  rule: string;
  description: string;
  /** Run against the real codebase. */
  run: () => Promise<GateResult> | GateResult;
  /** Run against a deliberately-broken fixture. MUST return FAIL for the gate to be valid. */
  positiveControl: () => Promise<GateResult> | GateResult;
}

const notMeasured = (detail: string): GateResult => ({ status: "NOT-MEASURED", detail });
const pass = (detail: string): GateResult => ({ status: "PASS", detail });
const fail = (detail: string): GateResult => ({ status: "FAIL", detail });

/**
 * Shared predicates. The gate and its positive control run the SAME predicate over DIFFERENT
 * input -- that is what makes the control meaningful. A control with its own weaker predicate
 * proves nothing.
 */
function isoPredicate(screen: string[], event: string[], report: string[]): GateResult {
  const canonical = [...ATOM_FIELDS].join(",");
  const layers: Array<[string, string[]]> = [
    ["screen", screen],
    ["event", event],
    ["report", report],
  ];
  for (const [name, fields] of layers) {
    if (fields.join(",") !== canonical) {
      const missing = ATOM_FIELDS.filter((f) => !fields.includes(f));
      return fail(
        `${name} layer does not carry the atom` +
          (missing.length ? ` -- missing: ${missing.join(", ")}` : ` -- got: ${fields.join(", ")}`),
      );
    }
  }
  return pass(`atom intact across screen, event, report (${ATOM_FIELDS.length} fields)`);
}

/**
 * Run one Vitest file and report its exit code as a gate result.
 *
 * Some gates must exercise client modules that import Vite-only `?url` assets (the 7MB wasm).
 * tsx cannot resolve those, so those gates delegate to Vitest, which has the transform pipeline.
 *
 * `only` narrows the run to one `describe` block, so two gates may share a file without sharing a
 * verdict. That matters for the positive controls more than for the runs: a control file holding
 * two defects goes red for EITHER of them, which would leave one of the two gates unproven -- red
 * for the wrong reason is not a proven gate.
 */
export const HARNESS_ERROR = "HARNESS ERROR:";

function runVitestFile(
  file: string,
  label: string,
  config?: string,
  only?: string,
): GateResult {
  const vitest = resolve("node_modules", "vitest", "vitest.mjs");
  const args = [vitest, "run", file];
  if (config) args.push("--config", config);
  if (only) args.push("-t", only);
  const result = spawnSync(process.execPath, args, { encoding: "utf8", stdio: "pipe" });
  /*
   * COLOUR STRIPPED BEFORE ANYTHING READS THIS, and it is not tidiness -- it was a CI-only red.
   *
   * Vitest colours its summary when `CI` is set, so on a runner "Test Files  1 passed" arrives as
   * `\x1b[2m Test Files \x1b[22m \x1b[1m\x1b[32m1 passed`. Every pattern below was written against
   * the plain text a pipe produces here, so the `only` guard read a perfectly green filtered run as
   * "no test matched" and turned two gates red on the runner and nowhere else -- the worst shape a
   * check can have, because the machine that decides is the one machine behaving differently.
   *
   * The same hazard applied to both `includes` and to the `AssertionError` search: a matcher that
   * assumes uncoloured output behaves differently in the one place it matters most.
   */
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.replace(
    // eslint-disable-next-line no-control-regex
    /\u001b\[[0-9;]*m/g,
    "",
  );

  if (result.error || result.status === null) {
    return fail(`${HARNESS_ERROR} ${result.error?.message ?? `no exit status from ${file}`}`);
  }

  // A control that never ran is not a control. Vitest exits 1 when it collects nothing, which
  // is indistinguishable from a real failure by exit code alone -- and would let a broken
  // harness masquerade as a red control, proving nothing.
  if (output.includes("No test files found")) {
    return fail(`${HARNESS_ERROR} no tests collected from ${file}`);
  }
  /*
   * A NAME FILTER THAT MATCHES NOTHING EXITS ZERO. Vitest skips the whole file and prints
   * "Test Files  1 skipped (1)" -- so a gate whose `describe` block is renamed would go green
   * forever, having run no assertion at all. That is the same hole as an uncollected file, one
   * level down, and it is the specific risk of splitting two gates across one file.
   */
  if (only && !/Test Files\s+\d+ passed/.test(output) && result.status === 0) {
    return fail(`${HARNESS_ERROR} no test in ${file} matched "${only}"`);
  }
  if (result.status === 0) return pass(`${label} (vitest: ${file})`);

  const reason = output
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.includes("superseded search") || line.includes("AssertionError"));
  return fail(reason?.slice(0, 110) ?? `${label} failed (vitest exited ${result.status})`);
}

/** Where the inertial controls live. Never scanned by a gate's real run. */
const INERTIA_FIXTURES = "tests/fixtures/inertia";

/** A whole repository in miniature, carrying the drifts the real registers actually had. */
const REGISTER_FIXTURES = "tests/fixtures/registers";

/** One shape for all four scanning gates: findings mean red, and each names its own file. */
const fromFindings = (findings: Finding[], clean: string): GateResult =>
  findings.length
    ? fail(findings.map((f) => `${f.file}:${f.line} ${f.text}`).join("; ").slice(0, 200))
    : pass(clean);

const readingsOutside = (roots: string[]) =>
  fromFindings(
    findReadingsOutsideTheirSurface(roots),
    "every reading of the record renders from a surface whose mode permits one",
  );

const twoBoards = (roots: string[]) =>
  fromFindings(findScreensWithTwoBoards(roots), "one board per screen");

const registerDrift = (root: string) =>
  fromFindings(
    findRegisterDrift(root),
    "debt register, laws, ledger and runner agree with the tree",
  );

const asksAgain = (roots: string[]) =>
  fromFindings(
    findSurfacesThatAskAgain(roots),
    "both configured surfaces read what the player already chose, and keep it",
  );

/**
 * THE TOOLBOX IS BEHIND ITS DOOR, in both senses (LAW 2, P1.7).
 *
 * `RecordExplorer` carries every reading of the record, so `GATE-DECISION-FOCUS` already forbids
 * those components anywhere else. What this adds is the door: the explorer must be rendered behind
 * a control the player presses AND behind a lazy chunk, because a surface that renders only on a
 * press has no business in the bytes every arrival downloads -- and because a toolbox that is
 * statically imported is one somebody can render unconditionally without noticing the cost.
 */
const toolboxBehindItsDoor = (roots: string[]): GateResult => {
  const findings: Finding[] = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, "utf8");
      const path = file.replaceAll("\\", "/");
      if (!/<RecordExplorer[\s/>]/.test(source)) continue;
      if (!/\{exploring && !runInProgress && \(/.test(source)) {
        findings.push({ file: path, line: 1, text: "the explorer renders without its control" });
      }
      if (!/lazyChunk\(\s*\(\)\s*=>\s*import\("@\/components\/RecordExplorer"\)/.test(source)) {
        findings.push({ file: path, line: 1, text: "the explorer is in the entry chunk" });
      }
    }
  }
  if (findings.length === 0 && roots.every((r) => r === INERTIA_FIXTURES)) {
    /*
     * A CONTROL THAT FINDS NOTHING IS NOT A RED CONTROL. The fixture must actually render the
     * explorer, or this gate would report "clean" over a directory that never mentions it.
     */
    return fail("the control fixture does not render the explorer at all");
  }
  return fromFindings(findings, "the toolbox is behind a control and behind a lazy chunk");
};

const pendingWork = (roots: string[], rootFile: string) =>
  fromFindings(
    findPendingWorkLeaks(roots, rootFile),
    "no screen owns a cancellable pass, and the root resumes what is pending",
  );

/**
 * WHETHER AN ACTION COULD ACTUALLY RESOLVE THE BLOCKER IT IS OFFERED FOR.
 *
 * ONE BLOCKER IS NOT ANSWERED BY PLAYING, and it is the one the product answered with "play
 * another game" for the whole of its life: `nothing-scored` means the games are stored and the
 * engine has not been over them, so another game grows the backlog that IS the blocker. Every
 * other blocker in `BLITZ_BLOCKERS` is a shortage of record, which more record does fix.
 *
 * THE PREDICATE IS ABOUT THE DIRECTION, NOT THE LABEL. It asks whether the proposed action
 * produces more evidence, and refuses that answer for the one blocker where more evidence is
 * exactly what is already waiting.
 */
function nextActionResolves(derive: (state: ProductState) => NextAction): GateResult {
  const base: ProductState = {
    pendingAnalyses: 0,
    analysisRunning: false,
    drill: null,
    transfer: null,
    unseenEvent: null,
    untestedRule: null,
    blitzStanding: null,
    decisionsOnRecord: 40,
    anchor: { answered: 8, total: 8 },
  };
  for (const because of BLITZ_BLOCKERS) {
    const standing: BlitzStanding = { may: false, because, readable: 4, needs: null };
    const unscored = because === "nothing-scored";
    const action = derive({
      ...base,
      blitzStanding: standing,
      /* The state each blocker actually describes: unscored games exist only for that one. */
      pendingAnalyses: unscored ? 3 : 0,
      decisionsOnRecord: because === "no-games" ? 0 : 40,
    });
    if (unscored && producesEvidence(action)) {
      return fail(
        `${because} is answered with "${action.kind}", which adds to the backlog that is the blocker`,
      );
    }
    if (!unscored && !producesEvidence(action)) {
      return fail(`${because} is a shortage of record and is answered with "${action.kind}"`);
    }
  }
  return pass(`all ${BLITZ_BLOCKERS.length} blockers are answered by something that resolves them`);
}

/**
 * Everything that can put a sentence in front of a player.
 *
 * These scanners ran over client/src only, which is narrower than the gate descriptions claim.
 * `shared/` is bundled into the client and builds rendered text directly -- claim-derivation.ts
 * writes the sentence of every claim -- and `server/` produces the messages that surface through
 * tRPC. A gate that cannot see two thirds of the render path is not measuring what it says.
 */
function renderPathFiles(): string[] {
  return [...sourceFiles("client/src"), ...sourceFiles("shared"), ...sourceFiles("server")];
}

function scanPredicate(label: string, findings: Finding[], scanned: number): GateResult {
  if (findings.length === 0) return pass(`${scanned} render-path files clean of ${label}`);
  const shown = findings
    .slice(0, 3)
    .map((f) => `${f.file}:${f.line}`)
    .join(", ");
  return fail(`${findings.length} instance(s) of ${label}: ${shown}`);
}

const ENGINE_FIELDS = [
  "engine_eval_cp",
  "engine_best_move",
  "engine_depth",
  "engine_source",
  "cp_loss",
];

function runTypeScript(config: string) {
  const tsc = resolve("node_modules", "typescript", "bin", "tsc");
  return spawnSync(process.execPath, [tsc, "--noEmit", "-p", config], {
    encoding: "utf8",
    stdio: "pipe",
  });
}

function noEngineOutputPredicate(label: string, payload: string): GateResult {
  const leaked = ENGINE_FIELDS.filter((field) => payload.includes(`"${field}"`));
  return leaked.length
    ? fail(`${label} leaked engine output before commit: ${leaked.join(", ")}`)
    : pass(`${label} carries no engine output`);
}

/** Boot the real app in-process and capture the pre-commit reveal payload. */
async function precommitRevealPayload(): Promise<string> {
  const { createApp } = await import("../server/app");
  const { MemoryRecordStore } = await import("../server/record");
  const { sdk } = await import("../server/_core/sdk");
  const token = await sdk.createSessionToken(process.env.OWNER_OPEN_ID!, { name: "Gate" });
  const app = createApp({ store: new MemoryRecordStore() });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((done) => server.once("listening", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/trpc/record.reveal`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        json: {
          decision_id: "99999999-9999-4999-8999-999999999999",
          result: {
            engine_eval_cp: 42,
            engine_best_move: "d2d4",
            engine_depth: 14,
            engine_source: "local_sf18",
            cp_loss: 0,
          },
        },
      }),
    });
    return await response.text();
  } finally {
    server.close();
  }
}

export const GATES: Gate[] = [
  {
    id: "GATE-ISO",
    rule: "3.1",
    description: "Every decision atom present in all three layers under identical field names.",
    run: async () => {
      const { CONFIDENCE_LEVELS } = await import("../shared/confidence");
      const { atomFieldNames, decisionAtomSchema } = await import("../shared/decision-atom");
      const { commitEventSchema } = await import("../server/recordRouter");
      const { MemoryRecordStore } = await import("../server/record");
      const store = new MemoryRecordStore();
      const id = "11111111-1111-4111-8111-111111111111";
      await store.commitDecision({
        decisionId: id,
        gameId: "g",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        ply: 0,
        phase: "opening",
        clockMsRemaining: null,
        purpose: "play",
        drillId: null,
        transferId: null,
        secondsTaken: 5,
        chosenMove: "e2e4",
        candidateMovesConsidered: ["e2e4"],
        statedRead: "k",
        statedUnknown: "u",
        confidence: 3,
        confidenceScale: CONFIDENCE_LEVELS,
        probeAssignment: "not-probed",
        legalMoves: 20,
        revealTiming: "per-decision",
        measurementProtocol: "instrumented-standard",
        protocolVersion: 1,
        analysisTiming: "during-play",
      });
      const atom = await store.getAtom(id);
      return isoPredicate(
        atomFieldNames(decisionAtomSchema),
        atomFieldNames(commitEventSchema).filter((f) => f !== "decision_id"),
        Object.keys(atom!),
      );
    },
    positiveControl: async () => {
      const { atomFieldNames, decisionAtomSchema } = await import("../shared/decision-atom");
      const { EVENT_MISSING_UNKNOWN } = await import("../tests/fixtures/broken-atoms");
      const screen = atomFieldNames(decisionAtomSchema);
      // Same predicate, broken event layer.
      return isoPredicate(screen, [...EVENT_MISSING_UNKNOWN], screen);
    },
  },
  {
    id: "GATE-NO-FAKE",
    rule: "R2",
    description: "No displayed value without provenance; no placeholder value in a render path.",
    run: () => {
      const files = renderPathFiles();
      return scanPredicate("a placeholder evaluation", findFakeValues(files), files.length);
    },
    positiveControl: () => {
      const files = sourceFiles("tests/fixtures/render");
      return scanPredicate("a placeholder evaluation", findFakeValues(files), files.length);
    },
  },
  {
    id: "GATE-DENOM",
    rule: "R1",
    description: "No percentage rendered without its denominator.",
    run: () => {
      const files = renderPathFiles();
      return scanPredicate(
        "a denominatorless percentage",
        findDenominatorlessPercents(files),
        files.length,
      );
    },
    positiveControl: () => {
      const files = sourceFiles("tests/fixtures/render");
      return scanPredicate(
        "a denominatorless percentage",
        findDenominatorlessPercents(files),
        files.length,
      );
    },
  },
  {
    id: "GATE-STALE",
    rule: "4.3",
    description: "A result rendered against an input it was not computed for is marked stale.",
    run: () =>
      runVitestFile(
        "tests/gates/stale.test.ts",
        "superseded searches discarded; results carry their FEN",
      ),
    positiveControl: () =>
      runVitestFile(
        "tests/fixtures/controls/stale.control.test.ts",
        "legacy superseding logic",
        "vitest.controls.config.ts",
      ),
  },
  {
    id: "GATE-MEASURE",
    rule: "R1",
    description: "A measurement that was never made changes no bucket, and no comparison set.",
    run: () =>
      runVitestFile(
        "tests/gates/measurement.test.ts",
        "unmeasured decisions enter neither a bucket nor its baseline",
      ),
    positiveControl: () =>
      runVitestFile(
        "tests/fixtures/controls/measurement.control.test.ts",
        "a missing think time read as zero",
        "vitest.controls.config.ts",
      ),
  },
  {
    id: "GATE-GRADE",
    rule: "3.3",
    description: "No claim renders above its grade.",
    run: () => runVitestFile("tests/gates/grade.test.tsx", "claims render at their grade, with n"),
    positiveControl: () =>
      runVitestFile(
        "tests/fixtures/controls/grade.control.test.tsx",
        "claim rendered without its grade",
        "vitest.controls.config.ts",
      ),
  },
  {
    id: "GATE-PREREG",
    rule: "R5",
    description: "A drill cannot start without a stored refutation_condition AND direction.",
    run: () =>
      runVitestFile(
        "tests/gates/prereg.test.ts",
        "drills require a stored refutation condition and direction",
      ),
    positiveControl: () =>
      runVitestFile(
        "tests/fixtures/controls/prereg.control.test.ts",
        "drill starter with no pre-registration check",
        "vitest.controls.config.ts",
      ),
  },
  {
    id: "GATE-EXTERNAL",
    rule: "R4",
    description: "An external pointer cannot raise a claim's grade.",
    run: () => {
      // The gate: attempting the promotion must be a COMPILE error, not a runtime one.
      // Section 5 is explicit -- if it compiles and returns normally, the type design is wrong.
      const result = runTypeScript("tsconfig.nocompile.json");
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
      if (result.error || result.status === null) {
        return fail(`${HARNESS_ERROR} ${result.error?.message ?? "TypeScript returned no status"}`);
      }
      if (result.status === 0) {
        return fail("promoting a claim from an ExternalPointer COMPILED -- the types are wrong");
      }
      const errors = output.split("\n").filter((line) => line.includes("error TS")).length;
      return pass(`promotion from a pointer is a compile error (${errors} rejected)`);
    },
    positiveControl: () => {
      // Invert the same predicate: a file that DOES compile must not be accepted as proof.
      const result = runTypeScript("tsconfig.nocompile-control.json");
      if (result.error || result.status === null) {
        return fail(`${HARNESS_ERROR} ${result.error?.message ?? "TypeScript returned no status"}`);
      }
      if (result.status === 0) {
        return fail("a permissive promotion path compiled -- exactly what R4 forbids");
      }
      return pass("control did not compile, so it proves nothing");
    },
  },
  {
    id: "GATE-COMMIT",
    rule: "R3",
    description: "No engine output reaches the client before a decision is recorded.",
    run: async () => {
      // Two ways the engine can reach the client before a decision is recorded: the reveal
      // payload answering early, and the engine module being pulled into the initial graph.
      const payload = noEngineOutputPredicate("pre-commit reveal", await precommitRevealPayload());
      if (payload.status !== "PASS") return payload;
      const files = renderPathFiles();
      const staticImports = findStaticEngineImports(files);
      if (staticImports.length) {
        return fail(
          `engine module statically imported into the render path: ${staticImports
            .map((f) => `${f.file}:${f.line}`)
            .join(", ")}`,
        );
      }
      return pass(`${payload.detail}; engine module absent from the initial graph`);
    },
    positiveControl: async () => {
      const staticImports = findStaticEngineImports(sourceFiles("tests/fixtures/render"));
      if (staticImports.length) {
        return fail(
          `engine module statically imported into the render path: ${staticImports
            .map((f) => `${f.file}:${f.line}`)
            .join(", ")}`,
        );
      }
      const { PRE_COMMIT_LEAK } = await import("../tests/fixtures/broken-atoms");
      // Same predicate, a payload that answers before the decision was recorded.
      return noEngineOutputPredicate("pre-commit reveal", JSON.stringify(PRE_COMMIT_LEAK));
    },
  },
  {
    id: "GATE-SHUFFLE",
    rule: "6",
    description: "The pattern detector finds nothing above threshold in shuffled labels.",
    run: async () => {
      const { shuffleVerdict, noiseRecord } = await import("../tests/fixtures/shuffle-scenario");
      const { DEFAULT_THRESHOLDS } = await import("../shared/detector");
      return shuffleVerdict(noiseRecord, DEFAULT_THRESHOLDS, pass, fail);
    },
    positiveControl: async () => {
      const { shuffleVerdict, noiseRecord, PERMISSIVE_THRESHOLDS } =
        await import("../tests/fixtures/shuffle-scenario");
      // Same predicate, the thresholds this build started with. They found structure in noise.
      return shuffleVerdict(noiseRecord, PERMISSIVE_THRESHOLDS, pass, fail);
    },
  },
  {
    id: "GATE-SHUFFLE-REAL",
    rule: "6",
    description:
      "The same control, on records with the shape real decisions have rather than a uniform one.",
    run: async () => {
      const { shuffleVerdict, realShapedRecord } =
        await import("../tests/fixtures/shuffle-scenario");
      const { DEFAULT_THRESHOLDS } = await import("../shared/detector");
      return shuffleVerdict(realShapedRecord, DEFAULT_THRESHOLDS, pass, fail);
    },
    positiveControl: async () => {
      const { shuffleVerdict, realShapedRecord, PERMISSIVE_THRESHOLDS } =
        await import("../tests/fixtures/shuffle-scenario");
      return shuffleVerdict(realShapedRecord, PERMISSIVE_THRESHOLDS, pass, fail);
    },
  },
  {
    id: "GATE-WORST-BUCKET",
    rule: "6",
    description:
      "The weakest-bucket comparison names no bucket on records where the outcome is permuted.",
    run: async () => {
      const { worstBucketVerdictReport, IMPORT_RECORDS, verdictAt } =
        await import("../tests/fixtures/worst-bucket-scenario");
      return worstBucketVerdictReport(IMPORT_RECORDS, verdictAt(2), pass, fail);
    },
    positiveControl: async () => {
      const { worstBucketVerdictReport, IMPORT_RECORDS, verdictAt, PERMISSIVE_STANDARD_ERRORS } =
        await import("../tests/fixtures/worst-bucket-scenario");
      // The same code at the textbook one-standard-error bar, which finds weakness in noise.
      return worstBucketVerdictReport(
        IMPORT_RECORDS,
        verdictAt(PERMISSIVE_STANDARD_ERRORS),
        pass,
        fail,
      );
    },
  },
  {
    id: "GATE-REACHABILITY",
    rule: "4.6",
    description:
      "From an empty record a newcomer can reach a measurement, and no bucket is promised a test the protocol cannot run.",
    run: () =>
      runVitestFile(
        "tests/gates/reachability.test.ts",
        "the front door reaches a scored decision; registrable means collectible",
      ),
    positiveControl: () =>
      runVitestFile(
        "tests/fixtures/controls/reachability.control.test.ts",
        "a front door that draws, and registrability by membership alone",
        "vitest.controls.config.ts",
      ),
  },
  {
    id: "GATE-KEYBOARD",
    rule: "4.7",
    description: "No element declares an ARIA pattern the file it lives in does not implement.",
    run: async () => {
      /*
       * BOTH HALVES OF THIS GATE WERE LIVE WHEN IT WAS WRITTEN, which is the argument for it.
       * `.board-grid` declared `role="grid"` and the component handled no key, so assistive
       * technology switched into grid mode and offered arrow navigation that did nothing.
       * `Overlay` declared `aria-modal="true"` and let Tab walk into the document it had just
       * told the reader was not there. Neither was caught by anything: every other gate here
       * reads code for a claim about MEASUREMENT, and these are claims about INTERACTION.
       */
      const findings = findUnimplementedAriaPatterns(sourceFiles("client/src"));
      if (findings.length) {
        return fail(
          `ARIA pattern declared but not implemented: ${findings
            .map((f) => `${f.file}:${f.line} (${f.text})`)
            .join("; ")}`,
        );
      }
      return pass("every declared keyboard pattern has a handler in the file that declares it");
    },
    positiveControl: async () => {
      const findings = findUnimplementedAriaPatterns(sourceFiles("tests/fixtures/aria"));
      if (findings.length) {
        return fail(
          `${findings.length} unimplemented pattern(s): ${findings
            .map((f) => `${f.file}:${f.line}`)
            .join(", ")}`,
        );
      }
      return pass("the broken fixtures went unnoticed");
    },
  },
  {
    id: "GATE-NOTICE",
    rule: "L1",
    description: "Every third-party component the build conveys has a notice that travels with it.",
    run: async () => {
      const { noticeGaps, fontFamiliesIn } = await import("./notice_coverage");
      /*
       * WHAT THIS GATE IS ABOUT, AND WHY IT IS NOT A LINT ON `node_modules`.
       *
       * The build ships a 7.3 MB GPL-3.0 engine and nine OFL font files to whoever loads the page,
       * and for the whole life of this repository nothing travelled with them: no licence text, no
       * copyright line, no pointer to corresponding source. Every other gate here protects the
       * player from a claim the record cannot support. This one protects the people whose work
       * this build hands on.
       *
       * The conveyed set is READ FROM THE TREE. A hardcoded list is what stops noticing.
       */
      const conveyed = [
        {
          id: "stockfish",
          version: JSON.parse(readFileSync("node_modules/stockfish/package.json", "utf8")).version,
          licenceFile: "client/public/licenses/stockfish/COPYING.txt",
        },
        ...fontFamiliesIn(readdirSync("client/public/fonts")).map((family) => ({
          id: family,
          version: null,
          licenceFile: `client/public/licenses/fonts/${family}/OFL.txt`,
        })),
      ];
      const gaps = noticeGaps(conveyed, readFileSync("THIRD_PARTY_NOTICES.md", "utf8"), existsSync);
      if (gaps.length > 0) {
        return fail(gaps.map((gap) => `${gap.reason}: ${gap.detail}`).join("; "));
      }
      return pass(
        `${conveyed.length} conveyed component(s) named, versioned and served their licence`,
      );
    },
    positiveControl: async () => {
      const { noticeGaps } = await import("./notice_coverage");
      // Same predicate, a tree that conveys a font nobody wrote a notice for -- which is the way
      // this goes wrong in practice: a typeface is added and the paperwork is not.
      const gaps = noticeGaps(
        [
          { id: "stockfish", version: "99.0.0", licenceFile: "client/public/licenses/stockfish/COPYING.txt" },
          { id: "a-typeface-nobody-declared", version: null, licenceFile: "client/public/licenses/fonts/nope/OFL.txt" },
        ],
        readFileSync("THIRD_PARTY_NOTICES.md", "utf8"),
        existsSync,
      );
      if (gaps.length === 0) {
        return pass("an undeclared font and a wrong version both passed -- the check is not a check");
      }
      return fail(gaps.map((gap) => `${gap.reason}: ${gap.detail}`).join("; "));
    },
  },

  /*
   * THE INERTIAL GATES (docs/INERTIAL_UX_LAWS.md).
   *
   * A DIFFERENT KIND OF CLAIM FROM THE FIFTEEN ABOVE, and the same kind underneath. Every gate
   * before this point reads code for a claim about a MEASUREMENT. These read code for a claim
   * about a STATE: which surfaces may exist while a player is in one.
   *
   * LAW 1 IS WHY THEY BELONG HERE RATHER THAN IN A TEST FILE. A confidence stated in front of a
   * panel describing that player's calibration is not a measurement of what they believed -- so
   * "which panel is on screen while a decision is open" is a validity question wearing a layout
   * question's clothes. And it is violated by ADDING something, anywhere, at any time: a test
   * asserts that a screen is right today, a gate asserts that no screen has become wrong.
   *
   * `GATE-EXPOSURE-CONTEXT` IS DELIBERATELY ABSENT. `docs/decisions/D21-feedback-exposure.md`
   * found that decisions taken after a player has seen feedback pool with decisions taken before,
   * that no field could separate them, and that choosing between the three possible contracts
   * before any measurement would be exactly the blind change the audit exists to prevent. A gate
   * over a schema nobody has chosen would be a gate over nothing.
   */
  {
    id: "GATE-DECISION-FOCUS",
    rule: "LAW 1",
    description:
      "A reading of the record renders only from a surface whose mode permits prior evidence.",
    run: () => readingsOutside(["client/src"]),
    positiveControl: () => readingsOutside([INERTIA_FIXTURES]),
  },
  {
    id: "GATE-ONE-BOARD-ONE-STORY",
    rule: "LAW 11",
    description: "No screen renders two boards, because two boards is two answers to 'where am I'.",
    run: () => twoBoards(["client/src"]),
    positiveControl: () => twoBoards([INERTIA_FIXTURES]),
  },
  {
    id: "GATE-REUSE-CONFIG",
    rule: "LAW 8",
    description: "A surface that starts a run reads the answer the player already gave, and keeps it.",
    run: () => asksAgain(["client/src"]),
    positiveControl: () => asksAgain([INERTIA_FIXTURES]),
  },
  {
    id: "GATE-PENDING-WORK-LIVENESS",
    rule: "LAW 4",
    description:
      "No screen owns a whole-game analysis it can cancel, and the root picks up what is pending.",
    run: () => pendingWork(["client/src"], "client/src/App.tsx"),
    positiveControl: () => pendingWork([INERTIA_FIXTURES], `${INERTIA_FIXTURES}/App.tsx`),
  },
  {
    id: "GATE-NEXT-ACTION-RESOLVES-BLOCKER",
    rule: "LAW 3",
    description: "Every blocker's proposed next action is one that could actually resolve it.",
    run: () => nextActionResolves(deriveNextAction),
    positiveControl: () =>
      /*
       * THE DERIVATION AS IT USED TO BE, WHICH IS `readResume`'s TABLE. Every blocker answered by
       * "play another game" -- including `nothing-scored`, where the games are stored and the
       * engine has not been over them, so another game grows the backlog that IS the blocker.
       * The control is not a contrived function; it is the mapping this product shipped.
       */
      nextActionResolves(() => ({ kind: "play-blitz", because: "nothing-scored", needs: null })),
  },
  {
    id: "GATE-ONE-PRIMARY-ACTION",
    rule: "LAW 2",
    description: "A state offers at most one primary action.",
    /*
     * RENDERED RATHER THAN SCANNED, and that is what makes it a gate over a STATE. Every other
     * inertial gate reads source, which can say where a component lives but not how many controls
     * a player is looking at. Two controls are each correct on their own; the defect is that there
     * are two, and only a rendered screen can count.
     */
    run: () =>
      runVitestFile(
        "tests/gates/primary-action.test.tsx",
        "every state offers at most one act",
        undefined,
        "GATE-ONE-PRIMARY-ACTION",
      ),
    positiveControl: () =>
      runVitestFile(
        "tests/fixtures/controls/primary-action.control.test.tsx",
        "a front door offering two products",
        "vitest.controls.config.ts",
        "GATE-ONE-PRIMARY-ACTION",
      ),
  },
  {
    id: "GATE-NO-DUPLICATE-ACTION",
    rule: "LAW 2",
    description: "No state renders the same act twice, and no control names an act off the list.",
    /*
     * A SEPARATE GATE BECAUSE IT IS A SEPARATE DEFECT, and the split is not bookkeeping: the two
     * were one gate over one file, so its control went red whenever EITHER defect was present.
     * Fixing the front door alone would have left that control red on the reveal's duplicate and
     * the front-door gate unproven -- a control red for the wrong reason proves nothing. Two
     * controls, two reasons, one file each side.
     *
     * And the distinction is the one `shared/primary-action.ts` exists for. Two controls naming
     * two acts is a state asking the player to choose a product; two controls naming the SAME act
     * is one offer drawn twice. A boolean `isPrimary` could not tell them apart, which is why the
     * attribute carries the act.
     */
    run: () =>
      runVitestFile(
        "tests/gates/primary-action.test.tsx",
        "no act is offered twice, and every act is in the vocabulary",
        undefined,
        "GATE-NO-DUPLICATE-ACTION",
      ),
    positiveControl: () =>
      runVitestFile(
        "tests/fixtures/controls/primary-action.control.test.tsx",
        "a reveal offering one act twice",
        "vitest.controls.config.ts",
        "GATE-NO-DUPLICATE-ACTION",
      ),
  },
  {
    id: "GATE-TOOLBOX-OUTSIDE-FOCUS",
    rule: "LAW 2",
    description: "The record's toolbox renders only from EXPLORE, behind a control and a lazy chunk.",
    run: () => toolboxBehindItsDoor(["client/src"]),
    positiveControl: () => toolboxBehindItsDoor([INERTIA_FIXTURES]),
  },
  {
    id: "GATE-ENGINE-FAILURE-DISTINCT",
    rule: "R-09",
    description: "No two causes of an engine failure render the same sentence.",
    /*
     * R-09 WAS BLOCKED ON EXACTLY THIS. The scan failed on a deployment, two real defects on that
     * path were found and fixed, and neither could be shown to be the reporter's -- because the
     * screen they saw was one fallback sentence that six different causes reach, with fixes that
     * have nothing in common. A disclosure holding the raw text lets a reader paste something; it
     * does not let anyone say what to do.
     */
    run: () =>
      runVitestFile("tests/gates/engine-failure.test.ts", "each cause of an engine failure says its own thing"),
    positiveControl: () =>
      runVitestFile(
        "tests/fixtures/controls/engine-failure.control.test.ts",
        "six causes rendering the one sentence the scan shipped with",
        "vitest.controls.config.ts",
      ),
  },
  {
    id: "GATE-CLAIM-ANCHOR",
    rule: "L2",
    description: "A debt row may not claim more reality than its proof ever ran against.",
    /*
     * ONE WAVE SHIPPED FIVE DEFECTS THAT 246 GREEN TESTS DID NOT SEE, and not one of the five was a
     * wrong test: each looked at a faithful shadow of the thing and was read as evidence about the
     * thing. `tests/LEVELS.md` is the ladder and the five worked examples; this is the part that
     * runs. A ratchet rather than a bar, because seven rows are under-anchored today and a gate
     * that is red on the day it is written gets deleted rather than met.
     */
    run: () =>
      runVitestFile("tests/gates/claim-anchor.test.ts", "no claim outruns the rung its proof stands on"),
    positiveControl: () =>
      runVitestFile(
        "tests/fixtures/controls/claim-anchor.control.test.ts",
        "a P0 proven at L1, and a level asserted with no reason",
        "vitest.controls.config.ts",
      ),
  },
  {
    id: "GATE-REGISTER-RECONCILED",
    rule: "R-01",
    description: "The four registers agree with the tree and with each other.",
    /*
     * THE ONE ARTEFACT NO COMMAND READ. Every other claim in this repository is executed, measured,
     * or asserted by a test. The registers -- which are where a reader goes to find out what is
     * still open -- were the exception, and one hand reconciliation found four drifts in a single
     * wave, including a P0 that had been found, fixed, written up in the laws, and never given a
     * debt row at all. R-01 is the row that says one register answers "what is open?"; this is what
     * keeps that true after the day it was written.
     */
    run: () => registerDrift("."),
    positiveControl: () => registerDrift(REGISTER_FIXTURES),
  },
];

const ICON: Record<GateStatus, string> = {
  PASS: "PASS ",
  FAIL: "FAIL ",
  "NOT-MEASURED": "N/M  ",
};

async function main() {
  const controlMode = process.argv.includes("--positive-controls");
  const header = controlMode
    ? "Gate positive controls -- every gate must go RED here"
    : "Gates -- real codebase";
  console.log(`\n${header}\n${"-".repeat(header.length)}`);

  const tally: Record<GateStatus, number> = { PASS: 0, FAIL: 0, "NOT-MEASURED": 0 };
  let invalidControls = 0;

  for (const gate of GATES) {
    const result = await (controlMode ? gate.positiveControl() : gate.run());
    tally[result.status] += 1;
    console.log(`${ICON[result.status]} ${gate.id.padEnd(14)} [${gate.rule}] ${result.detail}`);
    // In control mode a gate that does not go red has not been shown to be a gate.
    if (controlMode && result.status === "PASS") {
      invalidControls += 1;
      console.log(`      ^^ control did NOT go red -- ${gate.id} is not proven to be a gate`);
    }
    if (controlMode && result.detail.startsWith(HARNESS_ERROR)) {
      invalidControls += 1;
      console.log(`      ^^ control never ran -- ${gate.id} red for the wrong reason`);
    }
  }

  console.log(
    `\n${GATES.length} gates: ${tally.PASS} pass, ${tally.FAIL} fail, ${tally["NOT-MEASURED"]} not-measured`,
  );

  if (controlMode) {
    if (invalidControls > 0) {
      console.error(`\n${invalidControls} positive control(s) failed to go red.`);
      process.exit(1);
    }
    console.log("All implemented controls went red.");
    return;
  }

  if (tally.FAIL > 0) {
    console.error(`\n${tally.FAIL} gate(s) red.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Gate runner crashed:", error);
  process.exit(1);
});
