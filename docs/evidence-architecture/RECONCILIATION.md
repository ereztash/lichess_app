# Cross-PR epistemic reconciliation

**What was audited:** `main` (`e9cd4de`), [#49](https://github.com/ereztash/lichess_app/pull/49)
(`72f25de`), [#50](https://github.com/ereztash/lichess_app/pull/50) (`a9360d5`) and
[#51](https://github.com/ereztash/lichess_app/pull/51) (`673b8f2`).

**Method.** Every risk named for this audit was *verified rather than assumed to still exist*. Three
had already been found and corrected by the branches themselves; those are recorded as **already
corrected** with the correction preserved. Four had not, and two of those were measured in this run
against a corpus scan that reproduces the published manifest **exactly** — 60,834 games seen, 60,000
used, 180,000 positions, 12,119 in check, 580,852 records, identical trigger counts on all seventeen
classes, at the pinned environment and seed `20260831`.

New arithmetic: [`research/evidence-architecture/predicate_semantics.py`](../../research/evidence-architecture/predicate_semantics.py)
and [`rc06_fixed_predicate.py`](../../research/evidence-architecture/rc06_fixed_predicate.py).

---

## C1 — The contradiction between #49 and #51

`git merge-tree` reports **no conflict** and `comm -12` on the two changed-file lists is **empty**.
The branches disagree in claims, not in text, which is precisely why merging both would have
recorded the contradiction as settled.

> **#51 says:** *"This does not block Study D, whose outcome is scored on a specific prescribed act
> rather than on set membership."*
>
> **#49's `EXPERIMENT.md` says**, under OUTCOMES: *"1. trigger-positive rule-consistent action;
> 2. trigger-negative rule-consistent action / false application"* — and under BASELINES,
> *"Per-item chance rate: **share of legal moves satisfying B**."*

**Rule-consistent action is set membership.** #51's reassurance is about a study that does not
exist; the study that does exist scores exactly the quantity #51 shows to be broad and unsafe.
`RC-06` permits a **median 29.7%** of legal moves, **28.6%** of permitted moves are within 100 cp of
best, and on **84.7%** of positive items some permitted move loses ≥100 cp.

**Reconciled position:** #51's caveat applies to Study D as written and is not discharged. Recorded
in [`ACTION_MODEL_DECISION.md`](ACTION_MODEL_DECISION.md).

## C2 — An internal contradiction inside #49

`EXPERIMENT.md` §OUTCOMES states that on `RC-06` **no response criterion is identified and none may
be reported**. Two sections later, FALSIFICATION CRITERIA lists *"**Criterion dominant:** hits and
false applications move together; the procedure changes response bias rather than discrimination"*,
and INTERPRETATION IF RUN maps *"hits and false alarms rise together"* to the permitted reading
*"criterion shift"*. **The document forbids the reading in one section and licenses it in two
others.** The forbidding section is the correct one, on #49's own evidence (H22).

---

## 2.1 — The noise-cell story — **ALREADY CORRECTED, and the correction is right**

*The risk as posed:* "separation is decided by the noise cell" must not survive as a general law.

**It does not.** #50/#51 retract it explicitly, and the retraction is stronger than the one asked
for. At n = 12 the correlation with `B_valid | T−` was ρ = −0.811 (p = 0.001) against ρ = +0.476
(p = 0.118) for the positive cell. At n = 17, after five candidates chosen *by* that story, the two
**swapped**: ρ = −0.277 (p = 0.282) and ρ = +0.659 (p = 0.004).

**The historical result is preserved; the interpretation is withdrawn.** The n = 12 numbers remain
in `STRONGEST_PERMITTED_CLAIM.json` under `third_iteration_severity_ladder`, and the retraction sits
beside them under `fourth_iteration_noise_cell_first` rather than replacing them.

**One thing to keep from it**, which #50 states and which is the only surviving general claim:
`B_valid | T+` and `B_valid | T−` move **together** (ρ = +0.402), so a prescription usually cannot be
made inert on one side without costing the other.

**Added by this audit.** §2.6a below shows that `RC-06`'s standing as the exception to that — high
on one cell, low on the other — is an artefact of the two cells scoring different acts. **Once the
predicate is held fixed, `RC-06` obeys the surviving rule like everything else**, which is a
stronger reason to believe the surviving rule than the correlation it was derived from.

## 2.2 — `RC-21` semantic scope — **NOT RESOLVED. Measured here.**

*The risk as posed:* do not equate `no non-pawn enemy pieces` with `only the enemy king can prevent
promotion`. Prefer a functional condition.

**#51 found the defect and then encoded exactly the equation the risk warns against.**
`_lone_king_defends` returns true iff the opponent has no knight, bishop, rook or queen. Its own
docstring calls that "the rule of the square's own precondition". It is not: an enemy **pawn** can
capture the passer, can be captured, can block after a capture, and can promote into a piece that
stops the pawn. `_passed_pawns` excludes enemy pawns *ahead* on the file and its neighbours; it
excludes nothing behind, beside, or on the other wing.

**A functional predicate.** `_only_the_king_can_stop_it` in `predicate_semantics.py` is a
**sufficient** condition — every clause refuses to certify what it cannot settle, so it errs toward
excluding positions rather than admitting them, which is the direction an audit predicate must err
in. It requires all of: no opposing piece other than the king; a legal forward push available now;
**nothing at all on the promotion path**, ours included; **no enemy pawn attacking the pawn or any
square it must cross**, now or within the race; and **no enemy pawn queening inside the race
window**.

Measured on the full trigger-positive cell (3,286 items, not a 250-item sample):

| `RC-21` T+ | share |
| --- | --- |
| `_lone_king_defends` — #51's scope predicate | **10.2%** (336/3,286) |
| `_only_the_king_can_stop_it` — the functional condition | **5.5%** (180/3,286) |
| **functional given the piece list** | **53.6%** (180/336) |
| piece list true, functional false | 4.7% (156/3,286) |

**Nearly half of the positions #51 certifies as "the rule of the square applies" are positions where
something other than the lone king can change the race.** On the trigger-negative cell the piece
list is right only 22.7% of the time (125/551).

**And the exclusions are attributable, which is the part that matters.** One clause of the functional
predicate — *nothing at all on the promotion path* — also fires on **our own** pieces, which is not
an opposing resource, so the 46.4% could in principle have been an artefact of that clause. It is
not ([`rc21_scope_clauses.py`](../../research/evidence-architecture/rc21_scope_clauses.py)):

| of the 336 positions the piece list certifies | n | share |
| --- | --- | --- |
| **excluded because an enemy PAWN can affect the race** | **149** | **44.3%** |
| ⤷ an enemy pawn queens inside the race window | 146 | 43.5% |
| ⤷ an enemy pawn attacks the pawn or a square it must cross | 26 | 7.7% |
| excluded **only** by one of our own pieces standing on the path | 7 | 2.1% |
| the enemy king stands on the path | 0 | 0.0% |
| the pawn has no legal forward push | 0 | 0.0% |

**The excluding resource is the enemy pawn, in 44.3% of the cell, and the largest single clause is
the counter-promotion** — a pawn that queens inside the window produces a piece that stops the
passer, which is precisely the thing the rule of the square asserts is absent. The own-piece clause
accounts for **2.1%**.

**#51's `b_valid` = .562 "where the rule applies" is therefore computed on a set that is 46% not
that.** The direction of the error is unknown without re-scoring, and re-scoring the functional
subset is 180 items — cheap, and it is on the roadmap rather than done here, because `RC-21` is not
load-bearing for any live claim once §2.6a lands.

**Verdict: `SEMANTICALLY-UNDERDEFINED`.** No deterministic predicate offered so far encodes the
functional condition, and the sufficient one above is not a characterisation — it is a lower bound
whose complement mixes "the rule does not apply" with "we cannot cheaply tell". `RC-21` may not be
described as measuring the rule of the square under either predicate.

**And the general lesson, which is the part that transfers:** #51 built `C10` to stop a class
conceding an unchecked precondition in a comment, and then satisfied `C10` with a predicate that
concedes a different unchecked precondition in a docstring. **A scope predicate needs its own scope
audit**, and the recursion has to stop at a measurement rather than at a sentence.

## 2.3 — `RC-13` matched promotions — **NOT RESOLVED. Measured here.**

*The risk as posed:* compare promotions with the **same origin and destination square**.

`_knight_check_a_queen_could_not_give` asks whether **any** knight promotion checks and **no** queen
promotion checks — two different moves, possibly on opposite sides of the board. The docstring's
claim ("the knight does something a queen cannot") is about **one** promotion.

Measured on the full trigger-positive cell (67 items):

| `RC-13` T+ | share |
| --- | --- |
| unmatched — the shipped predicate | 70.1% (47/67) |
| **matched — same `from`, same `to`** | **77.6% (52/67)** |
| matched given unmatched | 100% (47/47) |
| matched true, unmatched false | **7.5% (5/67)** |
| unmatched true, matched false | 0% |

**The shipped predicate is strictly stronger than the claim it stands for**, and that is a logical
fact, not a coincidence: if no queen promotion checks anywhere, then in particular the queen
promotion on the knight's own square does not. So the unmatched predicate is a subset, and it
**misses 5 of 67 items (7.5%)** in which a knight promotion genuinely does something the queen
promotion from the same square to the same square cannot.

**What this does and does not change.** It does not rescue `RC-13`: `b_valid` is **.000** on both
cells and on both sides of either scope split, so the class fails everywhere and #51's conclusion —
*"an unchecked claim can be harmless"* — survives. It does mean the **in-scope denominator in #51's
table is wrong** (47, should be 52), and that the scope predicate for the one class where the audit
found an unchecked claim was itself not the claim.

**A second gap neither predicate touches.** "Something a queen cannot do" is not "gives check". A
knight promotion can fork without checking, and can avoid a stalemate a queen promotion would force.
Both predicates test one instance of the claim and neither tests the claim.

## 2.4 — `FAITHFUL` as a scope term — **NOT RESOLVED. Terminology change required.**

#51's `ACTION_SET_REANALYSIS.md` calls eight classes `tested-by-the-trigger` and then, in prose,
calls two of them *"faithful"* — *"`RC-05` and `RC-12` are faithful and are split anyway"* — and
refers to "the remaining eight faithful".

#51 states the limit itself, correctly: *"it tests the conditions the docstrings **happen to
state**, and a condition nobody wrote down is invisible to it. `scope_claim` is a signature on a
claim, not a proof of one."* **What the audit establishes is the absence of a stated scope gap.**
`FAITHFUL` asserts semantic correspondence between predicate and rule, which no part of the audit
tests.

**Adopted here and required in any document that supersedes #51:**

| term | means |
| --- | --- |
| `NO_STATED_SCOPE_GAP` | the class's own docstring states no precondition its trigger skips |
| `STATED_SCOPE_GAP_MEASURED` | a stated precondition is skipped, and a predicate measures the cost |
| `SEMANTICALLY-UNDERDEFINED` | no deterministic predicate faithfully encodes the condition |

`RC-06`'s grade under this vocabulary is `NO_STATED_SCOPE_GAP`, **not** faithful — and §2.6a shows
what a scope audit reading only stated conditions cannot see.

## 2.5 — Action-set `A5` under expected score — **ALREADY FOUND. Gate must be retired, not kept.**

*The risk as posed:* re-evaluate whether the old anchor comparison remains a valid gate under
expected-score/WDL; do not keep a broken gate for continuity.

**#51 found the inversion and diagnosed it exactly.** On chance-corrected advantage the ceiling
anchor `RC-00 mate-in-one` scores **+0.344** where the refuted floor `RC-01 loose-piece` scores
**+0.564**. The interval between the anchors is inverted, so `position_between_anchors` is a ratio
over a meaningless interval, and **every one of the fifteen candidates reads `fails
A5_beats_incumbent`.**

The cause is exact rather than statistical: **mean `V*` on `RC-00`'s positive cell is 1.000.** Every
mate-in-one position is already won, so finding the mate buys nothing a decision model can price. In
centipawns the same cell reads +99,255, which is the mate constant. **Neither scale can price
mate-in-one:** one saturates, the other is a placeholder.

**Where #51 stops and this audit does not.** #51 excludes `position_between_anchors` from its table
and warns that "nothing is eligible" must not be read as a statement about chess. It **leaves `A5`
in the gate list**, so `ACTION_SET_MODEL.json` records `A5_beats_incumbent: false` for all
seventeen — including for the ceiling anchor, which fails a gate named after out-separating the
floor.

**Reconciled position: `A5` is void on the expected-score scale and must not be reported as a gate
there.** A gate whose ceiling fails it is not measuring what it is named after. Two things survive
in its place, and they are the two the programme actually needs:

- **the anchors as a descriptive interval**, reported without a ratio over them;
- **`A5` as originally defined on `b_valid`**, which is a well-ordered scale — but see §2.6a, which
  is about whether the quantity `A5` reads there means anything on `RC-06`.

A criterion #51 discovered and could not express in the published screen is worth keeping and is
promoted here: **a rule class is measurable on a utility scale only where its trigger fires in
positions that are not already decided.** `RC-00`'s positive cell has mean `V*` = 1.000; `RC-06`'s
has 0.336.

## 2.6 — `RC-06` robustness and the breadth of `B` — **PARTLY FOUND. The consequence was not drawn.**

*The risk as posed:* determine the safe proportion of permitted actions, the frequency of harmful
actions inside `B`, whether Study D uses `move ∈ B` as an outcome, and whether `B` is therefore too
broad to mean rule-consistent action.

All four are now answered.

| | `RC-00` ceiling | `RC-01` floor | **`RC-06`** |
| --- | --- | --- | --- |
| `b_valid` T+ | 1.000 | .788 | **.968** |
| median share of legal moves permitted | .091 | .037 | **.297** |
| **share of permitted moves within 100 cp** | .482 | .795 | **.286** |
| **items where some permitted move loses ≥100 cp** | .764 | .236 | **.847** |

**`RC-06` has the broadest prescription and the least safe one of the three.** Its *best* permitted
move is the engine's own on 242 of 242 items at a median cost of one centipawn — that is what makes
it eligible and it is unchanged. But picking *a* permitted move is worse than a coin flip.

**Does Study D use `move ∈ B` as an outcome? Yes** — see C1. So the answer to the risk's last
question is:

> **`B`-membership is too broad to mean rule-consistent action on `RC-06`.** A player who "answers
> the mate threat" and loses a rook has produced a hit.

**Therefore, and this is the narrowing the risk asks for:** the sentence *"RC-06's action signature
is valid"* may not be written. What may be written is that **the best member of `B` is the engine's
best move on 242/242 items** — a statement about the *set's ceiling*, not about a behaviour a player
could be scored on.

### 2.6a — The finding this audit adds: `separation` on `RC-06` is not a difference between two measurements of the same behaviour

`_threat_satisfies` **branches on the trigger**:

```
T+   B  =  after your move, the opponent has no mate in one
T−   B  =  after your move, the opponent has no check at all
```

#49 (H22) drew the consequence for the **criterion** and stated that eligibility was "untouched".
Nobody drew it for **separation**, which is the quantity gate `G5` reads and the only gate `RC-06`
uniquely passes.

`rule_classes.py` says the symmetric version was abandoned because `P(B | T−)` "would have come out
near 1", and #49 (H23) reasons from that comment. **It is a comment, not a measurement, and an
unverified comment of exactly this shape is what let `RC-21` through two screens.** Measured, on
2,000 items drawn from each cell at seed `20260831`:

| `RC-06` prescription size | branching `B` | **symmetric `B`** |
| --- | --- | --- |
| T+ mean share of legal moves permitted | .301 | .301 *(same predicate)* |
| **T− mean share of legal moves permitted** | **.103** | **.994** |
| T− items where **every** legal move satisfies `B` | 0.05% | **92.2%** |
| T− items where **no** legal move satisfies `B` | — | **0.0%** |

> **Two draws, and the difference is recorded rather than smoothed.** §2.6b's table reports **94.1%**
> for the same quantity from a different 2,000-item draw of the same 80,332-item cell. Both are
> honest samples and neither is *the* number; the engine run below drew a third sample and got
> **92.0%** (230/250). The mean prescription size is stable across all three at **.994–.995**, and
> nothing in the argument turns on the third digit — **the bound below holds at any of them.**

On roughly 92% of trigger-negative items **every legal move satisfies the rule as written**, so
whatever the engine plays satisfies it. That is a lower bound with no engine in it:

```
b_valid_symmetric | T−  ≥  0.922
separation under one fixed predicate  ≤  0.968 − 0.922  =  +0.046
```

against a published **+0.768** and an incumbent floor of **+0.600**. That bound needs no engine: if
every legal move satisfies `B`, the engine's choice satisfies `B` whatever it is.

**Confirmed on the engine, and it is worse than the bound.** Stockfish **17.1** — the *published*
engine, obtained and run in this session — at 200,000 nodes, `Threads 1`, `Hash 64`, 250 items per
cell drawn from the full cells at seed `20260831`, **0 engine failures**
([`rc06_fixed_predicate.py`](../../research/evidence-architecture/rc06_fixed_predicate.py)):

| | `b_valid` T+ | `b_valid` T− | **separation** | `G5` (> +0.600)? |
| --- | --- | --- | --- | --- |
| **branching `B`** — the shipped predicate | .952 [.918, .972] | .192 [.148, .245] | **+0.760** | passes |
| **symmetric `B`** — the rule as written | .952 [.918, .972] | **1.000** [.985, 1.000] | **−0.048** | **fails** |

**The positive control passes**: this harness reproduces the published .968 / .200 / +0.768 within
its own intervals on an independent draw of 250 from the same cells (.968 and .200 both fall inside
the intervals above). So the symmetric column is a measurement, not a harness artefact.

**Under the rule as written, the engine's best move stops the opponent from having mate in one on
250 of 250 trigger-negative items.** Separation is **−0.048**, not +0.768 — *negative*, because on
4.8% of trigger-positive items the mate cannot be stopped at all and nothing satisfies `B`. **The
rule is satisfied slightly more often when its trigger is absent than when it is present.**

**What this means, stated carefully.**

- The published +0.768 is arithmetically correct and is **not** a bug. It is the difference between
  how often the engine's best move stops a mate when one is threatened, and how often the engine's
  best move leaves the opponent with no check at all when no mate is threatened. Both are real
  quantities. **Their difference is not a specificity statistic**, because no single rule was
  followed in both cells.
- **The branch is a good fix for a real problem** — `rule_classes.py` is right that the symmetric
  version has a degenerate noise cell — and this is the cost of that fix, now priced. #49's H23 got
  the structure right: *on outcome-shaped defensive rules you can measure sensitivity or criterion,
  not both*. **The correction this audit makes to H23 is that you cannot measure sensitivity
  either.** A degenerate noise cell does not become informative by being replaced with a different
  question's noise cell.
- **`RC-06` therefore does not pass `G5` under any single response definition.** Under the branching
  predicate `G5` compares two different behaviours; under the symmetric predicate the comparison is
  well-formed and `RC-06` scores **−0.048** where the floor scores +0.600.
- **The prescription is not wrong; it is uninformative.** "Play a move that stops the mate" is
  excellent advice — its best member is the engine's own move on 242/242 items at a median cost of
  one centipawn. It simply **does not discriminate**, because on almost every position where no mate
  is threatened, not-allowing-mate-in-one is already true of everything you might play. A rule that
  is satisfied by 99.4% of legal moves when its trigger is absent cannot carry information about
  whether the trigger was recognised.

**Consequence for the register: the eligible set is empty.** Fifteen candidates, eight families,
three selection strategies, two anchors — and the one survivor survived on a cross-predicate
difference. This is not a fifteenth failure of the same kind; it removes the only positive result
the programme had.

### 2.6b — It is two classes of seventeen, and the control built to find them finds one

`criterion_channel.py` (#49) detects a branching predicate by reading its source for a literal
`_trigger(` call:

```python
out[rule.id] = "_trigger(" in source
```

**That detector was hardened after a mutation control caught a weaker version**, and #49 records the
hardening honestly: an earlier version also accepted `"state ==" in source`, and blanking the trigger
call left the comparison behind, so the predicate still scored as branching. **The hardening is what
makes it blind.** `_promotion_stop_satisfies` (`RC-12 stop-the-promotion`) branches on the same
board condition its trigger uses *without calling the trigger function*, and says so in its own
docstring:

> *"Branches on the trigger, for the reason `_threat_satisfies` branches: on a T− item the opponent
> never had a promotion, so 'they still have none' would be satisfied by almost every legal move and
> the false-alarm cell would be degenerate."*

So **H22's "the only predicate of the twelve that branches on the trigger" is not correct** — `RC-12`
was among those twelve — and the stderr warning #49 added to fire when a second class starts
branching **cannot fire**.

**Priced, not just noted** ([`branching_audit.py`](../../research/evidence-architecture/branching_audit.py)).
The `as-stated` predicate for each class is read off that class's own `prescription` string and
nothing else:

| | T− prescription size, shipped | T− as the sentence states it | items where **every** legal move satisfies the stated rule | inflation |
| --- | --- | --- | --- | --- |
| `RC-06` *"if the opponent threatens mate next move, play a move that stops it"* | .104 | **.995** | **94.1%** | **+0.891** |
| `RC-12` *"if the opponent can safely promote a pawn, prevent it"* | .184 | **.9995** | **99.6%** | **+0.815** |

Both positive cells are unchanged by construction — .302 and .124 — because the branch only rewrites
the negative side.

**Three consequences.**

1. **Branching is not a property of how a predicate is written**, so it cannot be found by reading
   how a predicate is written. The detector must be behavioural, and the behavioural quantity is
   already computed by the screen: **the prescription size on the noise cell under the rule as
   stated.** A value near 1 means the class has no noise cell, whatever its published one says.
2. **`RC-12` is not a second `RC-06`.** Its published separation is +0.032 — it fails `G5` by a wide
   margin either way, so nothing downstream changes. What changes is the count: **two of seventeen**
   response predicates score a different act on the noise cell, and the register described one.

   > **SUPERSEDED 2026-09-01 by [`C11_SCREEN.md`](C11_SCREEN.md), and the count was the smaller
   > error.** Run on all seventeen classes, **ten** noise cells carry no information about the rule,
   > and there are **two** failure modes rather than one. This section saw only `SATURATED` — the
   > noise cell where almost everything satisfies the rule. The other is `VACANT`: the rule names an
   > act that **does not exist** on a T− item, so `b_valid | T−` is 0 by construction, separation is
   > just `b_valid | T+`, and the class is **flattered** rather than penalised. Eight classes are
   > `VACANT`, including the **incumbent floor `RC-01`**, whose separation is `G5`'s threshold.
3. **This is the third instance of one failure mode in this audit** — §2.2 (a scope predicate that
   is not the condition), §2.3 (a scope predicate that is not the claim), and here (a branching
   detector that is not the property). Each time, a **proxy for a property was checked instead of the
   property**, and each time the class's own docstring stated the property plainly.

## 2.7 — Engine sensitivity — **PARTLY DONE, and #51 says so accurately**

*The risk as posed:* separate top-1 stability, action-set value stability, node/depth stability and
WDL-model sensitivity; do not write "engine does not matter" unless all were tested.

**#51 tested exactly one of the four and reports it as one of four.** On the same items Stockfish 16
reproduces Stockfish 17.1's `b_valid` to within a few thousandths — `RC-06` .968/.204 against
.968/.200 published, `RC-01` .788/.184 against .784/.184, `RC-03` .964/.668 against .956/.680 — and
#51 writes: *"One engine, one node budget. … The `b_valid` agreement with 17.1 is reassuring about
the published screen; it is not a depth-stability result for the new columns, which has not been
run."*

**No correction is required. The status is:**

| quantity | tested | result |
| --- | --- | --- |
| top-1 `b_valid` stability, SF16 vs SF17.1 | **yes** | agrees to ~0.004 on three classes |
| action-set value stability across engines | **no** | — |
| node/depth stability | **no** | — |
| WDL-model sensitivity (`sf16` model used for `xs`) | **no** | — |

The WDL gap is the one worth naming: every expected-score number in #51 is produced by Stockfish
16's WDL model, and the whole `A5` inversion in §2.5 is a property of that scale. **The inversion is
a saturation argument (mean `V*` = 1.000) and does not depend on the WDL model's calibration**, so
it survives the gap — but no other expected-score number does without the check.

**Added by this audit:** Stockfish 17.1 — the *published* engine — was obtained and run in this
session, so the engine-provenance caveat that constrains #51 does not constrain §2.6a. That result
is on 17.1 at 200,000 nodes with `Threads 1` and `Hash 64`.

---

## What this reconciliation changes

1. **The eligible set is empty** (§2.6a). Every downstream document in `docs/learning-v2/` that
   depends on `RC-06` being eligible inherits this, including Gate A's premise, Gate B's target and
   Study D's item bank.
2. **`A5` on the expected-score scale is void** (§2.5) and must not be reported as a gate there.
3. **`RC-21` is `SEMANTICALLY-UNDERDEFINED`** (§2.2) under both the shipped and the audit predicate.
4. **`RC-13`'s scope predicate is not its claim** (§2.3), conservatively, by 7.5% of its cell.
5. **`FAITHFUL` is retired** in favour of `NO_STATED_SCOPE_GAP` (§2.4).
6. **`B`-membership may not be called rule-consistent action on `RC-06`** (§2.6), and Study D scores
   exactly that (C1).
7. **`criterion_channel.py`'s branching detector is not sound** (§2.6b), and `RC-12` branches too —
   **and the full C11 screen found ten of seventeen noise cells uninformative, in two distinct
   failure modes, including the floor anchor that defines `G5`** ([`C11_SCREEN.md`](C11_SCREEN.md)).
8. **Three claims in the branches are withdrawn**: #51's "this does not block Study D"; #49's
   "eligibility is untouched"; and #49's licensing of a criterion reading it forbids elsewhere (C2).

**What is *not* changed.** The severity ladder's positive-cell monotonicity (§F4), the detector's
purity (V3), the corpus reproducibility (V1), the move-blind floor (R4), and #50's retraction of its
own headline (§2.1) all stand. **The programme's method is working**: every one of the seven items
above was found by the discipline the programme imposes on itself, and three of the seven were found
by the branches before this audit reached them.
