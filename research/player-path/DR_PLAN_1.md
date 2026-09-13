# DR_PLAN_1 — frozen before the calibration run and before new external research

Written 2026-09-12T14:00Z. Nothing here was optimised by R&D, Neta or any external source first.

`DR_PLAN_0.md` in `research/learning-journey/` is **not superseded and not edited**. It answered a
different question — which architecture the learning layer should express. This one asks what the
player's **path** is, from "I want to get better" to a next act they judge worth taking.

| pin | value |
| --- | --- |
| `lichess_app` head | `3d8d0237a4a9b7cd61a313944676f8cd4f7e74e5` (merged `origin/main` `65b1b01`) |
| PPSA head | `5f829f9bcb538d3909e0952c6526eedb85f79372` |
| PPSA `main` | `8ce05519813da536a956735aba3ed327c9cdbf08` |
| prior paired run | PPSA `run/nico-ux-paired-2026-09-12` `07ddf30`, Actions run 34697289632 |

---

## 1. The decision

> What is the strongest product process this app can honestly implement that converts personal
> evidence into a player-understandable path toward improvement, while preserving ownership,
> minimising time-to-value, and keeping evidence, practice, transfer and external outcome apart?

## 2. What is already settled, and must not be re-litigated

- **The claim ceiling.** `CAUSALITY`, `INTERVENTION` and `OUTCOME` are unreachable by the discovery
  pipeline under any result. No surface may promise improvement.
- **The learning layer's architecture.** States belong to a claim or a rule, not to the player; the
  three constructs (guided practice / prompted recall / unprompted play) stay apart; instrument
  silence is scoped to the instrument. Shipped and gated.
- **A goal is framing, not a denominator**, and the gate is adjacency rather than intention.

## 3. What the prior paired run already decided, and what it left open

`CAL-NICO-UX-PAIRED-2026-09-12` ran the canonical loop (`--strict`) on a **different provider
lineage** and returned `COMPLETE`. Its answer to the model question:

> Retain Truth/Perception/Action/Ownership/Effect as the compact audit surface, and use layered
> distinctions **selectively**, where they materially separate evidence validity from
> representation, action selection from execution, prompted performance from transfer, and process
> progress from rating outcome.

> The decisive delta is not adding more audit categories; it is preventing the five prompts from
> **collapsing distinct claim boundaries**.

It left the product question at `CONTINUE`, with `next_move` = verify the repository, then FIELD.

**What this plan takes from it, and treats as input rather than as the answer:** case C4, which is
the only one naming a missing *surface* rather than a missing distinction —

> surface the personal-inference promise **before** the dashboard machinery, using the user's
> advancement goal as the entry frame.

## 4. Hypotheses, stated before the run

- **H-1 (favoured).** The gap is at the **front**, not the back. The back half — evidence, claim,
  practice, prompted check, unprompted watch — is built and gated. Nothing tells an arriving player
  what this product uniquely does *before* they meet the machinery, so the value that is supposed to
  justify the wait is never offered. Repair: an entry frame carrying the player's aspiration and the
  personal-inference promise, then the machinery.
- **H-2.** The gap is time-to-value: even with a perfect frame, the first session's payoff is too
  small against 60 decisions, and no representation fixes that.
- **H-3.** The gap is the import screen specifically: it is where a player with history first meets
  the product's conclusion, and its visual claim (six rates, one visibly lowest) is stronger than
  its textual one (nothing separated).
- **H-4.** Nothing should be built. The repository work is done and only FIELD can move this.

## 5. The current default, and what reverses it

**Default: H-1.** Build the entry frame and the one next act with its payoff. Add no new progress
number, no programme, no rating denominator.

**Reversal.** Evidence that the front is not binding — that a player who is told exactly what the
product uniquely does still judges the next act not worth taking (that is H-2, and it is a
different build), or that the import screen misleads badly enough that it outranks the entry frame.

## 6. What I expect to be wrong about

I expect H-1 to survive and H-3 to be real but smaller than H-1. I expect the run to push back on
"one next act" as too strong, because a player can know the act and rationally decline it — which
the mission names and which no representation repairs.

## 7. Stopping rule

Stop when the ranking is stable and the remaining uncertainty is FIELD. Do not reopen a research
branch already recorded Δ0 in `research/learning-journey/EXTERNAL_EVIDENCE.md` unless I can state in
advance what result would change the build.

## 8. Build boundary

May build: information architecture, copy, navigation, entry framing, next-action logic, local data,
tests, gates. May not: any rating denominator, any efficacy promise, any change to the detector's
method, any destructive migration.
