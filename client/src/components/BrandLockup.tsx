/**
 * The product's one mark, and the way back to the record.
 *
 * EXTRACTED RATHER THAN COPIED, and the reason is the defect this pass found on `/blitz`. The
 * lockup lived inline in `Home.tsx`, so it existed on exactly one of the three routes: the game
 * screen had no header, no brand and no way out except resigning, and the front door has none
 * either. A mark that appears on one route out of three is not an identity, it is a decoration on
 * one page.
 *
 * IT CARRIES ITS OWN ACCESSIBLE NAME. Below 560px the stylesheet stops painting the wordmark --
 * 196px of lockup does not fit beside 194px of controls on a 390px screen, and the two overlapped
 * by twenty measured pixels before this pass. `display: none` removes text from the accessibility
 * tree as well as from the page, so the name is on the button and does not depend on the text
 * being painted.
 */
interface BrandLockupProps {
  /** Where the mark goes. The record, everywhere it is used. */
  onNavigate: () => void;
}

export function BrandLockup({ onNavigate }: BrandLockupProps) {
  return (
    <button
      type="button"
      className="brand-lockup"
      aria-label="DECISION LAB — לרשומה"
      onClick={onNavigate}
    >
      <div className="brand-mark" aria-hidden="true">
        ♞
      </div>
      <div>
        <p className="brand-name">DECISION LAB</p>
        <span>COMMIT · THEN REVEAL</span>
      </div>
    </button>
  );
}
