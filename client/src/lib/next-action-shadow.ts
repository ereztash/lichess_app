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
  deriveNextAction,
  type NextAction,
  type ProductState,
  type ShadowSurface,
} from "@shared/next-action";
import {
  PRIMARY_ACTION_ATTR,
  PRIMARY_ACTIONS,
  type PrimaryAction,
} from "@shared/primary-action";
import type { BlitzReading } from "@shared/blitz-reading";
import type { StoredBlitzGame } from "@shared/blitz-record";
import type { RecordReading } from "@shared/record-service";
import { recordTrialEvent, trialEventSeenOn } from "@/lib/progress-record";
import { useBlitzReading } from "@/lib/blitz-reading-api";
import { useBlitzAnalysis } from "@/lib/use-blitz-analysis";
import { useDecisionCount, useRecordReading } from "@/lib/record-api";

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
export const SURFACE_BLIND_SPOTS: Record<ShadowSurface, readonly string[]> = {
  resume: ["drill", "transfer", "unseenEvent", "untestedRule"],
  "post-game": ["drill", "transfer", "unseenEvent", "untestedRule"],
  record: ["drill", "transfer", "unseenEvent", "untestedRule"],
};

/** Kept for the tests and readers that named it before the surfaces were split apart. */
export const RESUME_BLIND_SPOTS = SURFACE_BLIND_SPOTS.resume;

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
}): ProductState {
  return {
    /*
     * COUNTED FROM THE GAMES AND NOT FROM `stored - scored`. That subtraction folds `refused` and
     * `legacy-unknown` in with `pending`, and only the last of those is work the queue will do.
     */
    pendingAnalyses: input.games.filter((g) => g.analysisState === "pending").length,
    analysisRunning: input.analysisRunning,
    drill: null,
    transfer: null,
    unseenEvent: null,
    untestedRule: null,
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
 */
export function useProductState(): ProductState | null {
  const blitz = useBlitzReading();
  const analysis = useBlitzAnalysis();
  const decisions = useDecisionCount();
  const record = useRecordReading();
  if (!blitz.data) return null;
  return productStateFor({
    reading: blitz.data.reading,
    games: blitz.data.games,
    decisionsOnRecord: decisions.data?.decisions ?? 0,
    record: record.data,
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
): NextAction | null {
  const written = useRef(false);
  const action = state === null ? null : deriveNextAction(state);
  const kind = action?.kind ?? null;

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
      blind: [...SURFACE_BLIND_SPOTS[surface]],
    });
  }, [kind, surface]);

  return action;
}
