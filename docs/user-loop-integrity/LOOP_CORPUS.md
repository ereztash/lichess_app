# The loops, and where each one stops

Audited by complete user job, not by component. Every row was driven in Chromium against
`dist/public` at the baseline SHA before anything was changed; the scripts and raw JSON are in
`evidence/`.

| id | loop | driven | verdict at baseline |
| --- | --- | --- | --- |
| **L-A** | front door → a position from the player's own game → propose → commitment → commit → wait → reveal → payoff → next | yes, 5 viewports | **stops at "next"** |
| **L-B** | live game vs the engine opponent: my turn → decide → commit → reveal → opponent → my turn | yes | **continues, and the player could take the opponent's turn as well** |
| **L-C** | blitz: start → play → finish → persist → analysis → post-game → continue | source read; **not driven** | board authority held for `reviewing` and **for nothing else** — see below |
| **L-D** | imported / history: PGN or Lichess → position → decision → stored evidence | yes | **continuing destroyed the loaded game** |
| **L-E** | record / claim: evidence accumulates → enough or not → claim or silence | not driven | not examined by this mission |
| **L-F** | learning: finding → rule → drill → prospective observation | not driven | not examined by this mission |
| **L-G** | failure recovery | partially (engine-failure path exists and is gated) | not examined by this mission |

`L-E`, `L-F` and `L-G` are named so the omission is visible. This mission examined the decision
loop and the two loops that feed it.

---

## L-A, step by step, as measured

| step | what the product did | boundary |
| --- | --- | --- |
| arrive | front door, one primary control (`play-first-decision`) | — |
| handover | 64 squares, 27 pieces, the player's own game; note reads *"חזרתם למשחק שהייתם בו — 24 חצאי־מהלכים"* on a **first ever** visit | state legibility |
| propose | 12 of 13 own pieces offer targets; **14 of 14 opponent pieces accept selection and offer none** | **authority** |
| commitment | four steps, chips invert on press, submit blocked until required steps answered | acknowledgment: held |
| commit | record written before the engine runs (`decisions: 1`, `reveals: 0`); note: *"ההחלטה נרשמה. המנוע מחשב עכשיו"* | commit boundary: held in the record |
| wait | no primary action offered; the note names what is being worked on | held |
| reveal | panel arrives; note **still says the engine is computing** | **acknowledgment** |
| board, after | **a press plays a move — for either side** | **authority** |
| payoff | at 1440x900 the finding sits at y=444 of a 900px viewport; at 390x844 the reveal begins at y=893 of an 844px viewport | measured, see `evidence/attack-KM.json` |
| — | *(the same measurement on the repaired tree: 899 and 1144 at 390x844, 199 and 444 at 1440x900)* | re-measured |
| next | the continuation plays the committed move and hands over **the opponent's turn**, and a decision taken there is recorded as the player's own | **loop closes on the wrong hand** |

## The one that decided the mission, and the correction that sharpened it

The last row is not an attack. It is the plain path, with nothing done to it, at
`c1d72935c0389c8f301edfd4083aabb584764cc7`, reproduced in a worktree of the untouched baseline:

```
BEFORE_DECISION_1_META  "DECIDE  12. d6  תור לבן"      ← the player is White
AFTER_CONTINUE_META     "DECIDE  13. Bd8  תור שחור"    ← and is now asked to decide for Black
WHITE  null
BLACK  {"from":"b8","to":"d7"}
DECISIONS_AFTER_SECOND  2
```

The player commits, the committed move is played, and the position handed back is **the
opponent's turn**. A move proposed there is accepted, the commitment is answered, and the decision
is **written to the record** — indistinguishable from a decision the player took for their own
side.

### `L-C`, corrected

This row said the blitz board's authority was **held**. It was held for one of three states.
`Blitz.tsx` read `reviewing ? "none" : "play"`, so a **finished** game and a game with an instrument
question open both granted `play` — while `legal` is computed only while `phase === "running"` and
`onMove` refuses. A press there lit a square with nothing behind it, which is `ULI-X-07` on the
screen this mission held up as the one that had the rule right. Found by an adversarial pass, from
source. The authority is now `onMove`'s own condition, character for character, plus `reviewing`:
two guards that must agree are one guard, and the one that drifts is the copy.

**`L-C` was still not driven.** It is read, not walked, and this row says so now.

> ### A correction, kept rather than tidied away
>
> The first pass of this walk probed White's pieces only, found none with a legal move, and
> reported a **soft lock**. That was wrong, and it was wrong in the direction that flatters the
> finding: it is not a lock, the loop continues. Re-probing both colours produced the trace above.
> What is actually wrong is worse than a lock and quieter: `docs/FINDINGS.md` had already found
> this exact failure once — *"the app asked the player to decide for that side too"* — and closed
> it by giving the **live** game an opponent. The front door's handoff still does it, and now it
> stores the answer.
