# Is there a rule class where knowledge → action is identifiable at all?

**Answer: yes — one, out of fifteen candidates and two anchors. It is a defensive
threat-recognition rule, not a capture rule.**

**Result: `RC-06 answer-the-mate-threat` is ELIGIBLE. All fourteen other candidates score BELOW the
refuted incumbent.**

> **Round 3 retracted round 2's headline.** Five candidates designed to round 2's own design rule
> did not beat the incumbent, and adding them **reversed** which cell correlates with separation
> (see [round 3](#round-3--designing-to-the-rule-breaks-the-rule)). The correlations below describe
> the rule classes that had been tried when they were computed — **not chess**.
>
> **Round 2 changed the explanation, not the winner.** Five more candidates were built to test the
> mechanism round 1 proposed — that severity protects the prescription. **Severity holds on the
> positive side and turns out to be the less important half.** What decides whether a rule class is
> usable is its *noise* cell: Spearman(separation, `B_valid | T−`) = **−0.811, p = 0.001, n = 12**,
> against **+0.476, p = 0.118** for the positive cell. See [round 2](#round-2--the-severity-ladder).

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

## Round 2 — the severity ladder

Round 1 explained its own result with a mechanism: an offensive rule competes with the whole board
and is wrong whenever something better exists, while a defensive rule against mate has no
competition because the alternative is losing. **A mechanism that only explains the data it was
derived from is a story**, so it was written into
`research/measurement/rule_classes.py::PREDICTIONS` as two falsifiable claims *before* the second
screen ran:

- **H1 — severity.** `B_valid | T+` declines monotonically down a severity ladder:
  mate > queen > rook > minor.
- **H2 — outcome over method.** `RC-09` (outcome: *the threat is gone*) scores above `RC-11`
  (method: *move the piece*), on an identical trigger and an identical noise cell. This is the
  controlled version of the `RC-04` vs `RC-06` contrast, which differed in **both** trigger and
  prescription and therefore could not separate the two explanations.

Five new candidates, appended after `RC-06` so every seeded draw for the published seven is
unchanged. **They reproduce exactly** — same 180,000 positions, same 12,119 in check, identical
trigger counts and identical `B_valid` on all seven.

Three rungs share one noise cell — *the only thing at stake is a pawn* — so they differ from each
other in exactly one thing.

### H1: confirmed

| rung | at stake | `B_valid \| T+` |
| --- | --- | --- |
| RC-06 | **mate** | **.968** |
| RC-07 | queen | .800 |
| RC-08 | rook | .704 |
| RC-09 | minor | .648 |

Monotone decreasing, span **0.32**. Severity does protect the prescription.

### H2: split, and the naive reading is refuted

| | `B_valid \| T+` | `B_valid \| T−` | separation |
| --- | --- | --- | --- |
| **RC-09** outcome — *the threat is gone* | **.648** | .452 | +.196 |
| **RC-11** method — *move the piece* | .596 | **.144** | **+.452** |

The outcome prescription is more often **correct** (+.052) and far less **specific**. Answering a
pawn threat *by any means* is the engine's own best move **45.2%** of the time; *moving the pawn*
is best only **14.4%**. On `RC-11`'s noise cell the median cost of following the rule is **+94 cp**
and 46.7% of the time it loses ≥100 cp — a real error, which is what a noise cell has to be.

**So "outcome prescriptions beat method prescriptions", inferred in round 1 from the confounded
`RC-04` vs `RC-06` pair, is not supported by the controlled test.** It wins one half and loses the
other, and the half it loses is the one that matters.

### The finding: the noise cell decides, not the trigger

Across all twelve rule classes:

| | Spearman ρ with separation | *p* | n |
| --- | --- | --- | --- |
| `B_valid \| T+` — how often the rule is right when it fires | +0.476 | 0.118 | 12 |
| **`B_valid \| T−` — how often it is right when it should not fire** | **−0.811** | **0.001** | 12 |

Decomposing `RC-06`'s advantage over `RC-07`, the most severe material rung:

```
Δ B_valid|T+   =  .968 − .800  =  0.168
Δ B_valid|T−   =  .432 − .200  =  0.232      ← 58% of the total
Δ separation                    =  0.400
```

**More than half of the winner's margin comes from its noise cell.** `RC-06` is sharp not mainly
because answering a *mate* threat is usually right, but because answering a mere *check* threat is
usually wrong (.200) — where answering even a pawn threat is often right (.432).

The refined mechanism, which round 1 got half right:

> **Severity protects the prescription on the positive side and does nothing for the negative
> side. A rule class is usable only when the trigger is severe AND its absence is genuinely inert
> — when *not* acting is actually correct once the trigger is gone.**

Both halves are necessary and the table now contains a clean demonstration of each failing alone:
`RC-07` has a decent positive cell (.800) and a bad noise cell (.432); `RC-11` has the second-best
noise cell in the table (.144) and a weak positive cell (.596). Neither is eligible.

**This inverts the search strategy.** Round 1's advice was to look for severe triggers. That is
now the *lesser* criterion. The next candidates should be chosen by their noise cell first: find
triggers whose **absence makes the prescribed action clearly wrong**, then check severity.

### A defect the guard caught

`RC-12 stop-the-promotion` first scored `B_valid | T+` = .976 with a `prescription_size` of
**.969** — 97% of legal moves appearing to answer the threat, which cannot be true. The cause was a
double null move: the helper that asks "can the opponent promote safely" was called *after* our
move was pushed, handing the turn back to us so it counted **our** promotions. Fixed, it scores
**.456 / .416, separation +.040** — no discrimination at all.

**The guard that exists to stop a vacuous prescription from scoring well is what surfaced a bug in
the prescription itself.** Without `prescription_size` this would have entered the table as the
second-best candidate.

### Round 2 results in full

| | rule class | B_valid T+ | B_valid T− | separation | anchor | chance T+ | base rate | max \|SMD\| |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RC-07 | answer-the-queen-threat | .800 | .432 | +.368 | −1.00 | .157 | 5.54% | 1.027 |
| RC-08 | answer-the-rook-threat | .704 | .372 | +.332 | −1.16 | .188 | 3.84% | **0.359** |
| RC-09 | answer-the-minor-threat | .648 | .452 | +.196 | −1.74 | .152 | 9.56% | 0.539 |
| RC-11 | move-the-threatened-minor | .596 | **.144** | +.452 | −0.64 | .179 | 9.56% | 0.539 |
| RC-12 | stop-the-promotion | .456 | .416 | +.040 | −2.41 | .129 | 0.36% | 1.872 |

**None passes G5.** All five score below the refuted incumbent, and `RC-06` remains the only
eligible rule class after ten candidates.

---

## Round 3 — designing to the rule breaks the rule

Round 2 ended with a design rule extracted from its own twelve rule classes: separation is decided
by the noise cell, and an inert noise cell comes from a **narrow, committal** prescription
(`prescription_size | T−` vs `B_valid | T−`: ρ = +0.811, *p* = 0.0014). Because
`prescription_size` is computable from the board with no engine, that promised a **cheap
pre-screen**: predict a candidate's noise cell before spending a single search on it.

Five candidates were built to that brief, with the prediction written into
`rule_classes.py::PREDICTIONS` as **H3** before the run.

### H3: the noise cells came out as predicted

| | candidate | `presc \| T−` < .140 | `B_valid \| T−` < .230 | `B_valid \| T+` | separation |
| --- | --- | --- | --- | --- | --- |
| RC-13 | underpromote-to-knight | ✅ .049 | ✅ **.004** | **.030** | +.026 |
| RC-14 | capture-the-mating-piece | ✅ .038 | ❌ .500 | .642 | +.142 |
| RC-18 | move-the-piece-that-must-move | ✅ .048 | ✅ .164 | .632 | **+.468** |
| RC-20 | defend-the-piece-in-place | ❌ .163 | ❌ .324 | .228 | **−.096** |
| RC-21 | push-the-unstoppable-passer | ✅ .052 | ✅ .096 | .164 | +.068 |

Three of five hit both targets. `RC-13` produced **the most inert noise cell in the whole register
— .004** — and a positive cell of **.030**, which does not even clear its own chance rate; it is
the only candidate in fifteen to fail **G4**.

### And none of it bought separation

**Narrowing B lowers both cells at once.** The cleanest demonstration is the winner, narrowed:

| RC-06 → RC-14, same threat, same corpus, same engine | | |
| --- | --- | --- |
| `prescription_size \| T+` | .317 | → **.045** |
| `B_valid \| T+` | .968 | → .642 |
| `B_valid \| T−` | .200 | → **.500** |
| **separation** | **+.768** | → **+.142** |

Narrowing "stop the mate somehow" to "capture the piece that would give it" destroyed **both**
halves. On T+ the engine often answers a different way — blocking, king move, counter-check. On T−
capturing the checking piece is frequently just a good capture on its own merits.

### The retraction

Adding five points chosen *for* inert noise cells changed the sample the round-2 correlations were
computed over, and the conclusion moved with it:

| | round 2 (n = 12) | round 3 (n = 17) |
| --- | --- | --- |
| `presc \| T−` vs `B_valid \| T−` | ρ = +0.811, *p* = 0.0014 | ρ = +0.547, *p* = 0.023 |
| `presc \| T−` vs **separation** | ρ = −0.713, *p* = 0.009 | ρ = −0.316, *p* = **0.216** |
| `B_valid \| T−` vs **separation** | **ρ = −0.811, *p* = 0.001** | ρ = −0.277, *p* = **0.282** |
| `B_valid \| T+` vs **separation** | ρ = +0.476, *p* = 0.118 | **ρ = +0.659, *p* = 0.004** |

**The two bottom rows swapped.** Round 2 reported that the noise cell decides and the positive cell
does not; on seventeen rule classes it is the positive cell that reaches significance and the noise
cell that does not.

> **Neither correlation is a law about chess.** Both were estimated over a handful of rule classes
> somebody chose, and choosing the next five by one of them was enough to reverse it. What these
> numbers describe is *the candidates tried*, and round 2's headline — "the noise cell decides" —
> was over-claimed. It is corrected here rather than left standing.

The relationship that has survived every batch is duller and more useful: **`B_valid | T+` and
`B_valid | T−` move together** (ρ = +0.402), so a prescription cannot usually be made inert on one
side without costing the other. `RC-06` is unusual precisely because it is high on one and low on
the other, and nothing in fifteen candidates has reproduced that combination.

### Two results worth keeping regardless

**`RC-20` has a negative separation (−.096)** — the first rule class in the register where the
prescribed act is *more* often correct when the trigger is absent. Defending a hanging minor where
it stands is rarely what the engine plays; it prefers to move it, trade, or counter-attack.

**`RC-21` is the program's own thesis in one number.** The rule of the square is a named, exactly
defined, genuinely true piece of chess knowledge — and pushing the unstoppable passer is the
engine's best move only **16.4%** of the time, because a player with an unstoppable passer is
usually winning in several ways at once and the pawn can wait. It is the cleanest instance yet of:

> **T can be objectively true without having a single correct B.**

### The one repair that worked, and by how little

`RC-11 → RC-18` was a controlled repair: identical noise cell, positive trigger narrowed to the
cases where defending *cannot* help because the attacker is cheaper.

| | `B_valid \| T+` | `B_valid \| T−` | separation |
| --- | --- | --- | --- |
| RC-11 move-the-threatened-minor | .596 | .144 | +.452 |
| RC-18 move-the-piece-that-must-move | **.632** | .164 | **+.468** |

**+.036.** Real, in the predicted direction, and nowhere near the incumbent floor of +.600. Even
when defending is provably useless, *which square to move to* is still a choice the rule does not
make.

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

1. ~~More defensive, severity-protected candidates~~ — **DONE, and they all failed.** Round 2
   built five, including the most severe material threat there is, and none reached the incumbent.
   That negative is what produced the noise-cell finding.
2. ~~Candidates chosen by their noise cell~~ — **DONE, and the strategy did not work.** Round 3
   built five to that brief. Three hit their predicted noise cell, none beat the incumbent, one
   scored a negative separation, and the correlation the strategy was derived from did not survive
   its own candidates. **Selecting on one cell costs the other**; the two move together
   (ρ = +0.402).
3. **Exchangeability for RC-06.** Max |SMD| 0.573 remains the live blocker on the only eligible
   candidate. Matching, or Sheridan-style minimal transformation (Frame C in the protocol),
   measured rather than assumed.
4. **Only then** the measurement-reactivity arm ([F7](FALSIFICATION_REGISTER.md#f7)), and only then
   a human pilot. A multiple-baseline design ([`ANALYSIS_PLAN.md`](ANALYSIS_PLAN.md) §2.2) needs at
   least three independently measurable rule classes; after ten candidates there is **one**.

**Fifteen rule classes across eight families now sit below a rule class already shown to be
uninterpretable, and `RC-06` remains the only one that does not.** Three selection strategies have
been tried — browse the families, follow severity, follow the noise cell — and the last two were
derived from measurements that did not survive the candidates they produced.

**That is the finding this program should now be reporting.** It is no longer "we have not found
the right rule class yet". It is:

> Across fifteen board-definable rule classes in eight families, exactly one has a trigger that
> determines a correct action sharply enough to be worth measuring, and no design rule extracted so
> far predicts which. `RC-06` may be a genuine exception or a single draw from a distribution whose
> tail we happened to sample first; **fifteen candidates cannot tell those apart.**

The next honest move is therefore **not** a sixteenth candidate. It is to take the one that passed
and attack it: exchangeability for `RC-06` (max |SMD| 0.573) is the live blocker, and if it fails
that, the strong negative is available — **rule use is not identifiable from the final move alone**,
and the program moves to process evidence or a different paradigm.
