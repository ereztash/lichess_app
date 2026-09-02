import type { RefObject } from "react";
import { History, Link2, Plus } from "lucide-react";

/**
 * THREE QUESTIONS, THREE ENTRIES -- not six controls at one weight.
 *
 * The rail held משחק חדש / טעינת PGN / ייבוא לפי שם / קריאה שמורה / Lichess / קובץ, and the first,
 * second, third and sixth of those all answer "give me a different position". They are one door
 * now; see `PositionSource.tsx`. The other two are NOT the same question -- one connects an
 * account, one reopens a measurement already paid for -- so collapsing them into the same door
 * would have been a label that lies.
 *
 * NOTHING HERE IS `prominent` ANY MORE. `משחק חדש` was a filled blue button, permanently the
 * loudest thing on the page, and what it offers is discarding the position the product exists to
 * measure. The blue belongs to the commitment panel's submit.
 *
 * ---
 *
 * WHY IT IS A FILE OF ITS OWN, which is a smaller claim than it looks. `Home.tsx` is under a
 * ratchet (`tests/client/the-file-that-only-ever-grew.test.ts`) that may only ever go down, and
 * the rule that comes with it is: when the file grows, move something out rather than raise the
 * ceiling. This is the extraction that paid for the comment the workbench's new reading order
 * needed. It closes over no state -- seven props, all of them already computed in `Home` -- so
 * nothing about WHERE hooks are called changed, which is the thing that made every other split of
 * that file a redesign rather than a move.
 */
export function ControlRail({
  showPositionSource,
  onTogglePositionSource,
  savedReading,
  onOpenSavedReading,
  onOpenLichess,
  fileRef,
  onImportPgn,
}: {
  showPositionSource: boolean;
  onTogglePositionSource: () => void;
  savedReading: boolean;
  onOpenSavedReading: () => void;
  onOpenLichess: () => void;
  fileRef: RefObject<HTMLInputElement | null>;
  onImportPgn: (pgn: string) => void;
}) {
  return (
    <aside className="control-rail">
      <div className="rail-label">כלי עבודה</div>
      <button
        className="rail-button"
        aria-expanded={showPositionSource}
        onClick={onTogglePositionSource}
      >
        <Plus size={16} />
        <span>עמדה אחרת</span>
      </button>
      {/*
        * The way back to a reading that has already been paid for.
        *
        * Deliberately NOT promoted: same `rail-button`, same rail. The reading is a set of
        * accuracy rates, and accuracy is precisely what this product argues is not the thing
        * worth measuring -- putting it on the front page would make the app say the opposite of
        * what its own empty calibration column says. What was broken was that a 43-second scan
        * could not be reopened at all; that is a reachability defect, not an argument for a
        * headline.
        *
        * The entry renders only once something is behind it. A button that opens an empty panel
        * is a button that lies about what the record holds.
        */}
      {savedReading && (
        <button className="rail-button" onClick={onOpenSavedReading}>
          <History size={16} />
          <span>קריאה שמורה</span>
        </button>
      )}
      {/* Not a position source: this connects an account and enables the analysis layers. */}
      <button className="rail-button" onClick={onOpenLichess}>
        <Link2 size={16} />
        <span>Lichess</span>
      </button>
      <input
        ref={fileRef}
        hidden
        type="file"
        accept=".pgn,text/plain"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onImportPgn(await f.text());
        }}
      />
    </aside>
  );
}
