/**
 * THE SECOND VISIT ONWARD IS NOT A LANDING PAGE.
 *
 * THE FINDING THAT STARTED THIS, in the owner's own words: he had seen the entry screen dozens of
 * times and had almost never read it. The response is not to write it better. It is to stop the
 * product depending on anyone reading it -- §12 and §13 -- and the acceptance criterion in §28 is
 * blunt: a returning player answers three questions within seconds, without reading a paragraph.
 *
 *     מה השתנה מאז הפעם האחרונה?
 *     מה המערכת יודעת כרגע?
 *     מה כדאי לי לעשות עכשיו?
 *
 * SO THERE IS A CHARACTER BUDGET AND A TEST HOLDS IT. Three sentences and a button. Not because
 * short is a virtue -- everything this product knows is still one click away -- but because a
 * screen that takes a minute to read is a screen that gets skipped, and a skipped screen is how a
 * product ends up needing to explain itself on the thirty-eighth visit.
 *
 * IT RENDERS NOTHING ON A FIRST VISIT. `WhatThisIs` owns that moment and owns it well; a resume
 * screen shown to somebody with no record would be answering "what changed" with silence and "what
 * do you know" with a shortfall, which is the product describing its own emptiness to a person who
 * has not yet done anything.
 *
 * IT COMPUTES NOTHING. `readResume` chooses the three answers and `blitz-words` writes them. What
 * is here is which one goes in the headline, which goes under it, and where the button sits.
 */
import { useEffect, useRef } from "react";
import { FindingCard } from "./FindingCard";
import { SCREEN_QUESTIONS } from "@shared/screen-questions";
import { useBlitzReading } from "@/lib/blitz-reading-api";
import { useClaimView } from "@/lib/record-api";
import { lastSeenReading, rememberReadingSeen } from "@/lib/last-seen";
import { readResume } from "@shared/resume-reading";
import { changedSentence, knowsSentence, patternCounts } from "@shared/blitz-words";
import { authorityOfRecordReading } from "@shared/evidence-authority";
import { useNextActionShadow, useProductState } from "@/lib/next-action-shadow";
import { useBlitzAnalysis } from "@/lib/use-blitz-analysis";

export function ResumeScreen({
  /**
   * Whether this is a second visit or later.
   *
   * A PROP RATHER THAN A `visitsOnRecord()` CALL HERE, so that one place decides it. The page also
   * needs the answer -- it is what suppresses the explanation §13 says not to show again -- and two
   * components each reading the counter would be two chances to disagree about who is returning,
   * on the one screen whose whole job is to look different to the two of them.
   *
   * IT IS THE VISIT COUNT AND NOT "IS THE RECORD EMPTY". Different facts: somebody who cleared
   * their browser has an empty record and is not a first-time visitor, and somebody arriving on a
   * second device is a first-time visitor with a full server record.
   */
  returning,
  onPlay,
}: {
  returning: boolean;
  onPlay: () => void;
}) {
  const { data, isLoading } = useBlitzReading();
  /*
   * THE SAME VIEW THE LOOP STRIP READS, for the one number this screen was missing.
   *
   * `N-3`: a cold arrival is handed a bank position, and a bank answer is not a blitz game. The
   * blitz reading correctly reported `no-games` and this screen correctly rendered the sentence
   * for it -- to a player who had committed two complete decisions and read two reveals. The
   * record held them the whole time, under another heading, and this surface was the one place
   * that did not say so.
   *
   * NOT A SECOND SOURCE OF TRUTH. `readElsewhere` is the field the strip already shows, from the
   * query it already runs; this adds a reader, not a number.
   */
  const claim = useClaimView();
  /*
   * SHADOW MODE (LAW 3, P0.5). `deriveNextAction` runs here and this screen ignores its answer.
   *
   * IT IS CALLED UNCONDITIONALLY AND ABOVE EVERY EARLY RETURN, because it is a hook -- and because
   * the comparison is worth having on exactly the renders where this screen decides to show
   * nothing. `null` while the reading is still fetching, which is the state the derivation answers
   * `none` to, and it is the whole reason `none` exists.
   *
   * WHAT IT COSTS THE PLAYER: nothing on screen, and one row in a ledger that never leaves this
   * browser. What it buys is the only evidence that could justify letting the derivation own this
   * screen -- see `docs/INERTIAL_UX_LAWS.md` LAW 3.
   */
  /*
   * THE SAME PAGE-LEVEL QUEUE THE ROOT ALREADY MOUNTS, read for its progress. Two screens calling
   * this hook get one runner, which is what lets the resume screen and the blitz post-game report
   * the same pass without either of them owning it.
   */
  const analysis = useBlitzAnalysis();

  /*
   * READ ONCE, ON THE FIRST RENDER, AND HELD.
   *
   * The effect below writes the same key, so reading it during render would give the second render
   * today's timestamp and collapse "four new games since you last looked" into "nothing changed" --
   * in front of the player, between two frames. A ref taken before the write is what keeps the
   * sentence about the visit BEFORE this one.
   */
  const since = useRef<string | null>(null);
  const captured = useRef(false);
  if (!captured.current) {
    captured.current = true;
    since.current = lastSeenReading();
  }

  useNextActionShadow("resume", useProductState());

  /*
   * THE WRITE HAPPENS AFTER THE READING IS ON SCREEN, not before. A screen that stamped itself as
   * seen and then failed to render would lose the player's "what changed" line permanently, for a
   * visit where they were shown nothing.
   */
  useEffect(() => {
    if (returning && !isLoading && data) rememberReadingSeen();
  }, [returning, isLoading, data]);

  if (!returning) return null;

  /*
   * STILL FETCHING IS NOT AN EMPTY RECORD. Rendering the shortfall here would tell a returning
   * player with forty games that they had never played, for as long as the request took -- and
   * that sentence is the one they would act on.
   */
  if (isLoading || !data) return null;

  /*
   * ZERO WHILE THE CLAIM VIEW IS STILL FETCHING, which renders the sentence that says nothing has
   * been played. That is the honest reading of "the record has not answered yet" and it is
   * momentary; guessing a positive count would put a number on screen that no query returned.
   */
  const resume = readResume(data.reading, data.games, since.current, claim.data?.readElsewhere ?? 0);
  const changed = changedSentence(resume.changed);
  const knows = knowsSentence(resume.knows);

  return (
    <section className="resume" aria-label={SCREEN_QUESTIONS.resume} dir="rtl">
      {/*
        * WHAT CHANGED GOES ABOVE THE CARD AND NOT INSIDE IT. It is not a finding and it carries no
        * evidence level: "four new games were analysed" is a fact about the record's size, and
        * putting it in the card would give it a mark it has not earned. It is also the one line
        * that is absent more often than present, and a card that sometimes has a fifth slot is a
        * card whose shape a reader cannot learn.
        */}
      {changed && <p className="resume__changed">{changed}</p>}

      <FindingCard
        headline={knows}
        example={
          resume.knows.kind === "one-thing" ? (
            /*
             * THE COUNTS, AGAIN, AS THE EXAMPLE. §7 wants a concrete case before the aggregate and
             * a retrospective pattern has no single case -- it IS the aggregate. What it can offer
             * is the two counts side by side, which is the closest thing to a case a description
             * has, and is what §10 asks for in as many words: "6 of 9, against 2 of 11".
             */
            <p className="resume__counts">{patternCounts(resume.knows.pattern)}</p>
          ) : null
        }
        authority={
          resume.knows.kind === "one-thing"
            ? resume.knows.authority
            : /*
               * A SILENCE IS STILL AN OBSERVATION ABOUT A RECORD, and `authorityOfRecordReading`
               * answers from the size of that record rather than from a guess: no games is one
               * event's worth of standing, and a record with games behind it is a description.
               * Neither can prescribe, which is what the card's restraint line then says.
               */
              authorityOfRecordReading(data.reading.decisions.readable)
        }
        /*
          * NO BUTTON WHILE THE ENGINE IS STILL GOING (P1.5).
          *
          * `nothing-scored` is the one blocker playing does not answer: the games are stored and
          * unscored, so another game grows the backlog that IS the blocker. The screen offered one
          * anyway, because every blocker had to fill in a label. It says what is happening instead,
          * below.
          */
        action={
          resume.next.kind === "play"
            ? {
                label: resume.next.label,
                because: resume.next.because,
                /*
                 * THE FRONT DOOR'S ONE PRIMARY ACT on a returning visit. `FirstDecision` below
                 * defers to it rather than offering a second, different product at the same weight.
                 */
                act: "play-blitz" as const,
                onClick: onPlay,
              }
            : null
        }
        why={
          <dl className="resume__why">
            <dt>משחקים</dt>
            <dd>
              {data.reading.games.stored} שמורים, {data.reading.games.scored} נותחו
            </dd>
            <dt>החלטות שאפשר לקרוא</dt>
            <dd>{data.reading.decisions.readable} מתוך {data.reading.decisions.stored}</dd>
            {data.reading.decisions.excluded.map((exclusion) => (
              <div key={exclusion.reason} className="resume__excluded">
                <dt>{exclusion.reason}</dt>
                <dd>{exclusion.n}</dd>
              </div>
            ))}
          </dl>
        }
      />

      {/*
        * WHAT IS HAPPENING INSTEAD OF A BUTTON, and it is two sentences rather than one.
        *
        * `analysisState: "pending"` is the same stored value for "the queue has not reached this
        * game" and "the queue is scoring it as we speak", and those are different things to a
        * person waiting. The progress comes from the same page-level runner the root already
        * mounts, so this screen reports it rather than owning it.
        */}
      {resume.next.kind === "wait" && (
        <p className="resume__waiting" role="status">
          {analysis.scoring !== null
            ? `המנוע עובר על משחק עכשיו — ${analysis.done} מתוך ${analysis.of} עמדות.`
            : waitingSentence(resume.next.games)}
        </p>
      )}
    </section>
  );
}

/**
 * How many games are waiting, said as games rather than as a status.
 *
 * ONE AND MANY ARE DIFFERENT SENTENCES IN HEBREW and getting it wrong reads as machine output,
 * which is the one register this screen cannot afford: it is the screen a returning player skims.
 */
function waitingSentence(games: number): string {
  if (games <= 0) return "המנוע יעבור על המשחקים ששמורים.";
  return games === 1 ? "משחק אחד ממתין לניתוח." : `${games} משחקים ממתינים לניתוח.`;
}
