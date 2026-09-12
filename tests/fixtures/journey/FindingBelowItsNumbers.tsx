/**
 * The positive control for `GATE-FINDING-OUTRANKS-ITS-NUMBERS`, and it is the shipped defect.
 *
 * This is what the import panel did: the rates first, in the panel's largest type, and the sentence
 * saying they do not separate last, through `NotMeasured` -- which is `.value-provenance`, the small
 * grey register this codebase reserves for where a number came from. Nothing here is untrue. The
 * finding is simply rendered after, and quieter than, every number it is about.
 */
import { NotMeasured, Proportion } from "@/components/Value";

export function FindingBelowItsNumbers({
  buckets,
}: {
  /* The real panel's row shape: a rate per bucket, which is a quantity readers rank. */
  buckets: { scope: string; accurateRate: number; n: number }[];
}) {
  return (
    <section className="import-diagnostic">
      <ul className="bucket-list">
        {buckets.map((b) => (
          <li key={b.scope}>
            <span className="bucket-scope">{b.scope}</span>
            <Proportion value={b.accurateRate} n={b.n} label="דיוק" />
          </li>
        ))}
      </ul>

      <NotMeasured reason="הסוגים שנמדדו קרובים זה לזה יותר מטעות הדגימה שלהם." />
    </section>
  );
}
