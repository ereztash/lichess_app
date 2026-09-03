/**
 * WHERE THE NEXT DECISION COMES FROM AFTER A REVEAL, or nowhere, said once.
 *
 * THE PRODUCT'S OWN DEFINITION OF CONTINUATION IS MECHANICAL, and it is written down.
 * `docs/ACQUISITION_EVIDENCE.md`'s continue row is *"board accepts the next move"* and
 * *"position advances"* -- two facts about a board. What it does not say is WHOSE move, and that
 * is where the front door came apart. Measured in Chromium at `c1d72935c038`: the board read
 * `תור לבן` before the decision and `תור שחור` after the continuation. The front door hands over
 * one position and a loaded game has no opponent, so playing the committed move simply passed the
 * turn to the side nobody plays -- and a move proposed there was accepted, answered and WRITTEN TO
 * THE RECORD, carrying a stated confidence, stored indistinguishably from a decision taken on the
 * player's own side. `docs/FINDINGS.md` had already found and named that failure -- *"the app
 * asked the player to decide for that side too"* -- and closed it for the live game only.
 *
 * TWO KINDS, BECAUSE THERE ARE TWO GAMES.
 *
 * A **live** game continues by PLAYING the move that was committed and letting the opponent
 * answer, which is what `lib/opponent.ts` is for.
 *
 * A **loaded** game -- a pasted PGN, a finished Lichess game, the front door's handoff -- has no
 * opponent by construction, and `importPgn` says why: *"No opponent for a loaded game: the other
 * side's moves are already in the PGN."* Its next position is the one already in it. The
 * continuation used to play the committed move there too, and `playMove` truncates
 * (`history.slice(0, ply + 1)`), so pressing it on a game the player had rewound into DELETED the
 * rest: an 18-ply PGN came back as 11, measured. That is LAW 4 -- *"No call to action may cause
 * something that already happened in the world to be lost"* -- and this module is the repair.
 *
 * `+ 2` AND NOT `+ 1`. `history[i]` is the position AFTER ply `i`. The player decided at
 * `revealPly` with the move theirs, so `revealPly + 1` is what they actually played and
 * `revealPly + 2` is the reply. Their next turn is two plies on; landing on the intermediate one
 * would ask them to decide for the other side.
 *
 * AND THE LANDING IS CHECKED RATHER THAN ASSUMED. Mate and stalemate are how games end, and a
 * continuation into one is the same lock wearing a legal position.
 *
 * NULL IS A FIRST-CLASS ANSWER. The front door hands over exactly one position on purpose --
 * `pickFirstDecision` trims the game *"so nothing after it can leak"* -- so a loaded handoff
 * genuinely has no second decision in it, and passing the turn to nobody is not one. Saying so is
 * the honest end of that path; `RevealNoContinuation` says it and offers the record, where the
 * anchor set hands over a position on the player's own side. Whether the reveal should route
 * there in one press is a product question this module does not answer and must not invent:
 * `docs/user-loop-integrity/FALSIFICATION_REGISTER.md` `O-1`.
 */
import { Chess } from "chess.js";

import type { AnalysisSource } from "@shared/analysis-source";
import type { GameSnapshot } from "@/lib/game-data";

export type Continuation =
  /** Play the committed move on the position it was committed in; the opponent answers it. */
  | { kind: "play" }
  /** Move along the game that is already loaded, to the ply named here. */
  | { kind: "advance"; ply: number };

export function continuationAfter(input: {
  source: AnalysisSource;
  history: readonly GameSnapshot[];
  /** The ply the open reveal's decision was taken at, or -1 when no reveal is open. */
  revealPly: number;
}): Continuation | null {
  if (input.revealPly < 0) return null;
  if (input.source === "live") return { kind: "play" };
  const ply = input.revealPly + 2;
  const landing = input.history[ply];
  if (!landing) return null;
  try {
    return new Chess(landing.fen).moves().length > 0 ? { kind: "advance", ply } : null;
  } catch {
    return null;
  }
}
