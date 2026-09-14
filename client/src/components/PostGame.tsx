/**
 * WHAT THE SCREEN AFTER A GAME SAYS, WHICH USED TO BE A COUNT.
 *
 * It said: "X החלטות נותחו אחרי המשחק." That is true, it is the product describing its own
 * plumbing, and a player learns nothing they can act on from it -- §24 calls it almost worthless
 * and it is right. The count is still here. It is behind the disclosure, with the engine and the
 * depth, where R1 wants it and where nobody has to read it.
 *
 * THREE STATES, AND THE ONE THAT DECIDES BETWEEN THEM IS NOT SIZE. A game whose worst moment is a
 * 900-centipawn blunder gets "nothing to conclude"; a game whose worst moment is a 200-centipawn
 * move the player called "בטוח" gets a headline. Next to a cp-loss column that ordering looks
 * broken, and it is the entire product: the first is what Game Review has given players for a
 * decade, and the second is the only thing in this record that a PGN and an engine could not
 * reconstruct afterwards.
 *
 * THIS COMPONENT DECIDES NOTHING. `readBlitzGame` chooses the state and `postGameWords` writes the
 * sentences; what is here is layout, the order of the four slots, and which numbers go behind the
 * disclosure. That division is the one `OutcomeSummary` documents about itself, and it is what
 * makes the screen testable without a browser.
 */
import { FindingCard } from "./FindingCard";
import { SCREEN_QUESTIONS } from "@shared/screen-questions";
import {
  eventFacts,
  eventHeadline,
  othersSummary,
  postGameWords,
  sharedCostBand,
} from "@shared/blitz-words";
import type { BlitzEvent, PostGameReading } from "@shared/blitz-reading";
import type { StoredBlitzGame } from "@shared/blitz-record";
import { primaryAction } from "@shared/primary-action";
import type { SurfaceOffer } from "@shared/surface-offer";

/**
 * The measurement detail, behind "why are we saying this?".
 *
 * EVERY FIGURE THE SENTENCES DELIBERATELY DO NOT CARRY. The engine and its depth, because a
 * cp-loss that cannot name its build is a number two instruments could have produced; the ask
 * rate, because a reader wondering why they were not asked deserves the regime rather than a
 * shrug; and the raw centipawns, because the band above them is a band and somebody will want to
 * know what it was drawn from.
 */
function Why({
  game,
  analysed,
  lead,
}: {
  game: StoredBlitzGame;
  analysed: number;
  lead: BlitzEvent | null;
}) {
  return (
    <dl className="post-game__why">
      <dt>נותחו</dt>
      <dd>{analysed} החלטות שלך במשחק הזה</dd>
      <dt>מנוע</dt>
      <dd>
        {game.analysis ? `${game.analysis.engine} ${game.analysis.build}, עומק ${game.analysis.depth}` : "לא נרשם"}
      </dd>
      <dt>יריב</dt>
      <dd>
        {game.opponent
          ? `${game.opponent.engine} ${game.opponent.build}, עומק ${game.opponent.depth}`
          : "לא נרשם"}
      </dd>
      <dt>שאלנו</dt>
      <dd>בערך {Math.round(game.askRate * 100)} מכל 100 החלטות</dd>
      {lead && (
        <>
          <dt>המהלך שלמעלה</dt>
          <dd>
            {lead.san}, מהלך {lead.ply}, {lead.cpLoss} מאיות פועל מהקו של המנוע
          </dd>
        </>
      )}
    </dl>
  );
}

export function PostGame({
  game,
  reading,
  analysed,
  onSeePosition,
  /**
   * Whether a set this player started is being offered above, so nothing here may offer a new game.
   *
   * A PROP AND NOT A HOOK, and the reason is on the record: this component is presentational, its
   * eleven tests render it with no query client, and an earlier attempt to read the continuation
   * from inside it broke all eleven. The screen that owns the route reads it and hands down the
   * answer, which is the same division `ResumeScreen` uses one surface over.
   *
   * IT SUPPRESSES BOTH WAYS OF SAYING "PLAY AGAIN", not just the loud one. `post-game__again` is the
   * stamped primary, and on `nothing-to-conclude` the CARD's own action is `onPlayAgain` under a
   * different label -- so suppressing only the button would leave the act on screen wearing the
   * card's clothes. `lead === null` is exactly the state where the card is that act.
   */
  /**
   * The canonical act for this record, already worded by `presentOnPostGame`, or null.
   *
   * A PROP AND NOT A HOOK, for the reason `standDown` was: this component is presentational, its
   * tests render it with no query client, and an earlier attempt to read the record from inside it
   * broke all of them. The route that owns the screen reads the policy and hands down the answer.
   */
  offer = null,
  onCanonicalAction = () => undefined,
}: {
  game: StoredBlitzGame;
  reading: PostGameReading;
  /** How many of the player's decisions the engine scored. The old headline, demoted. */
  analysed: number;
  onSeePosition: (event: BlitzEvent) => void;
  standDown?: boolean;
  offer?: SurfaceOffer | null;
  onCanonicalAction?: () => void;
}) {
  const words = postGameWords(reading);
  const lead = reading.state === "nothing-to-conclude" ? null : reading.lead;
  const others =
    reading.state === "nothing-to-conclude" ? reading.worthSeeing : reading.alsoWorthSeeing;
  /* Computed once for the summary and the rows, so the two cannot disagree about what was said. */
  const sharedBand = sharedCostBand(others);

  return (
    <section className="post-game" aria-label={SCREEN_QUESTIONS.postGame} dir="rtl">
      <FindingCard
        headline={words.headline}
        example={
          words.facts && (
            <>
              <ul className="post-game__facts">
                {words.facts.map((fact) => (
                  <li key={fact.label} className="post-game__fact">
                    <span className="post-game__fact-label">{fact.label}</span>
                    <span className="post-game__fact-value">{fact.value}</span>
                  </li>
                ))}
              </ul>
              {words.note && <p className="post-game__note">{words.note}</p>}
            </>
          )
        }
        authority={words.authority}
        action={
          /*
           * THE CARD'S SLOT IS THE READING'S, AND ONLY WHILE THE READING HAS A POSITION TO SHOW.
           *
           * "ראה את העמדה" is not a product routing decision -- it opens the board of the game the
           * player just finished, inside this screen's own review. It stays local for the reason
           * `docs/ARCHITECTURE_UI_CURRENT_STATE.md` §6 gives for the in-run loop: a reading of the
           * thing just played is the reading's to offer.
           *
           * WHAT LEFT IS THE OTHER BRANCH. With no position to show, this slot used to say "שחק
           * עוד משחק" UNCONDITIONALLY -- not "unless something outranks it", unconditionally -- so
           * a player with a drill four positions in finished a quiet game and was told to play
           * another. That branch is now the canonical policy's, rendered below.
           */
          lead === null
            ? null
            : { label: words.action.label, because: words.action.because, onClick: () => onSeePosition(lead) }
        }
        why={<Why game={game} analysed={analysed} lead={lead} />}
        /*
         * THE EXPLANATION IS OPEN ON THIS SCREEN AND NOWHERE ELSE. This is where most players meet
         * the marks for the first time -- it is the screen that follows the first game -- so the
         * one line saying what the level means is available here. §11's claim is that the language
         * is learned without documentation, and it is learned somewhere.
         */
        explainAuthority
      />

      {/*
        * WHEN THE STATE HAD NO EXAMPLE, THE NOTE STILL HAS TO LAND. `FindingCard` renders the note
        * inside the example slot, which state A does not have. Rendering it here rather than making
        * the card accept a fifth slot keeps the 1-1-1-1 shape intact -- this is the offer, not the
        * finding, and it is outside the card on purpose.
        */}
      {!words.facts && words.note && <p className="post-game__note">{words.note}</p>}

      {others.length > 0 && (
        /*
          * THE BAND IS SAID ONCE, ABOVE THE LIST, AND NOT IN EVERY ROW.
          *
          * WHAT THIS LOOKED LIKE. Six rows, each reading "במהלך X המהלך היה מחיר גדול" with
          * "המהלך: מחיר גדול" on the line under it, below a summary that called all six worth
          * seeing without saying what for. Seven statements of one fact, and nothing on screen to
          * choose between the six -- which is what a reader opening a disclosure is there to do.
          *
          * `sharedCostBand` IS WHY THIS IS NOT A REWORDING. Where the rows really do differ -- a
          * clean decision the player was unsure about beside an expensive one -- it returns null,
          * every row keeps its own band and the summary goes back to naming none. The list says
          * what the list has, rather than one shape for both cases.
          */
        <details className="post-game__others">
          <summary>{othersSummary(others)}</summary>
          <ul className="post-game__others-list">
            {others.map((event) => (
              <li key={`${event.gameId}#${event.ply}`}>
                <button type="button" onClick={() => onSeePosition(event)}>
                  {eventHeadline(event, sharedBand !== null)}
                </button>
                <span className="post-game__others-detail">
                  {eventFacts(event, sharedBand !== null)
                    .map((fact) => `${fact.label}: ${fact.value}`)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/*
        * ONE PRIMARY ACTION, AND THE SECOND CONTROL APPEARS ONLY WHEN IT IS A DIFFERENT ACT (LAW 2).
        *
        * This was unconditional, and when the reading's own action was "play another game" the
        * screen offered the same act twice under two labels — the card's primary and this one. Two
        * controls that resolve one state is not a choice; it is the product failing to make one.
        *
        * `onClick` COMPARISON WOULD NOT DO IT: both handlers are `onPlayAgain`, and comparing
        * function identity would couple this component to how the caller happened to pass them.
        * The reading's own state is what says whether a position is being offered, so that is what
        * is asked.
        */}
      {/*
        * THE CANONICAL ACT, WORDED FOR SOMEBODY WHO HAS JUST FINISHED A GAME.
        *
        * This was a `play-blitz` button with no condition but `lead !== null`. It is now whatever
        * the ladder says outranks -- a set in progress, a rule nobody tested, a claim awaiting its
        * forward test, or another game when nothing outranks one. The sentence is still this
        * screen's; `shared/post-game-presentation.ts` holds it and words it differently from the
        * front door's for the same act, which is the point of keeping presenters per surface.
        *
        * NOTHING IS DRAWN ON `unknown` OR `unsound`, and no old default returns in their place.
        */}
      {offer !== null && (
        <button
          type="button"
          className="post-game__again"
          {...primaryAction(offer.act)}
          onClick={onCanonicalAction}
        >
          {offer.label}
        </button>
      )}
    </section>
  );
}
