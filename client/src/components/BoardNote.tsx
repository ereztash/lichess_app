/**
 * What the board is telling the player right now, in the one order that survived being looked at.
 *
 * Three paragraphs used to sit loose in `Home`'s board section, and the rule binding them lived in
 * a comment beside the third. They are one unit and are extracted as one: everything under the
 * board that speaks about the CURRENT state, ordered from the most transient to the most standing.
 *
 * THE ORDER IS THE WHOLE POINT, and each line of it was a defect first:
 *
 *   opponent thinking  -- a search running while the board changes nothing. The defect this
 *                         replaces was silence during a wait, so a silent search would restore it.
 *   the notice         -- what just happened and what to do next. The state's own sentence.
 *   the record mode    -- why the record is where it is. It never unmounts, so before the notice
 *                         it put the same eleven words between the board and the line saying what
 *                         to do, on every screen of the loop.
 *
 * NO WRAPPER ELEMENT. The three were siblings of the board inside `.board-workspace` and the CSS
 * addresses them there, so this returns a fragment: the DOM is character-for-character what it was.
 */
import { Clipboard } from "lucide-react";
import { RecordModeNotice } from "@/components/RecordModeNotice";
import type { ComponentProps } from "react";

export function BoardNote({
  notice,
  fen,
  onNotice,
  opponentThinking,
  recordMode,
}: {
  /** The state's own sentence: what happened, and what the player does next. */
  notice: string;
  /** The position the copy control puts on the clipboard. */
  fen: string;
  onNotice: (notice: string) => void;
  opponentThinking: boolean;
  recordMode: ComponentProps<typeof RecordModeNotice>;
}) {
  return (
    <>
      {opponentThinking && (
        <p className="opponent-thinking" role="status">
          היריב חושב…
        </p>
      )}
      <div className="board-note">
        <i />
        {notice}
        <button
          onClick={async () => {
            await navigator.clipboard?.writeText(fen);
            onNotice("FEN הועתק.");
          }}
        >
          <Clipboard size={14} /> העתק FEN
        </button>
      </div>
      <RecordModeNotice {...recordMode} />
    </>
  );
}
