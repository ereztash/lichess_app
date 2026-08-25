/**
 * The loop, and where in it you are -- the PICTURE half.
 *
 * Deliberately actionless. Every action it could offer is already owned by a surface that sits
 * closer to it -- the commitment submit, the header's next-decision control, the claim panel's
 * drill button, the drill runner's own counter -- and this exists to rank those, not to repeat
 * them. See `lib/loop-position.ts` for why the card MATI puts on its home screen is the wrong
 * shape here and the ranking behind it is the right one.
 *
 * It renders in every state, including during a reveal, which is the state where nothing on
 * screen currently says where in the loop you are.
 *
 * THE SENTENCE MOVED OUT, and the rail stayed. `position.headline` -- the one line naming what
 * stands between here and the next step -- used to render here, under the four steps. This strip
 * sits beside the record it describes, which was the first child of the decision column and is
 * now below the panel, and on a 390x844 phone that put the line at y=1368: five hundred pixels
 * below the fold, on the thing a player most needs BEFORE they act. It is in `ContextRibbon` now,
 * at the top of the page, computed from the same hook so the two cannot drift.
 *
 * The rail did not move with it, on purpose. It is a picture of four steps and it means something
 * next to the record; the sentence means something before anything.
 */
import { LOOP_STEPS, STEP_LABELS, stepStates } from "@/lib/loop-position";
import { useLoopPosition, type DrillProgress } from "@/lib/use-loop-position";

export function LoopStrip({
  drill,
}: {
  /** Progress of a running drill, or null. Passed in: the drill lives in Home's state. */
  drill: DrillProgress;
}) {
  const { position, loading } = useLoopPosition(drill);
  if (loading || !position) return null;

  return (
    <section className="loop-strip" aria-label="מיקום בלולאה">
      <ol className="loop-rail">
        {stepStates(position.step).map(({ step, state }) => (
          <li key={step} className={`loop-step ${state}`}>
            <span aria-hidden="true" />
            <b>{STEP_LABELS[step]}</b>
            {state === "live" && <span className="loop-here">כאן</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Exported for the contract test: the rail always draws every step, never only the reached ones. */
export const LOOP_STEP_COUNT = LOOP_STEPS.length;
