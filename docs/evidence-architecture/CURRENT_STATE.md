# Current state of the evidence architecture

**Reconstructed from the repository on 2026-09-01, not from any prior description of it.**

| | |
| --- | --- |
| `main` | `e9cd4de675dd771a20f81dbfd5d7141a01b55f6b` — merge of [#48](https://github.com/ereztash/lichess_app/pull/48) |
| [#49](https://github.com/ereztash/lichess_app/pull/49) | `72f25deecbf3b26d866aa10d5b38a581f9fa171a` — **open, draft**, 21 files, `docs/learning-v2/` + `D24` |
| [#50](https://github.com/ereztash/lichess_app/pull/50) | `a9360d5fb35f35ea4b62b9b609efec0b578e9da2` — **open, draft**, 6 files, round-4 rule-class screen |
| [#51](https://github.com/ereztash/lichess_app/pull/51) | `673b8f246d860aedd72136bf723f7e1610e14227` — **open, draft**, 15 files, action-set model + `C10` |

Three structural facts about those PRs, established by inspection rather than assumed:

1. **#50 is an ancestor of #51.** `git merge-base --is-ancestor` returns true; #51 is #50 plus seven
   commits. Anything true of #50 is true of #51, and #50 has no independent content.
2. **#49 and #51 touch disjoint file sets.** `comm -12` on their changed-file lists is empty and
   `git merge-tree` reports no conflict. **They contradict each other in claims, not in text** — which
   is why a textual merge would have hidden the contradiction rather than surfaced it. See
   [`RECONCILIATION.md`](RECONCILIATION.md) §C1.
3. **None of the three was merged when this was written, and all three are now.** Every statement
   below that comes from #49/#50/#51 was therefore a statement about an unmerged branch, and is
   labelled as such throughout; `main` did not then contain the round-4 screen, the action-set
   model, `C10`, the criterion-channel result, or `D24`. It does now — #50, #49 and #51 landed in
   that order, and this branch has been merged with `main` since. **The labels are left in place
   rather than swept**, because what each claim was checked against is a fact about the check and
   does not change when the branch does.

Sections are the four the programme allows. A claim appears once, in the strongest section it has
earned, and nothing that was true in an earlier round appears here because it was true then.

---

## VERIFIED

Reproduced or checked in this run, or asserted by code that fails the build if it drifts.

**V1 — The corpus and its scan are reproducible.** `scan_rule_classes.py` at seed `20260831`,
`--max-games 60000 --per-game 3`, over `lichess_db_standard_rated_2013-01.pgn.zst`
(17,761,302 bytes, md5 `46fa4bf93894234017be96eed030e7b2`) reproduces the published manifest
exactly: 60,834 games seen, 60,000 used, 180,000 positions, 12,119 in check, 580,852 records, and
identical per-class trigger counts. Re-run in this session with the pinned environment
(`python 3.11.15`, `chess 1.11.2`, `numpy 2.4.6`, `scipy 1.17.1`).

**V2 — The published engine is obtainable and is the one named.** Stockfish 17.1
(`stockfish-ubuntu-x86-64-avx2`, official release) runs here. #51's action-set numbers were produced
on **Stockfish 16** and say so in their own provenance block; #51's within-run recomputation of
`b_valid` reproduces the published 17.1 values to within a few thousandths on the three classes it
reports (`RC-06` .968/.204 against .968/.200). **Top-1 `b_valid` is not engine-dependent between
those two builds.** Nothing else about engine sensitivity is verified — see U6.

**V3 — The detector is a pure function of the position.** `trigger(board, ctx)` has no parameter
through which the played move can reach it; `satisfies(board, move, ctx)` sees one move and no
engine. `negative-controls.ts::outcomeLeakControl` asserts an identical table after stripping every
oracle field. This is a property of the signatures, checked by tests, not a promise.

**V4 — `C10` is enforced at import.** On #51, `RuleClass.__post_init__` refuses any class that
declares `c10_grade = asserted-and-unchecked` without supplying a `scope_predicate`. A rule class can
no longer concede a scope gap in a comment and leave it unmeasured.

**V5 — The production record already carries more than position + move + time.** `DecisionAtom`
(`shared/decision-atom.ts`) stores, per decision and before any reveal:
`bounded_action.seconds_taken`, `bounded_action.confidence` (with `confidence_scale` and
`confidence_grid_version`), `bounded_action.candidate_moves_considered` — **every distinct move
physically placed on the board while deciding, in touch order** — and `probe`, a randomised
"name an alternative move" arm carrying `assignment`, `legal_moves`, `answered` and
`alternative_cp_loss`. `probe` is present on unprobed decisions too, so the arm has a denominator.
This is load-bearing for [`INCREMENTAL_EVIDENCE_VALUE.md`](INCREMENTAL_EVIDENCE_VALUE.md): several
rungs of the "what should we add" ladder are already shipped.

**V6 — `candidate_moves_considered` is a lower bound and is documented as one.** A move is in the
array only if it was physically put on the board. `shared/reveal.ts` states that `chose-past-it` is
therefore a lower bound on "saw it and chose past it", never an estimate, and that imported PGNs
carry an empty array so the branch can never fire on them.

**V7 — `mayPrescribe` exists and is not routed into rehearsal.** The authority gate
(`shared/evidence-authority.ts`) is enforced in `FindingCard`; `formLearningRule` files a
player-authored rule as a `hypothesis` and schedules retrieval without consulting it. Verified on
`main`, unchanged by any of the three PRs.

**V8 — Refuting is now as hard as replicating.** `gradeLearningRule` requires two failed *days*
before `refuted`, mirroring the two successful days required for `replicated`. The earlier
asymmetry — permanent refutation from one sitting of three positions — is gone.

---

## RESEARCH-ONLY

Exists as a measurement or a design, carries no production authority, and is not a claim about a
player.

**R1 — The fifteen-class rule-class screen.** #50/#51. Fifteen candidates in eight families across
three selection strategies, two anchors, 250 items per cell. **Exactly one candidate, `RC-06
answer-the-mate-threat`, passes gate G5.** Every other candidate scores below the refuted incumbent.

**R2 — The action-set decision model.** #51. Efficacy (`regret_B`), necessity (`advantage`) and
robustness (the within-`B` value distribution) computed for all seventeen classes on expected score
and centipawns, with a per-item size-matched random prescription as a chance control. 8,307 items,
48,155 searches, 0 engine failures, Stockfish 16.

**R3 — The `C10` scope audit.** #51. All seventeen triggers asked whether they fire on the condition
the class is named after. Two graded `asserted-and-unchecked` (`RC-13`, `RC-21`), seven
`declared-and-separately-tested`, eight `tested-by-the-trigger`.

**R4 — The criterion-channel measurement.** #49. A move-blind agent scores *d′* = 0.80 and
*c* = +0.88 on `RC-06` from predicate sizes alone; move-blind *c* predicts observed *c* at
r = +0.72 across twelve classes; the `RC-09`/`RC-11` outcome-vs-method pair moves *c* by +0.524 on
the same players and the same positions.

**R5 — Study D.** #49, `docs/learning-v2/EXPERIMENT.md`. **Specified, frozen, not admissible.** No
participant may be recruited until Gates A and B pass.

**R6 — Human-policy baselines.** No Maia model of any generation is present in this repository, in
research or in product. See [`HUMAN_BASELINE_ORACLE.md`](HUMAN_BASELINE_ORACLE.md).

---

## REFUTED

Each entry names what refuted it. **The historical result is preserved; only its interpretation is
withdrawn.**

**F1 — "`B = capture(designated target)` indicates use of the unprotected-piece discrimination."**
Refuted on `main` (`STRONGEST_PERMITTED_CLAIM.json`): taking loses ≥100 cp on 15.0% of T+ items;
the engine's best move is the designated capture on 22.8% of T− items.

**F2 — "T+ and T− items are exchangeable on everything except the trigger."** Refuted on `main`:
max residual |SMD| 0.402 after exact matching; 0.573 for `RC-06`.

**F3 — "Separation is decided by the noise cell."** Round 2's headline. **Retracted in #50/#51.**
At n = 12 the correlation with `B_valid | T−` was ρ = −0.811, p = 0.001; at n = 17 it is
ρ = −0.277, p = 0.282, while the positive cell moved from ρ = +0.476, p = 0.118 to ρ = +0.659,
p = 0.004. **The two swapped.** Choosing five candidates by one of the correlations was enough to
reverse which reached significance. Neither is a law about chess. What survives: `B_valid | T+` and
`B_valid | T−` move together (ρ = +0.402), so a prescription usually cannot be made inert on one
side without costing the other.

**F4 — "Severity protects the prescription" as a full explanation.** Round 3. Severity holds on the
positive cell (mate .968 > queen .800 > rook .704 > minor .648, monotone) and does nothing for the
negative one. The mechanism explains one cell of two.

**F5 — "`RC-21` is a true `T` with no single correct `B`."** Refuted in #51. `_passer_trigger`
never checks that the enemy king is alone, so it fires with a median 13 points of enemy pieces on
the board. On the 12.8% of items where the opponent is down to king and pawns, `b_valid` is .562
and obeying costs zero. **`RC-21` is not an example of a true `T` with no correct `B`; it is an
example of a `T` that is not true.** (And the replacement scope predicate is itself insufficient —
see [`RECONCILIATION.md`](RECONCILIATION.md) §2.2 and `UNRESOLVED` U2 below.)

**F6 — "The SDT criterion on `RC-06` measures something about the player."** Refuted in #49 (H22).
`_threat_satisfies` branches on the trigger: a hit means *"the opponent has no mate in one"*, a
false alarm means *"the opponent has no check at all"*. One response scored against two states of
the world is what a criterion requires, and that is not what is happening.

**F7 — "Symmetrising `RC-06`'s predicate would repair it."** Refuted in #49 (H23) **by argument, from
a code comment, without a measurement.** The comment says `P(B | T−)` "would have come out near 1".
Round 5 in this document measures it; see [`RECONCILIATION.md`](RECONCILIATION.md) §2.6a.

**F8 — "`position_between_anchors` is a usable ranking statistic on the expected-score scale."**
Refuted in #51. The anchor interval inverts: `RC-00 mate-in-one` scores +0.344 chance-corrected
advantage where the refuted incumbent `RC-01` scores +0.564, because every mate-in-one position has
mean `V*` = 1.000 and is already won. A ratio over an inverted interval is not a quantity.

**F9 — "A repeated pass means the rule replicated."** Refuted on `main` (`docs/learning/`): three
positions and two successes reaches `replicated` 47–81% of the time in one sitting from base rates
alone; across two required days the corresponding null is 9–65%.

---

## UNRESOLVED

**These are the questions open in the repository *as found*, before this execution ran.** Four of
them (U1–U4) are answered in [`RECONCILIATION.md`](RECONCILIATION.md) and
[`ACTION_MODEL_DECISION.md`](ACTION_MODEL_DECISION.md); each says where. They are stated here as
they stood so that the record shows what was open and what closed it, rather than presenting this
execution's answers as though the repository already contained them.

**U1 — Whether `RC-06`'s separation survives a single fixed response predicate.** The number that
makes `RC-06` the only eligible class is `separation = b_valid|T+ − b_valid|T−` = +0.768, and F6
establishes that those two terms are computed under **different definitions of `B`**. No document in
`main`, #49, #50 or #51 states what the separation becomes when one predicate is held fixed. #49
asserts eligibility is "untouched" by the branching; #51 repeats the +0.764 figure. **This is the
load-bearing open question of Execution 1** and is measured in
[`RECONCILIATION.md`](RECONCILIATION.md) §2.6a.

**U2 — Whether the rule of the square has a faithful deterministic predicate.** #51 replaced
`_passer_trigger`'s missing precondition with `_lone_king_defends` = *"the opponent has no knight,
bishop, rook or queen"*. That is a statement about the piece list, not about the race: an enemy
**pawn** can capture the passer, can be captured, and can promote into a piece that stops it.
Measured in [`RECONCILIATION.md`](RECONCILIATION.md) §2.2.

**U3 — Whether `RC-13`'s stated condition has ever been tested.** `_knight_check_a_queen_could_not_give`
compares *any* checking knight promotion against *any* checking queen promotion. The docstring's
claim is about one promotion square. Measured in [`RECONCILIATION.md`](RECONCILIATION.md) §2.3.

**U4 — Whether `B`-membership is a defensible outcome for Study D.** #51 says `RC-06` permits a
median 29.7% of legal moves, of which 28.6% are within 100 cp, and that on 84.7% of positive items
some permitted move loses ≥100 cp — then says this "does not block Study D, whose outcome is scored
on a specific prescribed act rather than on set membership." **#49's `EXPERIMENT.md` scores
`rule-consistent action`, which is set membership.** See [`RECONCILIATION.md`](RECONCILIATION.md) §C1.

**U5 — Whether a minimal functional twin can be built at all.** #49 finds the precondition on Gate B
fails on `RC-06` and that symmetrising is unavailable. Gate B has no admissible instrument on the
only eligible class.

**U6 — Engine sensitivity beyond top-1.** #51 checked one thing: that Stockfish 16 and 17.1 agree on
`b_valid`. Action-set values, node/depth stability and WDL-model sensitivity are **not** tested, and
#51 says so. "The engine does not matter" is not available as a claim.

**U7 — Whether any of this is separable from general chess strength.** Unchanged since `main`. No
evidence exists either way.

**U8 — Reactivity.** Untested. No published estimate covers repeated exposure to the taught contrast.

**U9 — Whether `RC-06` is a genuine exception or one draw from a tail.** Fifteen candidates across
eight families cannot distinguish those, and #50 says so in its own words.

**U10 — Whether the register's ranking survives its own instrument.** *Answered after this file was
written:* [`C11_SCREEN.md`](C11_SCREEN.md) grades all seventeen and finds **ten** noise cells that
carry no information about the rule, including the incumbent floor whose separation is `G5`'s
threshold. The ranking cannot be repaired by rereading it.
