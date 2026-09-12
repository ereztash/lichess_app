/**
 * The record's learning objects, turned into readings the ledger can render.
 *
 * WHY THIS IS A SEPARATE FILE FROM `shared/learning-journey.ts`. That one is the state machine and
 * knows nothing about how this product stores anything; this one is the adapter, and it is where
 * every honest compromise about what can actually be counted lives. Keeping them apart means the
 * machine can be tested on its own logic and this can be tested on its own arithmetic.
 *
 * WHAT IS NOT COUNTED HERE, AND IT IS THE INTERESTING PART. The unprompted reading wants free-play
 * decisions in a rule's scope, split at the moment the rule was written. The scope of a rule is
 * `trigger`, which is free text the player typed, and no code can decide whether a position
 * satisfied it. So `inScope` stays null until a caller can supply the two counts from a class the
 * product actually stores, and a null reading renders as "the counting has not started" rather than
 * as a zero. A zero would be a measurement; this is an absence of one.
 */
import { ruleJourney, recordJourney, type JourneyReading } from "@shared/learning-journey";
import type { LearningRule } from "@shared/learning-record";
import type { ClaimView } from "@shared/record-service";

export function recordReading(view: ClaimView | undefined): JourneyReading {
  return recordJourney({
    scored: view?.scored ?? 0,
    hasClaim: Boolean(view?.claim),
    othersWithheld: view?.othersWithheld ?? 0,
    readElsewhere: view?.readElsewhere ?? 0,
  });
}

/**
 * One reading per rule, oldest first, and retired rules last.
 *
 * THE ORDER IS THE POINT OF THE LIST. Oldest first is the order the player wrote them in, which is
 * the only order they can recognise; a list sorted by stage would reshuffle every time a test was
 * sat. Retired rules sink because they are closed and the player closed them, but they stay on the
 * list, because a ledger that deletes what did not work is a ledger that only ever grows.
 */
export function ruleReadings(rules: readonly LearningRule[] | undefined): JourneyReading[] {
  if (!rules?.length) return [];
  return [...rules]
    .sort((a, b) => {
      const closed = Number(a.grade === "retired") - Number(b.grade === "retired");
      return closed !== 0 ? closed : a.created_at.localeCompare(b.created_at);
    })
    .map((rule) =>
      ruleJourney({
        rule,
        /*
         * NULL, BECAUSE THE DRILL BELONGS TO THE CLAIM AND NOT TO THE RULE. A rule is written after
         * a reveal and a drill is run against a claim's bucket; nothing on a `LearningRule` records
         * which drill, if any, preceded it. Passing a drill count here would attach one object's
         * evidence to another, so the reading skips the stage rather than borrowing it.
         */
        drill: null,
        promptedSittings: rule.retrieval_step > 0 ? rule.retrieval_step : null,
        inScope: null,
      }),
    );
}
