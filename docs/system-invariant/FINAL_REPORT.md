# Final report: is OwnExposure a natural decision policy?

Mission: turn existing repository assets into one defensible pipeline from natural corpus to
prospective transfer, and decide whether `OwnExposure` earns a place in it.

---

## 1. BLUF

**The invariant is real. The gate stops anyway, on consequence.**

```
VERDICT:  SYSTEM POLICY VALID, ECOLOGICALLY INFEASIBLE      (mission Outcome C)
          C1 through C8 PASS.  C9 FAILS: 24.32% [22.95, 25.67] against a frozen 30%.
STATUS:   no implementation licensed. FIELD_REQUIRED does not arise, because the
          pre-field gate did not open.
```

Across 45,296 natural blitz decisions by 1,333 players, a board-derived count of the mover's pieces
left with more attackers than defenders carries information about move quality beyond move geometry,
material, mobility, position value and three pre-named relational controls, within position, within
player, within game, in 9 of 9 rating bands, 3 of 3 phases and 3 of 3 clock strata. It does not
survive a within-player permutation, which is what a real effect should do.

It fails the one criterion that asks whether the mistake is worth preventing. About three in four
higher-exposure choices among reasonable candidates cost less than this repository's own threshold
for having given something away.

---

## 2. Starting repository state

| | |
|---|---|
| `origin/main` | `c848f244d380e13a8622c590791b22a2bef7a39b` |
| PR #66 head, branched from | `03fcea95ce70ad1e8e875c34e5fb47f0496d7b5e` |
| Mergeable | yes, main an ancestor, 34 commits ahead |
| Work branch | `claude/system-invariant-natural-transfer` |

PR #66 was not merged to run this mission.

---

## 3. Resource inventory

`RESOURCE_TO_GAP_MAP.md`, twenty assets mapped to the uncertainty each closes, plus a section on the
four that were asked for something they could not give: the learning-v3 corpus (no natural played
move carries a quality label), B3's rows (gitignored, never committed), P4 (cannot separate cue from
attention), `schema.ts` (states capacity, not permission).

---

## 4. Frozen hypotheses

`RESEARCH_QUESTION_FREEZE.md` and `FALSIFIERS.md`, committed at `03613ab` in a commit touching
nothing else, hashed in `FREEZE.json`, checked by `GATE-RESEARCH-RECONCILED` on every build and by
`verify_freeze.py` for commit ordering.

`AMENDMENT_01.md`, committed at `859799e` while scoring was at 52% and before any result existed:
P4 downgraded to non-specific evidence, the consequence threshold protected from the noise floor,
and the opportunity estimand protected from B3's sampling design. It changed no hypothesis and no
threshold.

---

## 5. P3 reproduction

**`P3_REPRODUCED`.** 4,139 moves, 711 positions, 4,546 pairs, M0 `0.5000` / M1 `0.5779` /
M2 `0.6577`, all three gains and intervals identical to the published result, 0 engine searches.

The construct was located in the implementation, not in prose: `own_overloaded_piece_count` in
`p3_system_invariant.py`. Contamination check passed, the metric is board-derived. `features.py`
**calls** that function rather than porting it, and a test asserts the running code was defined in
P3's file.

---

## 6. Natural generalization (Test A)

`exposure_delta` on `quality_loss`, full controls, player-cluster interval:
**+0.1014 [+0.0908, +0.1134]**. Removing the position-value controls makes it **smaller**
(+0.0670), which is the opposite of a proxy.

---

## 7. Within-position candidate test (Test B)

533 held-out players, 337,706 pairs, 17,691 positions.

| Model | Accuracy |
|---|---:|
| `L` geometry only | 0.4963 |
| `L + Material` | 0.4955 |
| `L + Mobility` | 0.5102 |
| **`L + Epost`** | **0.5501** |

Gains: **+5.38 pp** over geometry, **+5.45 pp** over material, **+3.99 pp** over mobility. The three
pre-named relational controls carry +0.13, -0.00 and +0.57 pp.

---

## 8. Functional invariance

**Partial.** The heuristic works on geometrically unlike pairs (0.5729 [0.5663, 0.5796]) but is
**4.79 pp weaker** there than on pairs sharing piece type and capture status (0.6208). Different
moves converge on the same functional transformation to a degree, not fully.

---

## 9. D04 scope map

**All 29 depth-1 cells SUPPORTED** on held-out players. Strongest in check (0.7574), endgame
(0.7220), low material (0.6506), few legal moves (0.6492), losing (0.6355), short of time (0.6254).
Weakest in high material (0.5155) and the opening (0.5356).

The cue is strongest exactly where a player has least room to calculate.

Depth-2 winner `in_check=yes AND phase=endgame`: 0.8400 held out over 175 pairs, labelled
**INSUFFICIENT** by the frozen 200-pair minimum.

---

## 10. Held-out predictive test

533 unseen players. **ΔR² +0.0131 [+0.0090, +0.0171]** (0.1280 to 0.1411), interval excluding zero.
**MAE reduction +0.00011 [-0.000023, +0.000236]**, which is 0.011 percentage points of win
probability and includes zero.

Exposure ranks candidates. It barely improves a point prediction of what a move cost.

---

## 11. Opportunity density

Estimands under `AMENDMENT_01` section C, each with its denominator.

| | |
|---|---:|
| **O4** population-weighted per-decision rate | **34.54%** |
| **O5** player-weighted (1,333 players) | 34.61% |
| **O6** sampler-weighted, not a population rate | 34.64% |
| **O2** opportunities per game, B3-eligible decisions | 9.96 to 11.98 by band |
| **O3** games needed for one opportunity, upper bound | **0.083 to 0.100** |
| value-free rate (two legal moves differ, no engine) | **95.42%** |
| headroom | **36.02%** (4,215 / 11,703) |

**O2 is not exact and was not repaired.** On 0 of 1,303 uncapped sides does the scored sequence
equal the opportunity-eligible ply sequence; coverage 0.9545, per-side gap always 1 or 2, which is
B3 dropping every side's first move and half the last plies. Renamed to state its denominator, with
the bias direction recorded: a lower bound on opportunities per game.

The three pooled estimands agree to within 0.10 pp because the rate is nearly flat across bands.
That agreement was not knowable in advance and the weighting machinery was needed to establish it.

---

## 12. Personal historical baseline

`PRE_EXPOSURE_BASELINE.md`, frozen before any post-exposure game exists. Exposure bracketed to
19 minutes 42 seconds from commit metadata, with the 2,209-game corpus fetched 18.6 hours earlier,
so the whole corpus is unambiguously pre-exposure. Primary window is the most recent 300 blitz
games, because the repository's own account-bridge prediction failed across windows. Denominator is
opportunities, not games. Policy consistency, move quality and opportunity rate stay three separate
outcomes.

---

## 13. Gate decision

| | Required | Observed | |
|---|---|---|---|
| C1 gain over geometry | >= 1.0 pp | +5.38 pp | PASS |
| C2 not material | >= 1.0 pp | +5.45 pp | PASS |
| C3 not mobility | >= 1.0 pp | +3.99 pp | PASS |
| C4 not position value | CI excludes 0 | +0.1014 | PASS |
| C5 breadth | 7/9, 3/3, 3/3 | 9/9, 3/3, 3/3 | PASS |
| C6 within player | CI excludes 0 | +0.0975 | PASS |
| C7 opportunity | >= 5.0% | 34.54% | PASS |
| C8 headroom | >= 20% | 36.02% | PASS |
| **C9 consequence** | **>= 30%** | **24.32% [22.95, 25.67]** | **FAIL** |

The frozen mapping sends a C9 failure to `SYSTEM POLICY VALID, ECOLOGICALLY INFEASIBLE`.

**The label's meaning clause is partly false and is corrected rather than swapped.** Outcome C says
opportunities, headroom and consequence are "too sparse". Opportunities are 34.5% of decisions,
about eleven a game; headroom is 36%. Only consequence falls short, of a bar deliberately set near
three times RC-05's failure rate. Reporting a different verdict because the wording reads awkwardly
would be moving the gate after seeing the number.

**Not `MEASUREMENT_LIMITED`.** The consequence rate is separable from the measured search-noise
floor (22.95 against 10.89). The shortfall is a property of the decisions, not of the instrument.

---

## 14. Conditional implementation changes

**None. The gate did not open.**

Not built, deliberately: the `BehavioralPolicy` widening, the `PolicyExposure` record, the shadow
opportunity matcher, the natural-retest object, the delivery surface. Mission sections 15 to 21 are
conditional and their condition was not met.

`Q28` independently constrains the exposure record: it is deliberately unresolved
(`PARTIAL_AUTHORITY`), so mission section 15 binds any such record to the least persistent
representation available. That constraint stands whatever a future gate decides.

---

## 15. P5 readiness and the field blocker

P5 is **not** blocked on field data. It is blocked one step earlier, on consequence.

Were C9 met, the pipeline would be ready: the scope is frozen and mechanically stated, the
opportunity definition is executable, the pre/post design is frozen, and `O3` says a participant
meets an eligible opportunity roughly every 0.09 games, so 100 opportunities need about 9 games
rather than the 60 the threshold was sized for.

What would change the answer is a **different consequence definition or a different scope**, and
either is a new preregistration, not an edit to this one.

---

## 16. Adversarial findings

`ADVERSARIAL_PASS.md`, eighteen attacks. Eleven fail, four land, one is partial, two do not apply.

Landed: **A-9** Test B ranks only among the engine's top eight, so it says nothing about moves a
human would consider and the engine ranks lower. **A-11** the opportunity definition is
engine-circular, declared in the freeze and now quantified: 95.42% value-free against 34.54%
filtered, a 61-point gap that is the candidate set the player must supply. **A-12** a universal
reading of the cue is unsupported, since exposure ranks at 0.5155 in high-material positions.
**A-13** the personal baseline drifts, confirmed by the repository's own failed prediction.

None changes the verdict; C9 failed on its own measurement first.

---

## 17. What was falsified

Nothing in the falsifier register fired. `F-1`, `F-2`, `F-A1` through `F-A10`, `F-P3` and `F-X` all
survived, including the leak control, which collapsed the effect to **+0.0080 [-0.0008, +0.0162]**.

`F-E3`, the consequence falsifier, **fired**: it predicted at least 30% and observed 24.32%. That is
the one prediction this mission got wrong, and it is the one that decided the verdict.

Falsified elsewhere: the belief that P4 demonstrated cue efficacy, and my own suspicion that the
pre/post MultiPV mismatch biased the outcome, which measurement reversed.

---

## 18. What remains unknown

- Whether teaching this changes any decision. No transfer evidence exists at any level.
- Whether the cue, as opposed to the intervention episode, does anything. Requires a sham arm.
- How exposure ranks moves outside the engine's top eight.
- Whether the effect holds in longer time controls; only `180+0` was measured.
- Whether the endgame-and-check region is real; it looked best and had too few pairs to qualify.
- Whether a value-weighted or SEE-aware version of the construct would clear C9. Not tested, and
  testing it is a new preregistration, not an amendment.

---

## 19. Strongest permitted product claim

> Across 45,296 natural blitz decisions by 1,333 rated players, a board-derived relational feature
> counting how many of a player's own pieces are left with more attackers than defenders after a
> candidate move carries information about move quality beyond move geometry, material, mobility,
> position value and three comparable relational quantities. It holds within position, within player
> and within game, in every rating band, phase and clock stratum measured, and it is strongest where
> the player has least room to calculate. Its usefulness is bounded: it ranks candidates a player has
> already generated, and among the moves an engine ranks highest. One participant has separately
> shown that a cue of this form can be understood and applied to unseen presented positions, though
> that experiment cannot attribute the improvement to the cue rather than to having been intervened
> upon. Whether learning it changes an uncued ordinary-game decision is unmeasured.

Forbidden and not used anywhere in this mission: "cue efficacy demonstrated", "OwnExposure teaching
caused improvement", "human learning established", "minimising exposure makes you play better".

---

## 20. Exact next action

**Do not build. Decide which question to buy next.** Three candidates, in cost order:

1. **A sham-cue arm** with one further participant. Smallest design that separates learning from
   attention, and it settles `D-cue-efficacy`, which no amount of engine compute can.
2. **A consequence-definition preregistration.** `C9` failed against a threshold on immediate
   `quality_loss`. Whether higher exposure predicts a *later* cost, at the point the opponent
   exploits it, is a different and untested question. It needs a new freeze, not an edit.
3. **A value-weighted construct.** Section 2.2 recorded before the run that the metric is unweighted
   and not SEE-aware. Whether a weighted version clears C9 is answerable from the preserved corpus
   for the ranking tests, though not for the consequence measure.

None of these is licensed by this mission's gate. All three are cheaper than the alternative of
building on a policy whose mistake is free three times in four.

---

## 21. Redundant future work

`REDUNDANT_FUTURE_WORK.md`. Eight capabilities are redundant with a named asset, including a
system-health composite, a second sampler, a second freeze mechanism and a second cache. Five remain
necessary, each with the missing quantity named. One, the product storage model, is left undecided
because this mission produced no evidence about it.

---

## 22. Compute preserved and spent

| | |
|---|---|
| new engine searches | **90,592** (Stockfish 17.1, 60,000 nodes) |
| searches repeated from preserved corpora | **0** |
| preserved | `research/system-invariant/corpus/`, 45,296 decisions with 348,571 candidate values, 5.3 MB |
| findability | `score_natural.py::lookup_move` answers the standing no-repeat rule using `learning-v3/cache.py`'s key |
| collision with learning-v3 | none: different policy and node budget are different measurements |
| non-engine reruns | one ingest, which reproduced the sample **byte-identically** |
| P3 rerun cost | 0 searches |

Justification for the buy, argued before it was spent: `quality_loss` requires a post-move search of
the position a human actually reached, and no such search exists anywhere in the repository.

---

**The player should see only the information required to change the next decision; the repository
may retain everything required to justify, test, and reverse that information.**
