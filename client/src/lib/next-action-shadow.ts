/**
 * SHADOW MODE: the derivation runs, and nothing on screen changes.
 *
 * WHY THIS STEP EXISTS AT ALL. `shared/next-action.ts` claims to know what a player should do next.
 * A claim of that shape is exactly the kind this repository does not let a screen act on until
 * something could have shown it wrong -- §23's rule about coaching, applied to the product's own
 * navigation. So the derivation runs beside the screen, its answer is written to the trial ledger,
 * and the screen goes on doing what it did.
 *
 * WHAT A DISAGREEMENT MEANS, AND WHY `blind` IS NOT OPTIONAL. Two very different things produce
 * one: the screen is wrong, or the surface could not supply an input the derivation needs. The
 * front door genuinely cannot see a half-finished drill -- that state lives in `Home.tsx`'s
 * component and does not survive navigating away, which is a LAW 4 defect of its own and not this
 * module's to fix. A shadow record that did not say which inputs were missing would be a list of
 * disagreements nobody could interpret.
 *
 * IT WRITES ONCE PER VISIT PER SURFACE. The ledger is a ring buffer in `localStorage` and this runs
 * on screens that re-render on every query settle; a row per render would evict the funnel events
 * the ledger exists for. One settled comparison per visit per surface is what the question needs.
 *
 * THREE SURFACES, AND THE FIRST VERSION HAD ONE. A shadow on the front door alone answers "does the
 * derivation agree with the front door", which is not the question -- the plan's sequencing is
 * ownership PER STATE, and a state nobody shadowed is a state nobody could hand over. The three are
 * the ones that ROUTE: the returning front door, the screen after a game, and the record.
 *
 * AND THE COMPARISON ITSELF MOVED OUT OF THIS FILE. It used to be
 * `kind === "play-first-decision" || kind === "play-blitz"` written here, which is true of the front
 * door, invisible to the other two screens and silent if a kind is added. `agreesWith` in
 * `shared/next-action.ts` is that correspondence stated once, over the closed act vocabulary three
 * gates already read.
 */
import { useEffect, useRef } from "react";
import { ANCHOR_POSITIONS } from "@shared/anchor-set";
import {
  agreesWith,
  observed,
  proposeNextAction,
  UNIMPLEMENTED,
  UNOBSERVED,
  type NextActionProposal,
  type Observed,
  type ProductState,
  type ShadowSurface,
} from "@shared/next-action";
import type {
  CommitmentRun,
  ContinuationReading,
  LiveLearningCommitment,
} from "@shared/continuation";
import {
  PRIMARY_ACTION_ATTR,
  PRIMARY_ACTIONS,
  type PrimaryAction,
} from "@shared/primary-action";
import type { BlitzReading } from "@shared/blitz-reading";
import type { StoredBlitzGame } from "@shared/blitz-record";
import { claimStateOf } from "@shared/claim-state";
import type { ClaimView, RecordReading } from "@shared/record-service";
import { recordTrialEvent, trialEventSeenOn } from "@/lib/progress-record";
import { useBlitzReading } from "@/lib/blitz-reading-api";
import { useBlitzAnalysis } from "@/lib/use-blitz-analysis";
import { useClaimView, useDecisionCount, useRecordReading } from "@/lib/record-api";
import { useContinuation } from "@/lib/continuation-api";

/**
 * Inputs each surface cannot supply, named so a disagreement can be read.
 *
 * NOT A TODO LIST. A drill and a transfer live in `Home.tsx`'s component state and do not survive
 * navigating away, so no other screen can see them -- that is a LAW 4 defect with its own row, and
 * naming it here is what keeps a disagreement it causes from being read as the derivation being
 * wrong. The other two are gaps with owners: an unseen-event set and an untested-rule query.
 *
 * ALL THREE LISTS ARE THE SAME TODAY, and the table says so rather than a single constant hiding
 * it. They are the same because the four gaps have nothing to do with which screen is asking: two
 * of them live in another component's state and two have no query anywhere in the product. A single
 * shared constant would make that look like a design rather than the coincidence it is, and would
 * quietly become wrong the first time one surface gains a reader the others lack.
 */
/**
 * THE ONE INPUT NO SURFACE CAN READ, BECAUSE NOTHING IN THE PRODUCT WRITES IT.
 *
 * `unseenEvent` HAS NO IMPLEMENTATION AND IS DELIBERATELY NOT BEING GIVEN ONE. There is no seen-set
 * anywhere in the repository -- no writer, no reader, no storage -- and building one to satisfy a
 * branch would be inventing infrastructure for an architecture rather than for a decision.
 * `docs/ARCHITECTURE_UI_AUTHORITY_TRANSFER.md` §"The event nobody has seen" records what behaviour
 * would justify it and what stays blind until then.
 *
 * IT IS NOT A TABLE ANY MORE, AND THAT IS THE CHANGE. This used to be a hand-maintained
 * `Record<ShadowSurface, string[]>` listing four blind inputs per surface, kept in step with
 * `productStateFor` by nothing but attention -- and it reached the LEDGER while the derivation went
 * on reading fabricated `null`s. Blindness is now carried by `Observed` in the state itself, and
 * `proposeNextAction` reports the prefix that actually mattered. A surface cannot claim to see
 * something it did not read, because the only way to say "I read it" is to hand over the value.
 */
export const UNIMPLEMENTED_INPUTS = ["unseenEvent"] as const;

/**
 * @deprecated The old name, kept until every reader is moved.
 *
 * IT WAS THE RIGHT LIST UNDER THE WRONG WORD. "Permanently unobserved" reads as a surface that
 * never gets round to looking, which is what put `blind: ["unseenEvent"]` under every branch below
 * it and made eight of eleven proposals unsound forever. The list did not change; what it means
 * did. See `Observed` in `shared/next-action.ts`.
 */
export const PERMANENTLY_UNOBSERVED = UNIMPLEMENTED_INPUTS;

/**
 * One commitment slot, as the derivation's highest-priority input.
 *
 * THE FOUR NON-ACTIVE STATES ARE NOT THE SAME ANSWER TO THE DERIVATION, AND THEY ARE THE SAME
 * ANSWER HERE, which is worth saying plainly because it looks like a collapse and is not.
 * `deriveNextAction` asks one question of this field -- is there a run to finish -- and
 * `completed`, `abandoned` and `none` all answer no. What separates them is what a SCREEN says to
 * the player, and no screen reads this value: they read the commitment itself.
 *
 * `unknown` IS THE ONE THAT MUST NOT COLLAPSE, and it does not. It becomes `UNOBSERVED`, which
 * makes the proposal unsound rather than making it say the record holds nothing -- the distinction
 * the whole `Observed` migration exists for.
 */
function liveRun<T>(
  commitment: LiveLearningCommitment,
  shape: (run: CommitmentRun) => T,
): Observed<T | null> {
  if (commitment.state === "unknown") return UNOBSERVED;
  return observed(commitment.state === "active" ? shape(commitment.run) : null);
}

/**
 * The state a surface can actually assemble, with everything it cannot left null.
 *
 * ONE ASSEMBLY FOR THREE SCREENS. It was `resumeProductState` and it took the front door's inputs;
 * the three surfaces read the same four hooks, so three copies of this would be three chances for
 * one of them to fill a field differently and produce a disagreement about the assembly rather than
 * about the screen.
 */
export function productStateFor(input: {
  reading: BlitzReading;
  games: readonly StoredBlitzGame[];
  decisionsOnRecord: number;
  record: RecordReading | undefined;
  /**
   * Whether the queue is mid-pass, from the caller's own subscription to it.
   *
   * PASSED IN, AND IT USED TO BE HARD-CODED `false` WITH A COMMENT SAYING WHY. The comment said
   * "whether the queue is mid-pass is a fact about a runner this screen does not subscribe to" --
   * and `ResumeScreen` calls `useBlitzAnalysis()` three lines above the call to this function. It
   * did subscribe. A shadow that reports a made-up input is not a weaker shadow, it is a shadow
   * whose disagreements are about itself, and this one would have told every `wait-analysis`
   * proposal that nothing was scoring.
   */
  analysisRunning: boolean;
  /**
   * The claim view, or `undefined` while it has not resolved.
   *
   * NOT A BLIND SPOT AND NOT A DEFAULT. `claimStateOf` answers `unread` to `undefined`, which is
   * what the derivation needs to hear; filling it with an empty record instead would tell a player
   * whose search has just separated something that nothing has been found. It is the one input this
   * assembly gained that costs nothing to supply: both live shadow surfaces are inside a tree that
   * already calls `useClaimView`, and react-query dedupes by key.
   */
  claim: ClaimView | undefined;
  /**
   * The open run and the untested rule, or `undefined` while the read has not settled.
   *
   * `undefined` BECOMES `UNOBSERVED` AND NOT `null`, and the whole migration turns on the
   * difference. `null` inside an observed reading is a record with no run in it; `UNOBSERVED` is a
   * screen that has not been told. The four fields this replaces had only the first value available
   * to them, so every shadow row ever written asserted the first while meaning the second.
   */
  continuation: ContinuationReading;
}): ProductState {
  const runs = input.continuation;
  return {
    /*
     * COUNTED FROM THE GAMES AND NOT FROM `stored - scored`. That subtraction folds `refused` and
     * `legacy-unknown` in with `pending`, and only the last of those is work the queue will do.
     */
    pendingAnalyses: input.games.filter((g) => g.analysisState === "pending").length,
    analysisRunning: input.analysisRunning,
    /*
     * TWO READINGS, REPORTED INDEPENDENTLY. This used to receive one pre-ranked `active` run and
     * split it here -- which meant that with a drill AND a transfer both open, the transfer was
     * reported as `observed(null)`: a POSITIVE claim that the record holds no open transfer, made
     * by an assembly that had just been told it does. That is the exact defect `Observed` exists to
     * make unrepresentable, reintroduced one layer up.
     *
     * The ranking was also in two places. `deriveNextAction` already puts `continue-drill` above
     * `continue-transfer`; pre-ranking them in the read made that ordering a fact two modules had
     * to agree about. Now the read reports what it found and the derivation decides, once.
     */
    drill: liveRun(runs.drill, (run) => ({
      drillId: run.runId,
      done: run.done,
      total: run.total,
    })),
    transfer: liveRun(runs.transfer, (run) => ({
      transferId: run.runId,
      done: run.done,
      total: run.total,
    })),
    unseenEvent: UNIMPLEMENTED,
    /*
     * OBSERVED ONLY WHEN THE COMMITMENTS WERE, because they come from the same request. Reporting
     * `observed(null)` here off an unread reading would tell the derivation that this record holds
     * no untested rule, on the authority of a query that had not come back.
     */
    untestedRule:
      runs.drill.state === "unknown" ? UNOBSERVED : observed(runs.untestedRule),
    claimState: claimStateOf(input.claim),
    blitzStanding: input.reading.standing,
    decisionsOnRecord: input.decisionsOnRecord,
    anchor: {
      answered: input.record?.anchorAnswered.length ?? 0,
      /*
       * THE CURRENT SET'S SIZE, which is the one thing here that could drift: `ANCHOR_SET_VERSION`
       * exists because the set can change, and a record answered under an older one would report a
       * shortfall against a set it never saw. It is acceptable in a shadow and would not be in a
       * screen, which is the sort of thing a shadow is for finding out.
       */
      total: ANCHOR_POSITIONS.length,
    },
  };
}

/**
 * The four readings a `ProductState` is made of, subscribed once.
 *
 * WHY A HOOK AND NOT FOUR CALLS PER SCREEN. Three surfaces shadow now, and the assembly is the part
 * that has already been wrong twice in this file -- `analysisRunning` hard-coded `false` beside a
 * screen that was subscribed to the queue, and `offered` a constant beside a screen that renders no
 * control on one of its states. Three copies of an assembly is three chances at a third.
 *
 * IT COSTS FOUR QUERIES THAT EVERY ONE OF THESE SCREENS ALREADY MAKES, and react-query dedupes them
 * by key, so a screen calling this and calling `useRecordReading` itself gets one request.
 *
 * `null` UNTIL THE BLITZ READING RESOLVES, which is not the same as an empty record: `blitzStanding`
 * has its own `null` for "not read yet" and `deriveNextAction` answers `none` to it. Returning a
 * state with a fabricated standing would be the assembly deciding, which is what this hook exists
 * not to do.
 *
 * AND UNTIL THE CLAIM READING SETTLES, WHICH IS THE SAME SENTENCE AND WAS MISSED WHEN THE FIFTH
 * READING ARRIVED. The two queries are independent -- `currentClaim` begins at `listAtoms` and the
 * blitz reading never touches it -- so the blitz data can be present while the claim is still in
 * flight. Passing `claim.data` then is passing `undefined`, which `claimStateOf` reads as `unread`,
 * and the derivation skips the branch that would have proposed a forward test.
 *
 * WHAT MADE THAT WORSE THAN A WRONG FRAME. `useNextActionShadow` writes once and sets `written` --
 * and `trialEventSeenOn` dedupes for the whole surface -- so the first proposal is the only one
 * ever recorded. A record holding a candidate could therefore be logged as `return-record` or
 * `play-blitz`, permanently, and the row would be a disagreement about the ASSEMBLY rather than
 * about the screen. `D22` found that exact shape twice in this file already, in `analysisRunning`
 * and in `offered`, and named it: a shadow that reports a made-up input is not a weaker shadow, it
 * is one whose disagreements are about itself.
 *
 * SETTLED RATHER THAN PRESENT, and the difference is the error path. `isLoading` is false once the
 * query has succeeded OR failed; gating on `claim.data` instead would hold the shadow silent
 * forever on a record that cannot be read. A failed read genuinely has not come back, `unread` is
 * the truthful state for it, and that is a different thing from one still arriving.
 */
export function useProductState(): ProductState | null {
  const blitz = useBlitzReading();
  const analysis = useBlitzAnalysis();
  const decisions = useDecisionCount();
  const record = useRecordReading();
  /*
   * THE CLAIM LANE, SUBSCRIBED HERE RATHER THAN PASSED IN. Both surfaces that shadow live already
   * hold this query -- `ResumeScreen` calls it for the finding it renders, and it sits inside
   * `Record`, which calls it too -- so the fifth reading costs one cache hit rather than one
   * request. `D22` refused to instrument the other two surfaces on page-weight grounds and that
   * argument is untouched: this adds no module to the entry graph that the front door did not
   * already import.
   */
  const claim = useClaimView();
  /*
   * THE RUN AND THE RULE, AND THEY ARE GATED THE SAME WAY THE CLAIM IS. `continuation.isLoading`
   * held open would hand `productStateFor` an `undefined` it reads as UNOBSERVED -- which is
   * truthful, and is also a permanently blind shadow if the gate were left off, because the write
   * happens once per visit and the first frame always precedes the response. Waiting for it settled
   * is what makes the top three branches of the ladder reachable at all.
   */
  const continuation = useContinuation();
  if (!blitz.data || claim.isLoading || continuation.isLoading) return null;
  return productStateFor({
    continuation: continuation.data,
    reading: blitz.data.reading,
    games: blitz.data.games,
    decisionsOnRecord: decisions.data?.decisions ?? 0,
    record: record.data,
    claim: claim.data,
    /*
     * THE QUEUE'S OWN PROGRESS. `scoring` is the game being worked on right now, so a non-null one
     * is the difference between "eleven games are waiting" and "eleven are waiting and one is being
     * scored" -- which is the whole of what `wait-analysis` says to the player.
     */
    analysisRunning: analysis.scoring !== null,
  });
}

/**
 * WHAT THE SCREEN IS ACTUALLY OFFERING, read off the markup rather than described by the caller.
 *
 * THE SAME SIGNAL THREE GATES READ. `data-primary-action` exists because "is this control the
 * primary one" was not answerable from the source, and the attribute is the answer. Reading it at
 * runtime is that answer asked of the DOM the player is looking at.
 *
 * AND IT IS WHY THIS IS NOT A PARAMETER. The first version took `offered` from the call site as
 * the constant `"play"`, so the front door logged a control on `nothing-scored` -- the one state
 * P1.5 made it deliberately go quiet on -- and every disagreement there was an artefact of this
 * file. A call site describing its own render is a second copy of a render condition, and the two
 * drift in exactly the direction that makes the shadow useless: towards agreeing with itself.
 *
 * THE FILTERS ARE THE GATE'S. A control inside a closed `<details>` or a `[hidden]` subtree is not
 * on offer, and counting it would make a disclosure look like a second product.
 *
 * MORE THAN ONE ACT IS SOMEBODY ELSE'S DEFECT. `GATE-ONE-PRIMARY-ACTION` owns that, and it fails
 * on it. Here the first is recorded, because a shadow that returned `null` on a screen offering two
 * things would be reporting silence where the screen is at its loudest.
 */
export function offeredAct(root: ParentNode): PrimaryAction | null {
  const control = [...root.querySelectorAll(`[${PRIMARY_ACTION_ATTR}]`)].find(
    (el) => !el.closest("details:not([open])") && !el.closest("[hidden]"),
  );
  const act = control?.getAttribute(PRIMARY_ACTION_ATTR) ?? null;
  return act !== null && (PRIMARY_ACTIONS as readonly string[]).includes(act)
    ? (act as PrimaryAction)
    : null;
}

/**
 * Run the derivation beside a screen and record what it would have said.
 *
 * RETURNS THE PROPOSAL so a test can assert it without reading `localStorage`, and the callers
 * ignore it -- which is the whole of what "shadow" means here.
 *
 * PASS `null` FOR `state` WHILE THIS SURFACE IS NOT THE ONE SHOWING. A screen renders long before
 * its reading resolves, and a comparison taken then is a comparison against a spinner.
 */
export function useNextActionShadow(
  surface: ShadowSurface,
  state: ProductState | null,
): NextActionProposal | null {
  const written = useRef(false);
  const proposal = state === null ? null : proposeNextAction(state);
  const kind = proposal?.action.kind ?? null;
  /*
   * SERIALISED SO THE EFFECT DEPENDS ON THE CONTENT RATHER THAN THE ARRAY IDENTITY. `blind` is
   * rebuilt on every render; keying the effect on the array itself would rewrite the row whenever
   * React re-rendered, and keying it on nothing would miss a surface that gained a reader.
   */
  const blindKey = proposal === null ? "" : proposal.blind.join(",");

  useEffect(() => {
    if (kind === null || written.current) return;
    if (trialEventSeenOn("next_action_shadow", surface)) {
      written.current = true;
      return;
    }
    written.current = true;
    const offered = offeredAct(document);
    recordTrialEvent({
      name: "next_action_shadow",
      at: new Date().toISOString(),
      surface,
      proposed: kind,
      offered,
      /*
       * THE EQUIVALENCE, AND IT IS NOT WRITTEN HERE. `agreesWith` maps a proposal onto the act a
       * control would have to name, over the same closed vocabulary the gates read -- so a screen
       * offering something the derivation cannot name is a disagreement by construction, and a
       * screen going quiet agrees with exactly the two proposals that are not acts.
       */
      agrees: agreesWith(kind, offered),
      /*
       * WHAT THE DERIVATION COULD NOT SEE ABOVE THIS PROPOSAL, from the derivation itself.
       *
       * IT USED TO BE A CONSTANT PER SURFACE and it was wrong in both directions. It named four
       * inputs on every row, including rows where the blind inputs ranked BELOW the branch that
       * fired -- `continue-drill` proposed by a screen that could see drills was logged as blind to
       * drills -- and it could not have noticed a surface that gained a reader, because the table
       * was maintained by hand. `proposal.blind` is the prefix that actually outranked this answer,
       * so an empty array is the sound case rather than an unmaintained one.
       */
      blind: blindKey === "" ? [] : blindKey.split(","),
    });
  }, [kind, surface, blindKey]);

  return proposal;
}
