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
 * on a screen that re-renders on every query settle; a row per render would evict the funnel events
 * the ledger exists for. One settled comparison per visit is what the question needs -- does the
 * derivation agree with the screen -- and it is all this records.
 */
import { useEffect, useRef } from "react";
import { ANCHOR_POSITIONS } from "@shared/anchor-set";
import { deriveNextAction, type NextAction, type ProductState } from "@shared/next-action";
import type { BlitzReading } from "@shared/blitz-reading";
import type { StoredBlitzGame } from "@shared/blitz-record";
import type { RecordReading } from "@shared/record-service";
import { recordTrialEvent, trialEventSeen } from "@/lib/progress-record";

/**
 * Inputs the front door does not have, named so a disagreement can be read.
 *
 * NOT A TODO LIST. Two of them are properly invisible here: a drill and a transfer live in another
 * screen's state, and the front door is not the place to learn about them. The other two are gaps
 * with owners -- an unseen-event set and an untested-rule query -- and both are named in the plan
 * rather than invented here.
 */
export const RESUME_BLIND_SPOTS = ["drill", "transfer", "unseenEvent", "untestedRule"] as const;

/**
 * What the resume screen offers, in its own vocabulary rather than in its label.
 *
 * A LABEL WOULD MAKE THE LEDGER UNREADABLE ACROSS A REWORDING. `ResumeScreen` has exactly one
 * action and it is always the same act -- start a game -- whichever blocker produced the sentence
 * above it. That is the fact the comparison is about, and it does not change when the words do.
 */
export const RESUME_OFFERS = "play";

/** The state the front door can actually assemble, with everything it cannot left null. */
export function resumeProductState(input: {
  reading: BlitzReading;
  games: readonly StoredBlitzGame[];
  decisionsOnRecord: number;
  record: RecordReading | undefined;
}): ProductState {
  return {
    /*
     * COUNTED FROM THE GAMES AND NOT FROM `stored - scored`. That subtraction folds `refused` and
     * `legacy-unknown` in with `pending`, and only the last of those is work the queue will do.
     */
    pendingAnalyses: input.games.filter((g) => g.analysisState === "pending").length,
    /*
     * FALSE HERE, ALWAYS, AND SAID RATHER THAN GUESSED. Whether the queue is mid-pass is a fact
     * about a runner this screen does not subscribe to; reporting `true` because a backlog exists
     * would be the shadow inventing an input, which is the one thing it must not do.
     */
    analysisRunning: false,
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
 * Run the derivation beside the screen and record what it would have said.
 *
 * RETURNS THE PROPOSAL so a test can assert it without reading `localStorage`, and the callers
 * ignore it -- which is the whole of what "shadow" means here.
 */
export function useNextActionShadow(state: ProductState | null): NextAction | null {
  const written = useRef(false);
  const action = state === null ? null : deriveNextAction(state);
  const kind = action?.kind ?? null;

  useEffect(() => {
    if (kind === null || written.current) return;
    if (trialEventSeen("next_action_shadow")) {
      written.current = true;
      return;
    }
    written.current = true;
    recordTrialEvent({
      name: "next_action_shadow",
      at: new Date().toISOString(),
      surface: "resume",
      proposed: kind,
      offered: RESUME_OFFERS,
      /*
       * THE EQUIVALENCE, WRITTEN OUT ONCE. The screen's single act is starting a game, so it agrees
       * with exactly the proposals that are also "start a game". Every other kind -- waiting for an
       * analysis, reading an event, finishing a run, going to the record -- is something this screen
       * cannot offer at all, and that is a disagreement rather than a near miss.
       */
      agrees: kind === "play-first-decision" || kind === "play-blitz",
      blind: [...RESUME_BLIND_SPOTS],
    });
  }, [kind]);

  return action;
}
