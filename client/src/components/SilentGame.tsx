/**
 * What a game says while the engine is not saying anything.
 *
 * WHY THIS IS A COMPONENT AND NOT A `setNotice` CALL. A notice is transient and this condition
 * lasts the whole game. A player forty moves into a deferred game with nothing on screen about it
 * is a player who cannot tell "the engine is quiet by design" from "the engine broke" -- and this
 * codebase has already shipped that confusion once, as a reveal that sat on "המנוע מחשב…" forever
 * with no control that advanced.
 *
 * IT COUNTS DECISIONS AND NOT MOVES. The number is what the record will hold; the move number is
 * what the board shows. In a game the player takes as black those differ from the first ply, and
 * a figure that says "decisions" while counting something else is the class of defect the whole
 * product exists to complain about.
 *
 * NOTHING NUMERIC ABOUT THE POSITION APPEARS HERE, which is the entire point of the mode.
 */
export function SilentGame({
  decisions,
  over,
  onSeeRecord,
}: {
  /** Decisions committed in this game so far. */
  decisions: number;
  /** Whether the game has finished, which is the moment the engine is allowed to speak. */
  over: boolean;
  onSeeRecord: () => void;
}) {
  return (
    <section className="silent-game" aria-live="polite">
      <h2 className="silent-game__title">
        {over ? "המשחק נגמר." : "המנוע שותק עד סוף המשחק."}
      </h2>
      <p className="silent-game__count">
        {/*
         * `unicode-bidi: plaintext` on the number, in the stylesheet: a bare numeral inside a
         * Hebrew sentence is neutral-direction and lands on the wrong side of its own words
         * without it.
         */}
        נרשמו <bdi>{decisions}</bdi> החלטות במשחק הזה.
      </p>
      {over ? (
        <>
          <p className="silent-game__note">
            כל החלטה נמדדה בזמן אמת ונשמרה. עכשיו אפשר לראות את כולן ביחד.
          </p>
          <button type="button" className="primary-control" onClick={onSeeRecord}>
            לרשומה
          </button>
        </>
      ) : (
        <p className="silent-game__note">
          זו האפשרות שבחרתם כשפתחתם את המשחק. אין תקלה, ואין מה לחכות לו — כל החלטה נרשמת
          ונמדדת ברגע שהיא נעשית.
        </p>
      )}
    </section>
  );
}
