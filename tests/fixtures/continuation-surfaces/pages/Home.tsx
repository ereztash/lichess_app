/**
 * THE PRODUCT AS IT STOOD BEFORE LEARNING-COMMITMENT CONTINUITY, kept as a control.
 *
 * `continue-run` had exactly one caller in the whole client -- `Home.tsx`'s header, under
 * `revealed && revealedDecisionId && learningTransfer && learningTransferStage === "running"` -- so
 * the only way to reach the act was to already be inside the run it continues. Navigate away and
 * the record still held the open set, every other screen still offered a new game at full weight,
 * and nothing said a set was waiting.
 *
 * NOT CONTRIVED. This is the condition and the control copied off `Home.tsx` at `23583ae`, which is
 * what makes it a fair control: a gate that only fails against an obviously broken fixture has not
 * been shown to catch the thing that actually shipped.
 *
 * IT LIVES AT `pages/Home.tsx` INSIDE THE FIXTURE, and the path is load-bearing. The gate excludes
 * the page that RUNS drills and transfers by name, because its own control is the in-run one by
 * construction -- so a fixture at any other path would be counted as an off-run caller and the
 * control would go green, which is a control that proves nothing. The directory is the real tree in
 * miniature, carrying exactly the topology that shipped.
 *
 * NEVER IMPORTED BY THE APP. `GATE-CONTINUE-REACHABLE-OFF-RUN` scans this directory and nothing
 * else does.
 */
import { primaryAction } from "@shared/primary-action";

export default function Home({
  running,
  onNext,
}: {
  running: boolean;
  onNext: () => void;
}) {
  return (
    <header className="studio-header">
      {running && (
        <button className="primary-control" {...primaryAction("continue-run")} onClick={onNext}>
          העמדה הבאה
        </button>
      )}
    </header>
  );
}
