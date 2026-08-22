/**
 * The loop, and where in it you are.
 *
 * Deliberately actionless. Every action it could offer is already owned by a surface that sits
 * closer to it -- the commitment submit, the header's next-decision control, the claim panel's
 * drill button, the drill runner's own counter -- and this exists to rank those, not to repeat
 * them. See `lib/loop-position.ts` for why the card MATI puts on its home screen is the wrong
 * shape here and the ranking behind it is the right one.
 *
 * It renders in every state, including during a reveal, which is the state where nothing on
 * screen currently says where in the loop you are.
 */
import { MIN_BUCKET_N } from "@shared/detector";
import { useClaimView } from "@/lib/record-api";
import { LOOP_STEPS, STEP_LABELS, loopPosition, stepStates } from "@/lib/loop-position";

export function LoopStrip({
  drill,
}: {
  /** Progress of a running drill, or null. Passed in: the drill lives in Home's state. */
  drill: { completed: number; total: number } | null;
}) {
  const query = useClaimView();

  // Until the record answers, show the rail without a reading rather than a guessed one.
  const data = query.data;
  const scored = data?.scored ?? 0;
  const position = loopPosition({
    drill,
    recorded: data?.recorded ?? 0,
    scored,
    claimGrade: data?.claim?.grade ?? null,
    // The floor is MIN_BUCKET_N inside a bucket and MIN_BUCKET_N outside it, which is where
    // `currentClaim` gets its own threshold. Null while unreadable -- an unreadable record must
    // not render as a record at distance zero.
    scoredStillNeeded: query.isError || !data ? null : Math.max(0, MIN_BUCKET_N * 2 - scored),
  });

  if (query.isLoading) return null;

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
      <p className="loop-headline">{position.headline}</p>
      <p className="loop-basis">{position.basis}</p>
    </section>
  );
}

/** Exported for the contract test: the rail always draws every step, never only the reached ones. */
export const LOOP_STEP_COUNT = LOOP_STEPS.length;
