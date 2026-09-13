/**
 * What this product has learned about you, and how far each of those things has got.
 *
 * WHY THIS SURFACE DID NOT EXIST. Every state it renders was already in the record and reachable
 * one at a time: a claim in the claim panel, a drill in the drill runner, a rule in the learning
 * queue, a retrieval test in the transfer runner. What no screen answered was the question a player
 * actually has after a week -- "what does this thing know about me now, and what is it doing with
 * it" -- because that question is about ALL of them at once and every surface owned exactly one.
 *
 * IT IS PLURAL, AND `ContextRibbon` IS NOT, AND THAT IS THE WHOLE SPLIT. The ribbon answers "what
 * should I do now", which has one answer. This answers "where does each thing stand", which has as
 * many answers as the player has rules. Reducing that to one position would elect a winner nobody
 * chose; `shared/learning-journey.ts` says the same thing at greater length.
 *
 * IT OWNS NO CONTROL, AND IT DOES NOT RENDER THE GOAL EITHER. `ClaimPanel` starts drills,
 * `LearningQueue` opens a retrieval test, `GoalNote` owns the player's sentence about why they are
 * here, and the board is where a decision is made. A button here would be a second door to a
 * question that already has one, and the two would drift. The goal lives in its own component for
 * the same reason plus one more: it must not share an element with a count, and the cheapest way to
 * guarantee that is for the counts and the goal to be in different files.
 *
 * EVERY NUMBER SAYS WHAT IT COUNTS. That is not a style preference, it is the architecture: a drill
 * score, a prompted-retrieval score and a count of unprompted decisions are three constructs, and
 * the moment any of them renders as a bare figure the screen has re-created the single progress
 * number this design was chosen to avoid. `GATE-CONSTRUCT-NAMED` refuses it.
 */
import type { JourneyReading } from "@shared/learning-journey";
import type { ClaimView } from "@shared/record-service";
import { recordReading, ruleReadings } from "@/lib/journey-readings";
import { useLearningRules } from "@/lib/record-api";

/**
 * THE ADAPTING HAPPENS HERE RATHER THAN AT THE CALL SITE, and the reason is bytes rather than taste.
 *
 * The call site is the front door, whose entry chunk is what every arrival downloads before they
 * have done anything. `journey-readings.ts` pulls in the learning-record schemas, and importing it
 * from the page put those in the first byte of every visit for a surface that renders below the
 * readings. `npm run bundle:budget` refused it, and it was right to. The adapter is still a pure
 * module tested on its own; only the import moved.
 *
 * The rules query lives here for the same reason and one better: nothing else on the record page
 * reads learning rules, so fetching them from the page would be a request made on every visit for a
 * surface most visits never scroll to.
 */
export function JourneyLedger({
  claim,
}: {
  /** The claim view the record page already holds. Undefined while it loads, which is ordinary. */
  claim: ClaimView | undefined;
}) {
  const rules = useLearningRules();
  const record = recordReading(claim);
  const ruleStages = ruleReadings(rules.data?.rules);

  return (
    /*
      A `div` AND NOT A NAMED `section`, because the page already wraps this in one with the same
      name. Two landmarks with the same role and the same accessible name is `landmark-unique`, and
      axe was right to call it: a screen-reader user navigating by region would find two entries
      called "what has been learned about me" and no way to tell which is which. The `h3` is the
      structure here; the landmark is the page's.
    */
    <div className="journey" dir="rtl">
      <h3 className="journey__title">מה נלמד עליי עד עכשיו</h3>

      <Stage reading={record} />

      {ruleStages.map((reading, index) => (
        <Stage key={`${reading.stage}-${index}`} reading={reading} />
      ))}
    </div>
  );
}

function Stage({ reading }: { reading: JourneyReading }) {
  const { count } = reading;
  return (
    <article className="journey__stage" data-stage={reading.stage}>
      <h4 className="journey__question">{reading.question}</h4>

      <p className="journey__count">
        <span className="journey__n">
          {count.of === null ? count.n : `${count.n} מתוך ${count.of}`}
        </span>{" "}
        <span className="journey__construct">{count.construct}</span>
      </p>

      <p className="journey__next">{reading.next}</p>

      {/*
        WHAT THIS STAGE DOES NOT ESTABLISH, RENDERED WITH IT AND NEVER DROPPED. A stage that shows
        only its number is a stage that has been read as more than it is -- a drill pass as evidence
        of play, a separation as evidence of something personal. The limit is part of the reading.
      */}
      <p className="journey__limit">{reading.notEstablished}</p>
    </article>
  );
}
