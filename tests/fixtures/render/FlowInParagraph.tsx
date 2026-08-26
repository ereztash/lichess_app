/**
 * The invalid nesting, on purpose. Kept as a fixture so `findInvalidParagraphs` is proven to
 * detect the shape rather than merely proven to return an empty array -- the same reason
 * FakeEval.tsx and DenominatorlessRate.tsx sit beside it.
 *
 * NOT in the render path: tests/fixtures is excluded from the scanned roots.
 */
export function FlowInParagraph({ detail }: { detail: string }) {
  return (
    <p className="commitment-error" role="alert">
      משהו נכשל
      <details>
        <summary>פרטים טכניים</summary>
        <code dir="ltr">{detail}</code>
      </details>
    </p>
  );
}
