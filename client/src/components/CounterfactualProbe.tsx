/**
 * "אם לא היית עושה את זה, מה כן היית עושה?"
 *
 * Asked once the move is locked and before the engine has said anything -- the only window in
 * which the answer is the player's own candidate rather than a reconsideration or an echo. See
 * shared/counterfactual-stage.ts for why that window has a hard edge on both sides.
 *
 * THERE IS NO SKIP, AND THAT IS A MEASUREMENT DECISION RATHER THAN A NAG. A dismissable question
 * fills the probed arm with the decisions where the player HAD an answer ready -- which is
 * exactly the population most likely to differ from the control on the thing being measured. So
 * "I had nothing else" is a first-class answer with a button of its own: it records an answered
 * probe carrying no move, which is a fact about the player rather than a gap in the data. On the
 * four readings it may be the most informative answer available.
 *
 * NOTHING NUMERIC APPEARS HERE. The engine has not run, so any figure on this panel could only be
 * a placeholder -- and a placeholder here is indistinguishable, to the person reading it, from a
 * reading they would then be answering against.
 */

/**
 * The alternative is played ON THE BOARD, the same way the committed move was chosen, rather than
 * typed into a field. A move field would ask a player to write coordinates for a move they can
 * see, and the only people who find that natural are the ones who already think in notation --
 * which is a different population from the one this instrument is for.
 */
const HOW = "שחקו על הלוח את המהלך שהייתם עושים במקום זה.";

export function CounterfactualProbe({
  chosenMove,
  alternative,
  pending,
  onAnswer,
}: {
  /** The move that was just committed. Shown because the question is about that move. */
  chosenMove: string;
  /** What the player has put on the board so far, or null before they have put anything. */
  alternative: string | null;
  pending: boolean;
  onAnswer: (alternative: string | null) => void;
}) {
  /*
   * The committed move is not an answer to "what would you have played instead", and a board
   * interaction produces it easily -- the piece is already on that square. Accepting it would
   * store a row whose two moves are the same, which `classifyCounterfactual` would then read as
   * `both-good` or `neither` on the strength of the chosen move alone.
   */
  const sameMove = alternative !== null && alternative === chosenMove;
  const named = alternative !== null && !sameMove;

  return (
    <section className="counterfactual-probe" aria-labelledby="counterfactual-probe-question">
      <h2 id="counterfactual-probe-question" className="counterfactual-probe__question">
        אם לא היית עושה את זה, מה כן היית עושה?
      </h2>
      <p className="counterfactual-probe__committed">
        המהלך שנרשם: <bdi>{chosenMove}</bdi>
      </p>
      <p className="counterfactual-probe__how">{HOW}</p>
      {sameMove && (
        <p className="counterfactual-probe__same" role="status">
          זה אותו מהלך שנרשם. השאלה היא מה הייתם עושים במקומו.
        </p>
      )}
      <div className="counterfactual-probe__actions">
        {named && (
          <button
            type="button"
            className="counterfactual-probe__confirm"
            disabled={pending}
            onClick={() => onAnswer(alternative)}
          >
            רשמו <bdi>{alternative}</bdi> כחלופה
          </button>
        )}
        <button
          type="button"
          className="counterfactual-probe__none"
          disabled={pending}
          onClick={() => onAnswer(null)}
        >
          לא היה לי מהלך אחר
        </button>
      </div>
    </section>
  );
}
