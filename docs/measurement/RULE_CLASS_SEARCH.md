# Is there a rule class where knowledge → action is identifiable at all?

**Answer: yes — one, out of five candidates and two anchors. It is a defensive threat-recognition
rule, not a capture rule.**

**Result: `RC-06 answer-the-mate-threat` is ELIGIBLE. Every other candidate scores BELOW the
refuted incumbent.**

---

## Why this search replaced the one proposed in GO_NO_GO

[`GO_NO_GO.md`](GO_NO_GO.md) proposed adjudicating 200–300 hanging-piece items with strong players
as the next step. **The owner overrode it, and the reason is right:** even 95% agreement between
two grandmasters would only have produced a better detector of *when it is worth taking an
unprotected piece*. That is already a different construct — closer to SEE than to a rule about
unprotected pieces — and the effort would have gone into rescuing a rule class rather than asking
whether a sharper one exists.

The finding that made the override correct is the one from the first iteration:

> **T can be objectively true without having a single correct B.**

"This piece is undefended" is a fact a program settles exactly. Stockfish still says taking it
loses ≥100 cp on 15.0% of those positions. So the question is not *how do we rescue this rule
class*. It is: **does any rule class exist in which the trigger determines a correct action
sharply enough that `knowledge → action` is identifiable?** That is a question about chess, not
about people, and it is answerable with nobody recruited.

---

## Method

Seven rule classes, each a pair of pure functions (`research/measurement/rule_classes.py`).
`trigger(board, context)` has **no parameter through which the played move could reach it** —
C1 is a property of the signature, not a promise. `satisfies(board, move, context)` takes one move
and returns a boolean, with no engine and no SEE in scope — C2 and C7 likewise.

**The same 60,000 unfiltered rated games, the same seed, the same sampled plies** as the first
study: 180,000 positions, 12,119 of them in check. Everything except `RC-03` is read on the
not-in-check subset; `RC-03` lives only in the positions that exclusion removes, so it gets its own
denominator instead of being declared untestable.

**`B_valid` is measured from outside the rule.** Stockfish 17.1 at 200,000 nodes is asked for its
own best move, and that move is asked whether it satisfies `B`. The rule never grades itself.
250 items per cell, 3,500 searches, 0 engine failures.

**No threshold is invented.** Two anchors are measured under the identical harness:

- **ceiling — `RC-00 mate-in-one`.** The sharpest a chess rule class can be.
- **floor — `RC-01 loose-piece`.** The refuted incumbent, re-measured here so the comparison is
  one instrument rather than two studies.

`position_between_anchors` puts 0 at the incumbent and 1 at the ceiling. Every judgement below is a
comparison between measurements.

---

## The result

| | rule class | family | B_valid T+ | B_valid T− | separation | **anchor** | chance rate T+ | base rate T+ | max \|SMD\| | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RC-00 | mate-in-one | immediate mate threats | **1.000** | .168 | +0.832 | **1.00** | .110 | 0.70% | 1.455 | *ceiling* |
| **RC-06** | **answer-the-mate-threat** | **threat recognition** | **.968** | .200 | **+0.768** | **0.72** | .317 | 1.24% | 0.573 | **ELIGIBLE** |
| RC-01 | loose-piece | tactical safety | .784 | .184 | +0.600 | **0.00** | .046 | 7.00% | 0.487 | *floor* |
| RC-05 | safe-promotion | promotion races | .568 | .124 | +0.444 | −0.67 | .053 | 0.22% | 0.806 | fails G5 |
| RC-04 | save-the-attacked-piece | forced defensive responses | .708 | .296 | +0.412 | −0.81 | .240 | 12.93% | **0.249** | fails G5 |
| RC-02 | recapture | recapture decisions | .660 | .260 | +0.400 | −0.86 | .050 | 11.67% | 0.742 | fails G5 |
| RC-03 | capture-the-checker | responding to check | .956 | **.680** | +0.276 | −1.40 | **.543** | 16.97% † | 0.462 | fails G5 |

† of in-check positions, its own denominator.

**Five of five candidates would have been called successes by `B_valid | T+` alone.** Four of them
are below the rule class already shown to be uninterpretable. The column that separates them is
`B_valid | T−` — whether the prescribed act *stops* being right when the trigger goes away — which
is the column a one-sided screen would never have computed.

**`RC-03 capture-the-checker` is the trap.** `B_valid | T+` = .956 looks like a winner. Its chance
rate is **.543**: in check there are so few legal moves that capturing the checker is often *the*
move regardless of whether the checker is defended. Its separation is the worst in the table. Its
players confirm it — hit rate .944, false-alarm rate .631, criterion **−0.963**: humans capture the
checker almost whenever they can, defended or not. Without the `prescription_size` guard this would
have been reported as the discovery.

---

## RC-06, in detail

**The prescribed act is the engine's own best move on 242 of 242 T+ items where the rule prescribes
anything at all.**

| | T+ | T− |
| --- | --- | --- |
| B_valid | **.968** [.938, .984] | .200 [.155, .254] |
| items where nothing satisfies B | 3.2% | 16.4% |
| **B_valid among items where something does** | **1.000** | .239 |
| following the rule loses ≥100 cp | **2.9%** | 34.0% |
| cp loss of following the rule, median (Q1, Q3) | **+1** (−7, +14) | +49 (+5, +150) |
| chance rate (share of legal moves satisfying B) | .317 | .101 |

The 3.2% are positions where **mate cannot be stopped** — the game is already lost. Those are not
failures of the rule; they are items where the rule has nothing to say, and they are counted rather
than dropped.

**Following the rule costs a median of one centipawn.** The incumbent's prescribed act is a ≥100 cp
error on 14.0% of its T+ items; RC-06's on 2.9%.

**And it is the only rule class in the table whose player sensitivity orders rating bands.**

| band | *d′* | *c* |
| --- | --- | --- |
| 1200–1400 | 1.180 | +0.257 |
| 1400–1600 | 1.274 | +0.153 |
| 1600–1800 | 1.535 | −0.008 |
| 1800+ | **1.666** | −0.113 |

Monotone across every band, span 0.49 — against the incumbent's non-monotone span of 0.27. The
criterion moves too, so this is not a clean sensitivity-only story; but it is the first time
sensitivity has moved in the right order at all.

### Why this family works when the capture families do not

The mechanism is structural, and it explains the whole table.

**An offensive rule competes with the entire rest of the board.** "Take the loose piece" is wrong
whenever something better exists — a bigger capture, a mate, an attack — and something better
often does. The rule's prescription has to beat every alternative in the position.

**A defensive rule against mate has no competition, because the alternative is losing.** If you do
not stop the mate, nothing else you might have done matters. The severity of the alternative is
what protects the prescription, and it is visible in the cp-loss distributions: +1 median for
RC-06 against +152 median for the incumbent's T− cell.

That is a general statement about which rule classes can be measured this way, and it predicts
that the next candidates worth trying are **defensive and severity-protected**, not offensive.

---

## The five gates, and why each is a comparison

Applied by `research/measurement/decide_rule_class.py` to the measurements, so the recommendation is
derived rather than asserted, and `tests/research/measurement-rule-class-screen.test.ts` fails the
build if the document and the data disagree.

| gate | what it asks | why it is not a threshold |
| --- | --- | --- |
| **G1 structural** | `c3_grade` is not `defined-by-a-chosen-action` | that grade is what Lichess's `hangingPiece` theme is — computed from the solution move, so B sits inside T |
| **G2 testable** | both cells produced items under this candidate's own exclusion | a count |
| **G3 occurs** | the trigger fires in an unfiltered corpus (C9) | a count |
| **G4 beats chance** | `B_valid \| T+` > mean `prescription_size` on T+ | **the chance rate is derived per item** — the share of legal moves that satisfy B *is* what picking a permitted move at random would score |
| **G5 beats the incumbent** | separation > the refuted incumbent's separation | measured under the same harness, in the same run |

All five candidates passed G1–G4. **Only RC-06 passed G5**, which is the gate that asks whether a
candidate is worth preferring to a rule class we already know does not work.

---

## What this does not establish

**Eligibility is not sufficiency, and RC-06 does not clear the problem that ended the first
iteration.** Its maximum standardised mean difference between T+ and T− is **0.573**. T+ items —
"the opponent threatens mate" — are systematically different positions from T− items. Everything
[F2](FALSIFICATION_REGISTER.md#f2) says still applies, and `negative-controls.ts::itemDifficultyConfound`
still shows an agent with zero discrimination ability producing a large *d′* on unbalanced items.

**No sharpness/exchangeability trade-off is claimed.** The two extremes look like one — the ceiling
has the worst balance (1.455) and the best-balanced candidate has weak sharpness (RC-04, 0.249) —
but across all seven, Spearman ρ = 0.536, *p* = 0.215, **n = 7**. That is not evidence. It is
recorded as a hypothesis for a larger set of candidates, not as a finding.

**Non-monotone player sensitivity is not diagnostic.** The ceiling anchor's own *d′* is
non-monotone (1.946, 2.040, 2.187, 2.085) despite prescriptive validity of exactly 1.000. So the
incumbent's non-monotonicity, reported in [F10](FALSIFICATION_REGISTER.md#f10), cannot be read as
proof that its rule class was the problem. **This corrects an over-reading in that entry.**

**The base rate is low.** RC-06 fires on 1.24% of not-in-check positions — 2,080 items in 180,000.
Real, but a within-person design would need a lot of games per person, or constructed items, and
constructed items reopen [F9](FALSIFICATION_REGISTER.md#f9).

**C8 support is for detection, and only detection.** The literature search over rule classes rather
than measurement methods found validated, expertise-sensitive paradigms for **check detection**
(Sheridan & Reingold 2014; Rosch & Vogel 2022 — a check/no-check priming task with an expert
congruency advantage), **mate detection** (Kuchelmeister et al. 2024 — n-mate tasks on a real board
with eye tracking), and **threat detection** (counting the pieces forming a threat relationship;
experts fixate them within the first three seconds). **Every one measures whether the player SAW
it. None measures whether the seeing governed the move.** That is the same gap this program keeps
arriving at, now confirmed from the rule-class side as well as the measurement side.

---

## Families rejected on structure, before measurement

Recorded so the search is not silently narrower than it claims.

| family | why |
| --- | --- |
| legal/illegal tactical affordances | illegal moves are unplayable in any interface this could ship; B has no variance |
| prohibitions ("do not move a piece to a square a cheaper piece attacks") | hits are non-events — complying looks identical to never having considered it — and the noise trial would be every other move, so the false-alarm cell has no natural denominator |
| positional maxims ("capture toward the centre") | no board-only trigger exists; the condition is a judgement, which C3 forbids |

**One earlier rejection was overturned.** [`ITEM_BANK_PROTOCOL.md`](ITEM_BANK_PROTOCOL.md) rejected
recapture because "T requires a prior move, so it is not a property of a position". That was too
strict: history *before the player's turn* is available before behaviour, which is what C1 actually
asks. Recapture was implemented and measured — and then failed G5 on its merits (`B_valid | T+` =
.660), which is a much better reason to set it aside than the one originally given.

---

## Where this leaves the program

The stop rule was: before a human pilot, find at least one candidate where, on a large unfiltered
corpus, `P(B_valid | T+) ≫ P(B_valid | T−)`, and where B does not fall apart when checked from
outside the way `capture(target)` did.

**`RC-06` meets it.** .968 against .200, checked by an engine that never saw the rule, with the
prescribed act costing a median of one centipawn and being an outright error on 2.9% of items
rather than 15.0%.

**That does not make it pilot-ready.** What it establishes is the thing the search was for: a rule
class in which `knowledge → action` is identifiable in principle now exists, so the failure of the
first iteration was a failure of that rule class and not a proof that the paradigm is impossible.

**Next, in order — and none of it is a product feature:**

1. **Exchangeability for RC-06.** Max |SMD| 0.573 is the live blocker. Matching, or Sheridan-style
   minimal transformation (Frame C in the protocol), measured rather than assumed.
2. **More defensive, severity-protected candidates**, chosen by the mechanism this screen exposed
   rather than by browsing families: stop a mate in two, stop the loss of a queen, answer a
   discovered attack. If several pass, a multiple-baseline design across rule classes
   ([`ANALYSIS_PLAN.md`](ANALYSIS_PLAN.md) §2.2) becomes possible — and that design needs at least
   three independently measurable rule classes, which one candidate cannot supply.
3. **Only then** the measurement-reactivity arm ([F7](FALSIFICATION_REGISTER.md#f7)), and only then
   a human pilot.

**And if the next round of candidates all fail**, that is the important negative: it would say the
one that passed did so because mate is uniquely severe, that rule use is not identifiable from the
final move alone in general, and that the program has to move to process evidence or a different
paradigm.
