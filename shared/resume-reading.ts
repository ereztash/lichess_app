/**
 * WHAT A RETURNING PLAYER IS OWED, AND IT IS THREE SENTENCES.
 *
 * §12, §13 AND §28, WHICH ARE ONE PROBLEM. The finding that started this: a person who had seen the
 * entry screen dozens of times had almost never read it. The response is not to write it better. It
 * is to stop the product depending on anyone reading it -- which means the second visit onward is
 * not a landing page at all, and the three things a returning player actually wants are answered
 * without prose:
 *
 *     מה השתנה מאז הפעם האחרונה?     `changed`
 *     מה המערכת יודעת כרגע?          `knows`
 *     מה כדאי לי לעשות עכשיו?        `next`
 *
 * ONE ANSWER EACH, NOT A LIST. §14 says one screen answers one question; the resume screen is the
 * exception that proves it, because these three are one question -- "where am I" -- and answering
 * any of them alone leaves the player to assemble the rest.
 *
 * EVERY ANSWER IS DERIVED, AND `knows` IS DERIVED FROM SILENCE AS OFTEN AS FROM A FINDING. That is
 * the honest shape given what the M0 audit measured: the chain is silent on most records most of
 * the time. A resume screen that could only speak when it had a finding would be blank on the
 * ordinary visit, and blank is the state that taught the player not to read the screen.
 *
 * NOTHING HERE INVENTS A NUMBER. The "two more games" in §13 is `BlitzShortfall.games`, which comes
 * from the bucketing that is actually blocking, converted at the rate this record has observed. If
 * there is no rate, there is no sentence -- `needs.games` is null and the words say so.
 */
import type {
  BlitzBlocker,
  BlitzPattern,
  BlitzReading,
  BlitzShortfall,
} from "./blitz-reading.js";
import type { StoredBlitzGame } from "./blitz-record.js";
import { authorityOfRecordReading, type EvidenceAuthority } from "./evidence-authority.js";

/**
 * WHAT CHANGED, or null when there is no "since" to measure against.
 *
 * NULL ON A FIRST VISIT AND NOT ZERO. "Nothing changed since last time" is a different statement
 * from "there was no last time", and a returning-screen that opened with the first on somebody's
 * first arrival would be answering a question they had not asked.
 */
export interface ResumeChange {
  since: string;
  /** Games that finished after `since`. */
  newGames: number;
  /** How many of those the engine has scored. Separate, because the gap between them is the signal. */
  newlyScored: number;
}

export type ResumeKnowledge =
  | {
      kind: "one-thing";
      pattern: BlitzPattern;
      /** Always the pattern's own, which is `recurred`. Carried so no screen has to look it up. */
      authority: EvidenceAuthority;
    }
  | { kind: "nothing-yet"; because: BlitzBlocker; needs: BlitzShortfall | null };

/**
 * WHAT TO DO NEXT, AND SOMETIMES IT IS NOT A THING TO DO.
 *
 * A UNION RATHER THAN A LABEL, because one of the five blockers is not answered by an action at
 * all. `nothing-scored` means the games are stored and the engine has not been over them, and the
 * screen's answer to it was *"שחק עוד משחק"* -- play another game -- which grows the backlog that
 * IS the blocker. A button was offered because the type had a `label` in it and every blocker had
 * to fill one in.
 *
 * IT ONLY BECAME TRUE TO SAY "WAIT" IN THE COMMIT THAT MADE WAITING WORK. Before the analysis queue
 * (LAW 4), leaving the blitz screen cancelled the search, so a pending game was one nothing would
 * ever finish and telling a player to wait for it would have been telling them to wait for nothing.
 * The queue resumes from any page load, so the sentence below is now a description of something
 * that happens.
 */
export type ResumeNext =
  | { kind: "play"; label: string; because: string }
  /** `games` is how many are waiting, because a count that climbs across visits is the symptom. */
  | { kind: "wait"; because: string; games: number };

export interface ResumeReading {
  changed: ResumeChange | null;
  knows: ResumeKnowledge;
  next: ResumeNext;
}

/**
 * WHICH PATTERN THE SCREEN SPEAKS ABOUT WHEN THERE IS MORE THAN ONE.
 *
 * THE LARGEST BUCKET, AND NOT THE STRONGEST EFFECT. Choosing by `gapDifference` or by
 * `gapDifference / standardError` would be choosing the finding that flatters the product, on the
 * same data the finding was found in -- the post-hoc selection D08 refuses inside validation,
 * arriving here as a display rule. Size is decided by how the record fell out and cannot prefer an
 * answer.
 *
 * TIES BROKEN BY KEY so the same record always produces the same screen. A resume screen that
 * changed its headline between two loads of an unchanged record would be teaching the player that
 * the product's statements are weather.
 */
function widest(patterns: readonly BlitzPattern[]): BlitzPattern | null {
  let best: BlitzPattern | null = null;
  for (const pattern of patterns) {
    if (best === null || pattern.insideN > best.insideN || (pattern.insideN === best.insideN && pattern.key < best.key)) {
      best = pattern;
    }
  }
  return best;
}

/**
 * WHAT TO DO NEXT, PER BLOCKER, and every one of them is a request for a measurement rather than
 * advice about chess.
 *
 * §23: coaching arrives last and only behind evidence that could have come back negative. Nothing
 * on this screen has that standing -- the widest retrospective pattern is still `recurred` -- so
 * every `because` below says what the next game MEASURES, not what the player should do
 * differently while playing it.
 *
 * `nothing-scored` IS THE ONE THAT CARRIES A DIAGNOSIS. Its sentence names how many games are
 * stored and unscored, because that number climbing across visits IS the symptom, and a player
 * watching it climb learns more than any message the product could compose about its own engine.
 */
const NEXT_STEP: Readonly<Record<Exclude<BlitzBlocker, "nothing-scored">, ResumeNext>> = {
  "no-games": {
    kind: "play",
    label: "שחק משחק קצר",
    because: "משחק אחד נותן מספיק החלטות כדי להתחיל למדוד משהו.",
  },
  "nothing-asked": {
    kind: "play",
    label: "שחק עוד משחק",
    because: "שאלת הביטחון עולה על חלק קטן מההחלטות, אז לוקח כמה משחקים עד שנאספות תשובות.",
  },
  "too-few-readable": {
    kind: "play",
    label: "שחק עוד משחק",
    because: "עוד החלטות מדודות הן מה שמאפשר את הבדיקה הראשונה.",
  },
  "no-split-yet": {
    kind: "play",
    /*
     * THE ONE PLACE THE NEXT STEP IS NOT OBVIOUS, because this is not a shortage -- it is an
     * answer. The six divisions were all tested and none separated. Another game does not open a
     * gate here; it makes the same test sharper, and the sentence says that rather than implying
     * a threshold is about to be crossed.
     */
    label: "שחק עוד משחק",
    /*
     * IT DOES NOT RESTATE THE HEADLINE, and the first draft did -- the sentence above the button
     * and the sentence under it both opened "בדקנו את כל החלוקות". Caught by printing the rendered
     * screen against its character budget, where a third of the text was one clause said twice.
     */
    because: "זה לא שער שייפתח. עוד משחקים פשוט יחדדו את אותה בדיקה.",
  },
};

/** When something WAS found, the next step is the forward test, and it says so. */
const NEXT_WHEN_FOUND: ResumeNext = {
  kind: "play",
  label: "שחק עוד משחק",
  because: "מצאנו את זה במשחקים קודמים. עכשיו צריך לבדוק אם זה חוזר, בלי לשנות את ההגדרה.",
};

/**
 * THE ONE BLOCKER THAT IS NOT ANSWERED BY PLAYING, and the sentence says why in the player's terms.
 *
 * IT NAMES THE COUNT BECAUSE THE COUNT IS THE DIAGNOSIS. A number that climbs across visits says
 * the queue is not getting through the backlog, and a player watching it climb learns more than any
 * message the product could compose about its own engine. The old sentence carried the same
 * argument and then attached a button that made the number go up.
 *
 * "EVEN IF YOU LEAVE" IS A PROMISE THE PRODUCT CAN NOW KEEP. It could not before the analysis
 * queue: leaving the blitz screen cancelled the search.
 */
function nextWhileUnscored(games: number): ResumeNext {
  return {
    kind: "wait",
    games,
    because:
      "המשחקים שמורים והמנוע עובר עליהם. זה ממשיך גם אם תצא מהמסך, ולא צריך לשחק עוד משחק בשביל זה.",
  };
}

export function readResume(
  reading: BlitzReading,
  games: readonly StoredBlitzGame[],
  /** When the previous visit began, or null on a first arrival. */
  since: string | null,
): ResumeReading {
  const changed = since === null ? null : countChange(games, since);

  if (reading.standing.may) {
    const pattern = widest(reading.spoken?.patterns ?? []);
    if (pattern !== null) {
      return {
        changed,
        knows: { kind: "one-thing", pattern, authority: authorityOfRecordReading(pattern.insideN) },
        next: NEXT_WHEN_FOUND,
      };
    }
    /*
     * PERMITTED AND EMPTY, WHICH `standingOf` ALREADY RULES OUT -- it returns `no-split-yet` when
     * the spoken stratum has no patterns. The branch is here because "may is true" and "there is a
     * pattern" are two facts, and a reading that assumed the second from the first would produce
     * an undefined headline the day the two came apart, on the screen a returning player opens.
     */
    return {
      changed,
      knows: { kind: "nothing-yet", because: "no-split-yet", needs: null },
      next: NEXT_STEP["no-split-yet"],
    };
  }

  const because = reading.standing.because;
  return {
    changed,
    knows: { kind: "nothing-yet", because, needs: reading.standing.needs },
    next:
      because === "nothing-scored"
        ? nextWhileUnscored(games.filter((g) => g.analysisState === "pending").length)
        : NEXT_STEP[because],
  };
}

/**
 * Games finished since a timestamp, and how many of them are scored.
 *
 * COMPARED AS DATES AND NOT AS STRINGS. Both sides are ISO-8601 and would in fact sort correctly as
 * text -- until one of them arrives with an offset instead of a `Z`, at which point the comparison
 * silently starts answering about a different instant. `Date.parse` handles both.
 *
 * AN UNPARSEABLE `since` COUNTS NOTHING RATHER THAN EVERYTHING. `NaN` compares false against every
 * number, so a corrupt stored timestamp would otherwise report every game as new -- which reads on
 * screen as a burst of activity that did not happen.
 */
function countChange(games: readonly StoredBlitzGame[], since: string): ResumeChange {
  const cutoff = Date.parse(since);
  if (!Number.isFinite(cutoff)) return { since, newGames: 0, newlyScored: 0 };
  let newGames = 0;
  let newlyScored = 0;
  for (const game of games) {
    const finished = Date.parse(game.finishedAt);
    if (!Number.isFinite(finished) || finished <= cutoff) continue;
    newGames += 1;
    if (game.analysisState === "complete") newlyScored += 1;
  }
  return { since, newGames, newlyScored };
}
