/**
 * THE ARCHITECTURE→UI INVARIANTS, AS PREDICATES OVER A TREE.
 *
 * WHY PREDICATES OVER A TREE AND NOT ASSERTIONS ABOUT THIS REPOSITORY. Every gate here runs the
 * SAME function over two directories -- the real one and a fixture where the invariant is broken on
 * purpose -- so a control that goes red proves the predicate can detect the violation rather than
 * proving some weaker thing can. `scripts/gate-scan.ts` states the rule for the gates it serves and
 * this follows it.
 *
 * WHAT THESE CANNOT SEE, said so it is not mistaken for coverage: they read source and emitted
 * chunks. A surface that computes a product act at runtime from data, without naming an act in its
 * source, is invisible here. What they catch is DRIFT -- a hardcoded act, a second ranking table, a
 * presenter that renames an intent -- which is the failure that actually happens.
 */
import { actFor, type NextAction, type NextActionKind } from "./next-action.js";
import type { SurfacePresenter } from "./surface-offer.js";

export interface UiFinding {
  file: string;
  line: number;
  text: string;
}

/** Every kind the ladder can return. Kept here so a new kind fails a gate rather than a reader. */
export const ALL_KINDS: readonly NextActionKind[] = [
  "wait-analysis",
  "play-first-decision",
  "play-blitz",
  "review-event",
  "collect-more-evidence",
  "test-hypothesis",
  "test-claim",
  "continue-drill",
  "continue-transfer",
  "return-record",
  "none",
];

/**
 * A stub carrying every field any kind reads, so a presenter can be exercised without a record.
 *
 * ONE OBJECT FOR ALL KINDS, and the cast is the honest way to say so: `NextAction` is a
 * discriminated union and this is deliberately not one member of it. A per-kind builder would be a
 * second place that knows each kind's shape, and it would drift from the union it mirrors.
 */
export function stubAction(kind: NextActionKind): NextAction {
  return {
    kind,
    done: 1,
    total: 3,
    drillId: "d1",
    transferId: "t1",
    ruleId: "r1",
    claimId: "c1",
    gameId: "g1",
    ply: 7,
    games: 2,
    scoring: false,
    because: "no-games",
    needs: null,
    anchorAnswered: 3,
    anchorTotal: 8,
  } as unknown as NextAction;
}

/**
 * G1 -- every canonical kind intended for production has at least one renderer.
 *
 * `wait-analysis` AND `none` ARE EXPECTED TO HAVE NONE, and that is not an exemption bolted on: a
 * state with nothing to press is rendered as a sentence, which P1.5 argued for the engine backlog
 * and which `actFor` already encodes by returning `null`. The gate therefore asks the same question
 * `actFor` answers -- does this kind name an act -- and requires a renderer for exactly those.
 */
export function unrenderedKinds(presenters: readonly SurfacePresenter[]): UiFinding[] {
  const out: UiFinding[] = [];
  for (const kind of ALL_KINDS) {
    if (actFor(kind) === null) continue;
    const action = stubAction(kind);
    if (!presenters.some((present) => present(action) !== null)) {
      out.push({
        file: "shared/next-action.ts",
        line: 1,
        text: `canonical kind "${kind}" names an act and no surface presenter renders it`,
      });
    }
  }
  return out;
}

/**
 * G5 -- a presenter may reword an act and may not rename it.
 *
 * THE ONE THING A SURFACE MAY NOT DO. `label` and `because` are the surface's; `act` is copied from
 * `actFor` and is the architecture's. A presenter that returned a different act would be making a
 * product decision under the appearance of wording one -- the exact failure this whole migration
 * removes, arriving in the layer built to prevent it.
 */
export function renamedIntents(presenters: readonly SurfacePresenter[]): UiFinding[] {
  const out: UiFinding[] = [];
  for (const kind of ALL_KINDS) {
    const want = actFor(kind);
    const action = stubAction(kind);
    presenters.forEach((present, i) => {
      const offer = present(action);
      if (offer === null) return;
      if (offer.act !== want) {
        out.push({
          file: "shared/surface-offer.ts",
          line: 1,
          text: `presenter ${i} renders "${kind}" as act "${offer.act}", canonical act is "${String(want)}"`,
        });
      }
    });
  }
  return out;
}

/**
 * G3 -- an unknown or unimplementable input never becomes a positive answer.
 *
 * TWO DIRECTIONS, because a gate that only checked one would pass on a policy that answered
 * `unknown` to everything. An unread input must make the proposal unsound; an unimplementable one
 * must not, because nothing can outrank from a state the product cannot reach.
 */
export function fabricatedState(
  propose: (state: never) => { action: NextAction; blind: readonly string[] },
  build: (over: Record<string, unknown>) => never,
): UiFinding[] {
  const out: UiFinding[] = [];
  const unread = propose(build({ drill: { observed: false } }));
  if (unread.blind.length === 0) {
    out.push({
      file: "shared/next-action.ts",
      line: 1,
      text: "an unread drill produced a sound proposal: unknown became an answer",
    });
  }
  const unimplemented = propose(build({ unseenEvent: { observed: false, unimplemented: true } }));
  if (unimplemented.blind.includes("unseenEvent")) {
    out.push({
      file: "shared/next-action.ts",
      line: 1,
      text: "an unimplementable input was reported as blindness, which poisons every branch below it",
    });
  }
  return out;
}

/**
 * The files where a hardcoded product act is a decision somebody made and wrote down.
 *
 * EVERY ENTRY CARRIES ITS REASON, because an allowlist without reasons is a list of things nobody
 * re-examines. Two categories only:
 *
 *   THE IN-RUN LOOP. Once a player is inside a drill, a transfer, or a decision→commit→reveal
 *   cycle, "what happens next" is the protocol executing, not the policy routing. Advancing to
 *   position 4 of 8 is not a product decision; handing it to the ladder would put a policy between
 *   a player and the next board of a set they are already in, and the policy would answer
 *   `continue-drill` -- the state they are already in -- on every press.
 *
 *   THE COLD FRONT DOOR. `Record.tsx` renders the first-decision form when nothing has been
 *   measured. The canonical ladder provably agrees on that state -- no games, no decisions, so
 *   `play-first-decision` -- and `tests/shared/one-truth-many-surfaces.test.ts` asserts it rather
 *   than asserting it in prose. Reading the policy there would pull the whole reading chain into
 *   the entry chunk to answer a question about a record that by definition has nothing in it.
 */
export const LOCAL_ACT_ALLOWLIST: Readonly<Record<string, string>> = {
  "client/src/pages/Home.tsx": "in-run: the board advancing its own loop",
  "client/src/components/RevealPanel.tsx": "in-run: the reveal's continuation inside the cycle",
  "client/src/components/RevealFailure.tsx": "recovery: retry after an engine failure",
  "client/src/components/RevealNextPosition.tsx": "in-run: the bank's own next position",
  "client/src/components/CommitmentScreen.tsx": "in-run: submitting the decision being taken",
  "client/src/pages/Blitz.tsx": "in-run: the remembered time control on the setup screen",
  "client/src/pages/Record.tsx": "cold front door; the ladder provably agrees. See above",
  "client/src/components/ContinueCommitment.tsx":
    "canonical-derived: rendered only from `continuationOffer`, and `continue-run` is `actFor`'s " +
    "answer for both kinds it can receive",
};

/** Product acts. `commit-decision`, `answer-instrument` and `next-decision` are in-run, not routing. */
const PRODUCT_ACTS = [
  "play-blitz",
  "play-first-decision",
  "review-event",
  "continue-run",
  "test-hypothesis",
  "return-record",
];

/**
 * G2 / G7 -- a surface introducing a product act of its own, or a second table of them.
 *
 * ONE LITERAL IS A CONTROL; TWO OR MORE IS A TABLE. A file naming one product act may be rendering
 * a single canonical control; a file naming several is choosing between them, which is a ranking,
 * which is the second authority G7 forbids. The distinction is crude and it is the one that
 * separates `ContinueCommitment` (one act, canonical-derived) from `postGameWords` as it was
 * (three branches, three outcomes, no policy consulted).
 */
export function localProductPolicy(
  files: readonly { path: string; source: string }[],
): UiFinding[] {
  const out: UiFinding[] = [];
  for (const { path, source } of files) {
    const rel = path.replaceAll("\\", "/").replace(/^\.\//, "");
    const allowed = Object.keys(LOCAL_ACT_ALLOWLIST).some((k) => rel.endsWith(k));
    const named = new Set<string>();
    source.split("\n").forEach((line, i) => {
      for (const act of PRODUCT_ACTS) {
        if (!new RegExp(`primaryAction\\(\\s*["'\`]${act}["'\`]`).test(line)) continue;
        named.add(act);
        if (!allowed) {
          out.push({ file: rel, line: i + 1, text: `surface names the product act "${act}" itself` });
        }
      }
    });
    if (allowed && named.size > 1 && !rel.endsWith("RevealNextPosition.tsx") && !rel.endsWith("Home.tsx")) {
      out.push({
        file: rel,
        line: 1,
        text: `allowlisted file ranks ${named.size} product acts, which is a second decision table`,
      });
    }
  }
  return out;
}
