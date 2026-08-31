/**
 * One door to the position, because the four behind it answer one question.
 *
 * THE RAIL USED TO HOLD SIX CONTROLS AT ONE WEIGHT, and they did not answer one question --
 * that was the mistake in the diagnosis this file came from. Sorted by what they actually do:
 *
 *   - משחק חדש, טעינת PGN, ייבוא לפי שם, קובץ  ->  "give me a different position"
 *   - Lichess                                   ->  "connect my account"
 *   - קריאה שמורה                                ->  "show me the reading I already paid for"
 *
 * Only the first group is one question, so only the first group is collapsed here. Putting an
 * OAuth login and a saved measurement behind a door labelled "a different position" would be a
 * control that says something other than what it does, which is the failure this codebase spends
 * its gates on. The other two stayed in the rail as their own entries.
 *
 * WHY THIS IS NEVER THE PRIMARY ACTION, and why the blue came off it. `משחק חדש` was
 * `rail-button prominent` -- a filled blue button, permanently the loudest thing in the left
 * column. The app hands you a live game at the opening position on arrival, so replacing your
 * position is never the required first step; and once you are mid-decision, the loudest control
 * on the page was an invitation to throw away the very thing the product exists to measure. The
 * primary action is the commitment panel's submit, and it can only be the loudest if nothing else
 * is painted louder.
 *
 * THE LIST IS THE DATA. Both surfaces that need it -- the menu here and the ribbon's link to one
 * named source -- read this array, so a fifth source cannot appear in one and not the other, and
 * a test can count them without a hand-maintained number.
 */
import { FileUp, Plus, Upload, UserSearch } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export type PositionSourceId = "new" | "pgn" | "username" | "file";

export interface PositionSourceEntry {
  id: PositionSourceId;
  label: string;
  /** What this one actually gives you. Never a reason to prefer it over the others. */
  detail: string;
  icon: typeof Plus;
}

/**
 * The four ways to get a position, in no ranked order.
 *
 * Ordering is by what the position IS -- a game you are about to play, then three ways of loading
 * one that is already over -- not by which the player is likely to want. Ranking by predicted
 * value is the recommendation engine the product refuses; a stable list is not one.
 */
export const POSITION_SOURCES: readonly PositionSourceEntry[] = [
  {
    id: "new",
    label: "משחק חדש",
    detail: "עמדת פתיחה מול המנוע. אתם בוחרים צבע ועומק.",
    icon: Plus,
  },
  {
    id: "pgn",
    label: "הדבקת PGN",
    detail: "משחק שכבר נגמר, מודבק כטקסט.",
    icon: FileUp,
  },
  {
    id: "username",
    label: "ייבוא לפי שם משתמש",
    /*
     * Said out loud because it is the one source that does something besides load a position: the
     * scan produces a reading, and a bucket it names in advance cuts the floor for a claim from
     * 60 revealed decisions to 40. A player choosing between four doors is entitled to know that
     * one of them has a second effect on the record.
     */
    detail: "משחקים שכבר שיחקתם ב-Lichess. הסריקה גם מייצרת קריאה, ויכולה לצמצם את החיפוש לסוג אחד.",
    icon: UserSearch,
  },
  {
    id: "file",
    label: "קובץ PGN",
    detail: "אותו דבר, מקובץ שמור במחשב.",
    icon: Upload,
  },
];

/**
 * The chooser, which is the whole of the door.
 *
 * Each entry carries its own line rather than an icon and two words, because the four are not
 * interchangeable and the rail's icon-over-label form could not say how they differ. That form
 * was affordable when the controls were permanent furniture; inside a panel opened on purpose,
 * the space is there.
 */
export function PositionSourceMenu({
  onChoose,
  onClose,
}: {
  onChoose: (id: PositionSourceId) => void;
  onClose: () => void;
}) {
  return (
    <section className="position-source" aria-label="מקורות עמדה">
      {/*
       * A visible heading, because `Overlay` only puts its label in `aria-label`.
       *
       * Every other panel that opens in one -- the PGN drawer, the import panel, the new-game
       * setup -- renders its own `.drawer-heading`, so a sighted player has always been told what
       * they opened. This one arrived without one and read as a list floating over the board.
       * Same frame as its siblings, so it reads as one of them rather than as a new kind of thing.
       */}
      <div className="drawer-heading">
        <div>
          <span>עמדה אחרת</span>
          <b>POSITION</b>
        </div>
        <button type="button" onClick={onClose}>
          סגור
        </button>
      </div>
      <ul className="position-source-list">
        {POSITION_SOURCES.map((source) => (
          <li key={source.id}>
            <button type="button" className="position-source-option" onClick={() => onChoose(source.id)}>
              <source.icon size={18} aria-hidden="true" />
              <span className="position-source-label">{source.label}</span>
              <span className="position-source-detail">{source.detail}</span>
            </button>
          </li>
        ))}
      </ul>
      {/*
       * The position you already have is a real option, and it is the only one of the five that
       * costs nothing. Stated because a panel that lists four ways to replace something implies
       * replacing it is expected.
       */}
      <p className="position-source-note">
        העמדה שעל הלוח נשארת כפי שהיא עד שתבחרו אחת מאלה.
      </p>
    </section>
  );
}

/**
 * The `pgn` source's own body, beside the menu that offers it.
 *
 * MOVED OUT OF `Home.tsx` UNDER ITS RATCHET, and to the file the menu already lives in rather than
 * to a new one: this is the third of the four sources rendering its own surface, and the argument
 * for the door being here is the argument for its rooms being here too. `new` and `username` were
 * already components; `file` is an `<input>`; this was the one still spelled out in the page.
 */
export function PgnDrawer({
  value,
  onChange,
  onLoad,
  onSample,
  onClose,
}: {
  value: string;
  onChange: (next: string) => void;
  onLoad: () => void;
  /** Fills the box with the demo game. Not a load: the player still presses the button. */
  onSample: () => void;
  onClose: () => void;
}) {
  return (
    <section className="pgn-drawer">
      <div className="drawer-heading">
        <div>
          <span>הדבקת PGN</span>
          <b>IMPORT</b>
        </div>
        <button onClick={onClose}>סגור</button>
      </div>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} dir="ltr" />
      <div className="drawer-actions">
        <button className="drawer-confirm" onClick={onLoad}>
          טען למשחק
        </button>
        {/*
         * The demo game used to BE the opening screen, which is what made the app unplayable. It is
         * still worth having -- it is the shortest way to see the review and timeline against a
         * finished game -- so it lives here, where loading it is something the player chooses.
         */}
        <button className="ghost-control" onClick={onSample}>
          הדביקו משחק לדוגמה
        </button>
      </div>
    </section>
  );
}
