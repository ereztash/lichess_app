/**
 * WHERE A CANONICAL ACT LANDS. THE SHELL'S JOB, NOT A CARD'S.
 *
 * WHY THIS IS SEPARATE FROM THE PRESENTERS. `presentOnResume` and `presentOnPostGame` decide what an
 * act is CALLED on their surface. Neither may decide where it goes: a destination is a fact about
 * the application's routes and handoffs, and a card that knew it would be a card that could only be
 * rendered in one place. `ResumeScreen` used to take `onPlay`, which could express exactly one
 * destination -- which is the same constraint, one layer down, and is why it could only ever offer
 * one act.
 *
 * SO THE CHAIN IS: policy decides the act, the surface words it, the shell lands it. Three owners,
 * each with one job, and none of them ranking anything the others ranked.
 *
 * THIS FILE ROUTES; IT DOES NOT DECIDE. There is no branch here that picks between two acts, and
 * there must never be. Every `case` is a destination for an act already chosen, which is what keeps
 * it out of `GATE-ONE-PRODUCT-AUTHORITY`'s way.
 */
import { useCallback } from "react";
import { useLocation } from "wouter";

import type { NextAction } from "@shared/next-action";
import { writeResumeRequest } from "@/lib/commitment-handoff";
import { serveNextBankPosition } from "@/lib/bank-handover";

/**
 * Land the canonical act.
 *
 * `test-hypothesis` AND `test-claim` LAND ON THE BOARD WITHOUT STARTING THE TEST, and that is a
 * real limitation stated rather than papered over. Registering a drill or a transfer needs
 * candidate positions, and positions come from a loaded game -- `beginDrill` refuses without one
 * and says so. So the act routes the player to the surface where `ClaimPanel` and `LearningQueue`
 * offer the start; it does not perform it. Making it perform the start would mean choosing
 * positions on the player's behalf from whatever happened to be loaded, which is the evidence
 * selection the pre-registration rules exist to refuse.
 *
 * `review-event` IS UNREACHABLE and throws nothing: the ladder cannot produce it, because
 * `unseenEvent` is `UNIMPLEMENTED`. It routes to the record, which is where a stored event lives,
 * so that the day a seen-set exists this is a wiring change and not a hole.
 */
export function useCanonicalRouting(): (action: NextAction) => void {
  const [, navigate] = useLocation();
  return useCallback(
    (action: NextAction) => {
      switch (action.kind) {
        case "continue-drill":
          writeResumeRequest({ kind: "drill", id: action.drillId });
          navigate("/play");
          return;
        case "continue-transfer":
          /*
           * BY THE RULE, NOT THE TRANSFER ID. `startLearningTransfer` takes a `rule_id` and hands
           * back whichever transfer is open over it together with how far it got; there is no
           * "resume transfer X" read. `commitment-handoff.ts` carries the same note.
           */
          writeResumeRequest({ kind: "transfer", id: action.transferId });
          navigate("/play");
          return;
        case "play-blitz":
          navigate("/blitz");
          return;
        case "play-first-decision":
        case "collect-more-evidence":
          /*
           * THE BANK, NOT A BARE BOARD. `navigate("/play")` alone lands on the opening position of
           * a new live game, where no reveal branch can fire -- `Record.tsx` records that walk and
           * it is why `FirstDecision` exists. Serving a bank position is the route that produces
           * something to read.
           */
          void serveNextBankPosition([]).then((outcome) => {
            if (outcome === "set-complete") navigate("/");
            else navigate("/play");
          });
          return;
        case "test-hypothesis":
        case "test-claim":
        case "review-event":
        case "return-record":
        case "wait-analysis":
        case "none":
          navigate(action.kind === "test-hypothesis" || action.kind === "test-claim" ? "/play" : "/");
          return;
      }
    },
    [navigate],
  );
}
