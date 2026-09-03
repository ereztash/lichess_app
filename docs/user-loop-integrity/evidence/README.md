# Evidence

**Everything named `before-*` is the tree at `c1d72935c0389c8f301edfd4083aabb584764cc7`, before any
change on this branch.** They are a snapshot and are not updated when the product changes; `RNL-10`
is why. `after-*` are the same states on the fixed tree.

| file | what it shows |
| --- | --- |
| `before-01-the-handoff.png` | a stranger's first ever visit, under a note reading *"חזרתם למשחק שהייתם בו"* |
| `before-02-a-move-proposed-not-played.png` | the proposal mark: the piece has not moved, and the note says the choice can still change |
| `before-03-the-reveal-as-it-arrives.png` | the reveal, engine arrow present, board still on the decided position |
| `before-04-both-hands-played-under-the-reveal.png` | four plies played on that board by one person, both colours, with the reveal unchanged above it |
| `before-05-the-reveal-over-a-position-it-does-not-describe.png` | one press on the move timeline; 27 pieces became 31 and the reveal's text is byte-identical |
| `before-06-the-opponents-turn-handed-to-the-player.png` | the end of the primary journey: a commitment panel over `תור שחור`, asked of a player who was handed the position as White |
| `before-07-the-opponents-move-made-by-the-player.png` | a live game against Stockfish, the opponent's move authored by the player's gesture |
| `before-08-the-reveal-at-390x844.png` | the whole reveal, which begins at y=893 of an 844px viewport |

The JSON files are the walks' own output, one object per boundary: interaction state, board
signature, the record read back from `localStorage`, and what each attack managed to do.
`reveal-text.txt` is the reveal a player was shown, verbatim.

Screenshots that showed the same thing twice were deleted rather than committed. What is here is
what a reviewer needs in order to check the claims in `CONTRADICTIONS.md` without re-running the
walks.
