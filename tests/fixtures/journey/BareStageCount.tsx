/**
 * The positive control for `GATE-CONSTRUCT-NAMED`: a stage's number with nothing saying what it is.
 *
 * This is what the surface looks like the moment somebody decides the construct line is noise. The
 * number survives, the thing that made it readable does not, and three different constructs across
 * three stages start looking like one score going up.
 */
import type { JourneyReading } from "@shared/learning-journey";

export function BareStageCount({ reading }: { reading: JourneyReading }) {
  const { count } = reading;
  return (
    <article>
      <h4>{reading.question}</h4>

      <p>{count.n}</p>

      <p>{reading.next}</p>
    </article>
  );
}
