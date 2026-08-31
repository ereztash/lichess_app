# Falsification register

Ten attempts to break the candidate construct. Each is stated as a hypothesis that the construct
is wrong, a test that could show it, and what the test returned. **Verdicts are about the
hypothesis-of-failure**, so `CONFIRMED` means the construct broke.

Every number here comes from `research/measurement/results/*.json`, produced by the scripts in
`research/measurement/` at the commands recorded in
[`ITEM_BANK_PROTOCOL.md`](ITEM_BANK_PROTOCOL.md). Corpora: **60,000 unfiltered rated Lichess games
(2013-01)** → 167,881 sampled positions → 57,504 classifiable items (T+ 11,752 / T− 45,752); and
**6,100,960 Lichess puzzles**, every 40th sampled → 77,978 classifiable items. Engine adjudication:
**Stockfish 17.1**, 200,000 nodes, on 600 T+ and 600 T−.

| id | hypothesis | verdict |
| --- | --- | --- |
| [F1](#f1) | the effect exists only inside a label-selected corpus | **CONFIRMED for the inherited result; REFUTED for the predicate** |
| [F2](#f2) | T+ and T− are not exchangeable | **CONFIRMED** |
| [F3](#f3) | B does not imply rule use | **CONFIRMED** |
| [F4](#f4) | an oracle is defining the construct | **CONFIRMED for the Lichess theme; CONTAINED for SEE and the engine** |
| [F5](#f5) | response bias masquerades as learning | **CONFIRMED (partially)** |
| [F6](#f6) | the natural task and explicit discrimination are different constructs | **UNRESOLVED — no human data** |
| [F7](#f7) | measurement itself trains the behaviour | **UNRESOLVED — untested, design specified** |
| [F8](#f8) | practice or regression explains pre/post improvement | **CONFIRMED by simulation** |
| [F9](#f9) | puzzle performance does not extrapolate | **CONFIRMED structurally** |
| [F10](#f10) | existing expertise explains everything | **PARTIALLY REFUTED — with a problem** |

---

## F1 — Circular selection {#f1}

**Hypothesis.** The apparent cleanliness of hanging-piece examples exists only because the source
bank was preselected using the `hangingPiece` label.

**Test.** Freeze a board predicate before reading any label (`predicates.py`, sha256
`91f6549d…`, written and hashed first). Generate candidates from 60,000 unfiltered rated games.
*Then* compare against Lichess labels. Separately, reproduce the inherited "29/29" claim under two
draws that differ only in whether the corpus was selected by the label under test.

**The inherited claim could not be reproduced from an artifact.** `git log --all -S hangingPiece`,
`git log --all -S "29/29"` and `git grep -il unprotected HEAD` all return nothing, at any commit.
It was therefore reproduced from the *design* it describes.

| draw | corpus | 29 items | full pool |
| --- | --- | --- | --- |
| **A** — selected by `hangingPiece` | 3,998 labelled items | **29 / 29** | **3,997 / 3,998 = 99.97%** |
| **B** — selected only by the frozen predicate | 17,521 predicate-T+ items | 19 / 29 | **7,433 / 17,521 = 42.4%** |

**The 29/29 is real and it is an artifact.** Drawing 29 from the label-selected pool reproduces it
exactly, and the same criterion on the same predicate applied to a pool the label did not choose
gives 42.4%. The gap is the selection, not the phenomenon.

**And the predicate itself is not circular.** It fires at **20.4%** of classifiable positions in a
corpus no tactical filter ever touched (11,752 / 57,504) and **22.5%** in the puzzle corpus. Against
the theme:

| | theme `hangingPiece` | not | |
| --- | --- | --- | --- |
| **predicate T+** | 3,997 | 13,524 | P(theme \| T+) = **0.228** |
| **predicate T−** | 1 | 60,456 | |
| | P(T+ \| theme) = **0.9997** | | κ = **0.314** |

The label is very nearly a **strict subset** of the predicate — one item in 60,457 is labelled
`hangingPiece` while the predicate calls it T−. The predicate fires 4.4× more often than the label.
They are not two measurements of one thing; the theme is a curated tactical judgement and the
predicate is a geometric fact.

**Verdict: CONFIRMED for the inherited result, REFUTED for the predicate.** The detector survives
outside the label. The finding that motivated this program does not.

---

## F2 — T+ and T− are not exchangeable {#f2}

**Hypothesis.** Positive and negative items differ systematically, so apparent discrimination is
item discrimination.

**Test.** Standardised mean differences on every board covariate, on both corpora, computed before
any participant exists. Then exact matching, then residual balance.

| covariate | games SMD | puzzles SMD |
| --- | --- | --- |
| material balance (actor POV) | **−0.487** | **−0.724** |
| legal moves available | −0.486 | −0.348 |
| attackers on the target | **+0.475** | — |
| total material | −0.393 | −0.215 |
| piece count | −0.312 | −0.127 |
| capturable targets | +0.288 | +0.297 |
| target piece value | +0.204 | −0.222 |
| mate-in-1 available | +0.079 | +0.301 |
| checks available | +0.005 | −0.217 |
| **puzzle rating (difficulty)** | — | **−0.239** (T+ 1401 vs T− 1526) |

T+ positions arise when the actor is **behind by 1.8 pawns on average** and T− positions when
material is level. Trigger states are not randomly distributed over game states.

**Matching does not repair it.** Exact matching on phase, target value, capped legal captures,
capped checks, capped piece count and rating band gave 1,670 strata and 11,077 matched pairs. *d′*
moved from 1.555 to **1.519** — 0.04 — and the residual imbalance stayed large: attacker count
**+0.402**, material balance **−0.393**, legal moves **−0.350**.

**And no threshold is offered for "balanced".** The WWC baseline-equivalence convention of 0.25/0.05
is for a different design and this program has no literature justification for importing it here.
The SMDs are reported; the judgement that these are large is a judgement about **direction and
mechanism** — attacker count and material balance both plausibly drive capturing independently of
the trigger — not about crossing a number.

**Counterfactual pairs were considered and not built.** Sheridan & Reingold's minimal-transformation
method is the right idea, and their control comes from reducing the board to 4×4 with three pieces.
On a full board every candidate edit — add a defender, move a defender, remove an attacker —
changes material, mobility or king safety, and showing that an edit introduced no new tactical
explanation needs the adjudication the bank does not have. Recorded as specified-not-built in
[`ITEM_BANK_PROTOCOL.md`](ITEM_BANK_PROTOCOL.md) Frame C.

**Verdict: CONFIRMED.** And `negative-controls.ts::itemDifficultyConfound` shows what this does: an
agent with **zero** discrimination ability produces *d′* > 1.5 when T+ items are more inviting than
T−. The label-shuffle control does **not** catch it — a fact pinned in that test file, because
passing a shuffle control is the most likely way this would be mistaken for solved.

---

## F3 — B does not imply rule use {#f3}

**Hypothesis.** Capturing the target can be produced without detecting the intended relationship,
and not capturing it can be correct.

**Test.** Three independent readings: geometric competing motifs on 4,000 sampled T+ items; the
curated solution on 17,521 predicate-T+ puzzle positions; and Stockfish 17.1 on 600 T+ / 600 T−.

**Geometric competing motifs, T+ (n = 4,000):** **14.2%** carry at least one — larger capture
elsewhere 263, capture also gives check 209, mate-in-1 available 33, and 63 with combinations.

**The curated answer disagrees with the rule on most items.** Among 17,521 puzzle positions the
predicate calls T+, the curated solution is to capture the loose target in **42.4%**
[41.7, 43.2]. In a corpus where an independent, human-reviewed source has already decided what the
right move is, the act the rule prescribes is right **less than half the time**.

**The engine says the prescribed act is sometimes a blunder.**

| | T+ (n=600) | T− (n=600) |
| --- | --- | --- |
| engine's best move **is** the designated capture | **66.2%** | **22.8%** |
| taking loses ≥ 100 cp | **15.0%** | 53.3% |
| taking costs ≤ 10 cp | 57.4% | 22.7% |
| median cp loss of taking (Q1, Q3) | **+6** (−8, +39) | **+127** (+14, +403) |

Read the two diagonal cells. **On one T+ item in seven, the act the rule prescribes loses at least a
pawn** — a *miss* there is correct play scored as failure. **On more than one T− item in five, the
scored false alarm is the engine's own top move** — a *false alarm* there is correct play scored as
error. Both directions of B are contaminated, at rates that are not small.

**And narrowing does not fix it.** Restricting T+ to quiet items with no larger capture available
moves the puzzle-solution agreement from 0.424 to **0.395** — it goes *down* — and moves the
engine's agreement from 66.2% to 68.0%. The competing explanations are not concentrated in the
items a filter can find.

**Verdict: CONFIRMED.** `capture(target)` is not a valid universal behavioural signature of this
rule class.

---

## F4 — Engine adjudication defines the construct {#f4}

**Hypothesis.** The rule only appears valid because an oracle decides what counts as correct.

**Test.** Keep five fields apart and report where they disagree: board predicate, SEE, engine,
Lichess theme, human adjudication.

**The Lichess theme is disqualified as a source of T, by reading its source.**
`lichess-puzzler/tagger/cook.py::hanging_piece` computes the theme from `puzzle.mainline[1].move` —
**the solution's first move** — requires the captured piece to be non-pawn and hanging, excludes
recaptures of equal-or-greater value, and requires the material advantage to persist two plies
later. It is a property of *(position + solution + continuation)*. **Defining T from it would put B
inside T.** This is not a risk; it is arithmetic.

**SEE is structurally uninformative on T+ and wrong where it matters.** On 4,000 sampled T+ items,
SEE ≥ 0 in **100.0%** (median +330) — by construction, since an undefended target has no
recapture. Yet the engine calls taking a ≥100 cp error on **15.0%** of T+ items, so **SEE and the
engine disagree on 13.7% of T+ items**, always in the same direction: SEE says sound, the engine
says blunder. That is exactly the class of thing SEE cannot see — a refutation on another square.
On T− the disagreement runs both ways: **20.0%** of SEE-sound T− captures are ≥100 cp errors, and
**7.8%** of SEE-losing T− captures are the engine's top move.

**The definition of "unprotected" is itself not unique, and the divergence was measured.** Lichess's
`is_defended` also counts *ray defence* (removing one of our sliding attackers reveals a defender).
Reproducing that rule and re-running it over the 11,752 T+ items: **0.64%** [0.51, 0.80] flip to
defended. Separately, **0.33%** of T− items are defended only by pinned pieces. **This falsifier was
attempted and failed** — the trigger state is robust to the main alternative reading of the word.

**Verdict: CONFIRMED for the Lichess theme — it may never define T. CONTAINED for SEE and the
engine:** they are in separate fields, they disagree at measured rates, and `UNKNOWN` is preserved.
The containment is structural: `outcomeLeakControl` in `negative-controls.ts` asserts that stripping
every oracle field leaves the score *identical*, not merely close.

---

## F5 — Response bias masquerades as learning {#f5}

**Hypothesis.** Apparent discrimination is a shift in criterion.

**Test.** Hit rate, false-alarm rate, *d′* and *c* reported separately, by rating band, with the
loglinear correction applied to every table (Hautus 1995), formulae from Stanislaw & Todorov (1999).

| band | H | F | *d′* | *c* | capture propensity |
| --- | --- | --- | --- | --- | --- |
| <1200 | .751 | .196 | 1.533 | **+0.089** | .304 |
| 1200–1400 | .744 | .219 | **1.430** | +0.059 | .339 |
| 1400–1600 | .774 | .227 | 1.500 | −0.001 | .343 |
| 1600–1800 | .802 | .222 | 1.613 | −0.042 | .337 |
| 1800+ | .820 | .216 | 1.698 | −0.065 | .328 |
| **all** | .785 | .222 | 1.555 | −0.012 | .335 |

**The criterion is monotone across all five bands. Sensitivity is not** — the weakest band beats the
second-weakest. *d′* span 0.27 on a non-monotone path; *c* span 0.15 on a monotone one. The cleanest
skill-ordered signal in this measurement is *where the player sets their criterion*, which is the
thing SDT exists to tell you is not discrimination.

**Verdict: CONFIRMED (partially).** There is a sensitivity gradient and it is not monotone; there is
a criterion gradient and it is. **Reporting accuracy here would have shown a clean monotone
improvement (.751 → .820) and hidden all of this.**

**Explicitly, and it is the point of F5:** *d′* does **not** repair F2. If the item sets differ, no
amount of criterion correction helps, and `itemDifficultyConfound` demonstrates that in nine lines.

---

## F6 — The natural task and explicit discrimination are different constructs {#f6}

**Hypothesis.** A 2AFC "which position has the condition?" measures something other than what the
choose-a-move task measures.

**Status: UNRESOLVED. No human data exists.** The design is specified in
[`ANALYSIS_PLAN.md`](ANALYSIS_PLAN.md): the natural choose-a-move outcome stays primary, the 2AFC is
a **convergent reference only**, and the four-cell pattern (2AFC ↑ / natural ↑, 2AFC ↑ / natural →,
etc.) is what makes it worth running.

Two things are known already. **Under the equal-variance model, *d′*₂AFC ≈ √2 · *d′*ʸⁿ**, so the two
are not comparable without that conversion. And **2AFC is only criterion-free when observers respond
on the stimulus difference alone**; it is not a free lunch. It is also, unavoidably, a cue that the
rule is relevant — which is why it can never replace the natural task without changing the
construct from spontaneous control to recognition under instruction.

---

## F7 — Measurement itself trains the behaviour {#f7}

**Hypothesis.** Exposure to T+/T− trials improves discrimination on its own.

**Status: UNRESOLVED, and it is untested rather than argued away.**

The literature gives a starting point and not an answer. Two meta-analyses find that being measured
changes the measured behaviour: the question-behaviour effect at **SMD ≈ 0.09** across randomised
trials, and mere measurement of patient-reported outcomes at **RR ≈ 1.17**. Both are about *asking a
question*, usually once, about intention or self-report. **A T+/T− block is not one question.** It
is dozens of exposures to exactly the contrast being taught, with the correct answer often derivable
from the item. There is no published estimate for that, and borrowing 0.09 would be using a number
from the wrong design because it is the number that exists.

**Required design, stated so it cannot later be skipped:** a measurement-only arm — repeated
measurement blocks, no intervention, no feedback — with the same spacing as the intervention arm.
Any improvement there is the instrument's, not the intervention's. If reactivity is non-zero, **the
instrument is also an intervention** and every learning estimate has to be net of it.

---

## F8 — Practice or regression explains pre/post improvement {#f8}

**Hypothesis.** A pre/post contrast attributes to the intervention what practice would have produced
anyway.

**Test.** Simulation with the intervention effect set to **zero by construction**
(`negative-controls.ts::measurementOnlyImprovement`): eight sessions, 300 trials each, *d′* rising
0.12 per session from practice alone, two arms.

- naive post − pre on the treated arm: **> +0.2 *d′*** — an effect reported where none exists;
- the between-arm difference-in-differences on the same data: **≈ 0**;
- and the treated arm's own baseline is already rising **before** anything is introduced (+0.1 *d′*
  across the four pre-intervention sessions) — the trend a single pre-test point cannot see.

**Verdict: CONFIRMED.** `post > pre` is refused as a design.

**What replaces it** comes from WWC Single-Case Design standards v5 rather than from a threshold
invented here: systematic manipulation of the independent variable, **at least three demonstrations
of an effect at three different points in time**, and visual analysis on level, trend, variability,
overlap, immediacy and consistency. A staggered multiple baseline across independently measurable
rule classes is the candidate. Analysis calls `SingleCaseES` and `scan`; no proprietary index.

---

## F9 — Puzzle performance does not extrapolate to ordinary play {#f9}

**Hypothesis.** Laboratory transfer is not ecological transfer.

**Test.** Read the selection rule of the puzzle corpus from its source.
`lichess-puzzler/generator.py::is_valid_attack` admits a candidate only when the best move beats the
second-best by **more than 0.7 in win-chance**, or is a unique winning move, or is a valid
mate-in-one.

**Verdict: CONFIRMED structurally, before any behavioural data.** Any bank drawn from Lichess
puzzles contains only positions with one overwhelming answer. That is a severe restriction of range
on precisely the dimension that makes a decision hard, and it has no counterpart in ordinary play.
It supports an **L2** claim and cannot support an **L3** one. The six-level ladder and the four gaps
between L3 and L5 are in
[`ECOLOGICAL_EXTRAPOLATION_GAP.md`](ECOLOGICAL_EXTRAPOLATION_GAP.md); the levels are never summed.

---

## F10 — Existing expertise explains everything {#f10}

**Hypothesis.** The measure reflects general chess strength and nothing rule-specific; or, worse, it
cannot separate skill groups at all.

**Test.** Known-groups, on real behaviour: five rating bands, 57,504 decisions. The chess-expertise
literature (Sheridan & Reingold 2014; Reingold & Sheridan 2021) supports a directional prediction —
stronger players detect relevant configurations faster and fixate them earlier — and supports
nothing quantitative, so no effect size was predicted.

**The instrument does order skill groups, in the predicted direction, and imperfectly.** *d′* rises
1.430 → 1.698 over the top four bands but the lowest band (n = 238 T+) sits **above** the second
(1.533 vs 1.430). A measure that says sub-1200 players discriminate better than 1200–1400 players
has a problem — small-n, a different population of games, or the item confound of F2 acting
differently at different strengths. It is not resolved here.

Under the **N3 narrowing** (T− restricted to captures SEE calls material errors), the gradient
becomes **monotone across all five bands**: 2.059 → 2.131 → 2.218 → 2.387 → 2.487, span 0.43. That
looks like the fix. It is not free — see [`CONSTRUCT_DECISION.md`](CONSTRUCT_DECISION.md): the same
narrowing pushes maximum covariate imbalance from 0.487 to **0.705**, and it puts SEE inside the
trigger definition, which changes what is being measured.

**Verdict: PARTIALLY REFUTED — with a problem.** Expertise does not explain everything: there is a
rule-specific gradient. But the gradient is shallow, non-monotone as stated, and is accompanied by a
criterion gradient that is neither.

---

## Open threats, carried forward

| # | threat | why it is not closed |
| --- | --- | --- |
| OT-1 | the games corpus is **2013-01**. The rating distribution of Lichess then is not today's | chosen as the smallest published month; every rate here describes 2013 players |
| OT-2 | one move per position is observed; **there is no within-person estimate** | an SDT table per player needs many trials per player, which an observational corpus does not give |
| OT-3 | rating is the only skill covariate; **time control is recorded and not modelled** | blitz and classical decisions are pooled |
| OT-4 | the engine budget is 200,000 nodes. A deeper search would move the 15.0% and 22.8% figures | direction unknown; recorded, not assumed |
| OT-5 | `human_adjudication` is `UNKNOWN` everywhere | no human has adjudicated a single item |
| OT-6 | the SEE reproduction does not re-discover x-ray attackers behind a departing piece | documented in `oracles.py`; the engine is present in every record to disagree with it |
| OT-7 | **no acceptance threshold anywhere in this program is justified** | none was invented; every judgement is about direction and mechanism, and where a cut point would be needed it is marked unresolved |
