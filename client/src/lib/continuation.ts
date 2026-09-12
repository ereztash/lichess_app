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
 * AND THE LANDING IS CHECKED ON THE `advance` BRANCH. Mate and stalemate are how games end, and a
 * continuation into one is the same lock wearing a legal position.
 *
 * IT IS NOT CHECKED ON `play`, AND THAT IS A GAP RATHER THAN A DECISION. A live game's landing is
 * the position after the committed move AND the opponent's reply, neither of which exists yet when
 * this runs -- so the check would have to move to the caller. A player who commits mate therefore
 * still reaches `deciding` on a finished board. Nothing in this mission drove it, an adversarial
 * pass established it from source, and it is recorded in
 * `docs/user-loop-integrity/FALSIFICATION_REGISTER.md` rather than repaired by guesswork about
 * what a finished live game should offer.
 *
 * AND "NO REVEAL IS OPEN" IS NOT A PLY. It used to be `-1`, and `-1` is also where a game starts.
 *
 * `runReveal` is handed `positionPly = currentPly`, and `currentPly` is `-1` on a board whose
 * history is empty -- which is every game `newGame` deals, because it clears the history and the
 * player's opening move has not been played yet. So the opening decision of a live game produced
 * `revealPly: -1`, the guard below read it as "no reveal is open", and the reveal came back with
 * no continuation at all. Measured in Chromium on the built bundle at `4b322f2`, twice, on a game
 * started through `משחק חדש` with the default `אחרי כל החלטה`: `CONTINUATION_CTA` absent, the board
 * refusing every move, and the only ways on a bank position in a different game and the record.
 *
 * WHAT IT COST, which is more than one button. The only purpose a live game could then record was
 * `first`, because `play` needs a ply that is not the first decision's -- and `first` is refused by
 * `discovery` in `shared/evidence-policy.ts`. The population the whole search is defined over could
 * not be fed by the default route to a live game at all.
 *
 * SO THE CALLER SAYS IT INSTEAD. `null` means no reveal is open, `Home` derives it from
 * `stage === "revealed"` -- the one place that opens a reveal, on the line below the one that sets
 * `revealAt` -- and no ply has to stand in for a state any more.
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
  /** The ply the open reveal's decision was taken at, or null when no reveal is open. */
  revealPly: number | null;
}): Continuation | null {
  if (input.revealPly === null) return null;
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
