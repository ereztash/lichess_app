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
import { eventFacts, eventHeadline, postGameWords } from "@shared/blitz-words";
import type { BlitzEvent, PostGameReading } from "@shared/blitz-reading";
import type { StoredBlitzGame } from "@shared/blitz-record";

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
  onPlayAgain,
}: {
  game: StoredBlitzGame;
  reading: PostGameReading;
  /** How many of the player's decisions the engine scored. The old headline, demoted. */
  analysed: number;
  onSeePosition: (event: BlitzEvent) => void;
  onPlayAgain: () => void;
}) {
  const words = postGameWords(reading);
  const lead = reading.state === "nothing-to-conclude" ? null : reading.lead;
  const others =
    reading.state === "nothing-to-conclude" ? reading.worthSeeing : reading.alsoWorthSeeing;

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
        action={{
          label: words.action.label,
          because: words.action.because,
          onClick: () => (lead ? onSeePosition(lead) : onPlayAgain()),
        }}
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
        <details className="post-game__others">
          <summary>
            {others.length === 1 ? "ההחלטה שכדאי לראות" : `${others.length} ההחלטות שכדאי לראות`}
          </summary>
          <ul className="post-game__others-list">
            {others.map((event) => (
              <li key={`${event.gameId}#${event.ply}`}>
                <button type="button" onClick={() => onSeePosition(event)}>
                  {eventHeadline(event)}
                </button>
                <span className="post-game__others-detail">
                  {eventFacts(event)
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
      {lead !== null && (
        <button type="button" className="post-game__again" onClick={onPlayAgain}>
          משחק חדש
        </button>
      )}
    </section>
  );
}
