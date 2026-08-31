/**
 * THE FIVE MARKS, AND THE ONE PLACE THEY ARE DRAWN.
 *
 * §11 of the master plan: a reader must be able to tell an event from a description from a
 * hypothesis from something that was tested, by looking, without reading documentation. The words
 * and the marks live in `shared/evidence-authority.ts`; this file decides nothing about them and
 * exists so that no screen can draw one itself.
 *
 * THE MARK IS A CHARACTER AND NOT AN ICON, and that is a decision with three reasons behind it. It
 * survives a stylesheet that has not loaded, it copies into a bug report, and -- the one that
 * matters -- a screen reader reaches the WORD rather than the shape, because the shape is
 * `aria-hidden` and the word is the label. A player using a screen reader gets the same
 * distinction, not a decorative glyph and a shrug.
 *
 * `data-authority` IS ON THE ELEMENT so a test can assert that two evidence levels are rendered as
 * DIFFERENT THINGS rather than merely worded differently -- the same argument `OutcomeSummary`
 * makes for `data-kind`, and it is the assertion that catches a stylesheet giving a hypothesis the
 * weight of a finding.
 */
import { AUTHORITY, type EvidenceAuthority } from "@shared/evidence-authority";

export function EvidenceMark({
  authority,
  /**
   * Whether to open the one-line explanation behind a disclosure.
   *
   * OFF BY DEFAULT. The mark and the word are the language; the explanation is for the first few
   * times somebody meets it. A card that always printed it would be teaching the language on every
   * screen forever, which is the reading-to-understand-the-product failure §12 is about.
   */
  explain = false,
}: {
  authority: EvidenceAuthority;
  explain?: boolean;
}) {
  const vocabulary = AUTHORITY[authority];
  return (
    <span className="evidence-mark" data-authority={authority} dir="rtl">
      <span className="evidence-mark__mark" aria-hidden="true">
        {vocabulary.mark}
      </span>
      <span className="evidence-mark__word">{vocabulary.word}</span>
      {explain && (
        <details className="evidence-mark__explain">
          <summary>מה זה אומר?</summary>
          <p>{vocabulary.means}</p>
        </details>
      )}
    </span>
  );
}
