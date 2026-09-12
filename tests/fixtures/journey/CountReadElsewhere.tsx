/**
 * The positive control for `GATE-CONSTRUCT-CONTAINED`, and it is the probe that escaped.
 *
 * `GATE-CONSTRUCT-NAMED` scans a paragraph for the literal `count.n` beside `count.construct`.
 * This file renders the same number with the same defect and never writes `count.n`: it
 * destructures. Written during an assurance pass as a probe, it passed every gate in the tree,
 * which is why the containment check exists and why this file is now its control.
 */
import type { JourneyReading } from "@shared/learning-journey";

export function CountReadElsewhere({ reading }: { reading: JourneyReading }) {
  const { n } = reading.count;
  return (
    <article>
      <h4>{reading.question}</h4>

      <p>{n}</p>

      <p>{reading.next}</p>
    </article>
  );
}
