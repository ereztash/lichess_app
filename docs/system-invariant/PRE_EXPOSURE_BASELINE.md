# Pre-exposure baseline for the N-of-1 participant, frozen before any post-exposure game is read

Mission section 14. This document fixes the comparison logic **now**, while no post-exposure natural
game has been scored, so that the eventual pre/post contrast cannot be chosen after seeing it.

---

## 1. Can the exposure moment be established at all?

Adversarial attack 14 says it cannot. The answer is: **bracketed to twenty minutes, but nowhere
recorded**, and those are different things.

| Evidence | Value |
|---|---|
| P4 protocol freeze commit `ed7e72b` | `2026-09-02T16:16:05Z` |
| P4 result commit `51aba0d` | `2026-09-02T16:35:47Z` |
| Account corpus fetched (`research/harness-account-full/corpus_manifest.json`) | `2026-09-01T21:42:06Z` |

The cue was shown to the participant after the protocol was frozen and before the result was
written, so exposure falls inside a window of **19 minutes 42 seconds**. The account corpus was
fetched **about 18.6 hours before the earliest possible exposure**.

**What this licenses:** all 2,209 admissible games in `harness-account-full` are unambiguously
pre-exposure. There is no boundary ambiguity to resolve, because the entire corpus predates the
whole bracket.

**What this does not license:** calling the exposure time *recorded*. It is inferred from commit
metadata under the assumption that the session ran between those two commits. Nothing in the
repository states when the participant read the sentence. That is the gap, and mission section 15's
`PolicyExposure` record is what would close it for the next participant. **No timestamp is invented
here.**

---

## 2. The corpus, and why it cannot be used naively

`research/harness-account-full/corpus_manifest.json`, fetched `2026-09-01T21:42:06Z`:

| | |
|---|---|
| games returned | 3,195 |
| admissible | **2,209** |
| rejected | 724 time forfeit, 134 under 20 plies, 124 abandoned, 4 no clocks |
| blitz / rapid / bullet | 1,899 / 203 / 103 |
| players | 1 (`playerId 8633c23fa6918be9`) |

**The naive comparison is already known to fail here.** `docs/research/ACCOUNT_BRIDGE_FULL_RESULTS.md`
predicted a separation of 1.1583 pp from the rates observed at 1,240 games and measured **0.6218 pp**
at 2,209: the predicted margin of +0.3004 pp landed at **-0.2413 pp**, a swing of 0.54 pp onto the
wrong side of zero. The bar, predicted from `1/sqrt(n)` alone, was right to 0.0053 pp. So the
arithmetic transfers across windows and **the rates do not**.

Reading "all 2,209 historical games" against a small post-exposure window would therefore be
measuring window composition, not learning.

---

## 3. The frozen design

### 3.1 The denominator is opportunities, not games

Mission section 22. A stopping rule counted in games silently assumes a constant opportunity rate
per game, which is the assumption section 2 just showed does not hold across windows. The unit is
the **eligible OwnExposure opportunity** as defined in `RESEARCH_QUESTION_FREEZE.md` section 10.1,
identified identically pre and post by the same frozen code.

### 3.2 Matching, in this order

1. **Time control.** Blitz only (`1,899` of the 2,209). Bullet and rapid are excluded: the cue is
   about a deliberate comparison among candidates, and the three speeds are different tasks.
2. **Recency window.** The primary pre-exposure window is the **most recent 300 admissible blitz
   games before the exposure bracket**, not the whole account. Chosen because the account-bridge
   result above shows older windows carry different rates; the whole-account window is reported
   **beside** it as a secondary, never instead of it.
3. **Rating band.** Post-exposure games outside the pre-window's rating range, plus or minus 100,
   are excluded, and the exclusion count is reported.
4. **Phase and standing.** Opportunities are compared within `phase` and `standing` strata, the
   same B3 categories used everywhere else in this mission.

### 3.3 The endpoint

Primary, per mission section 19:

```
P(policy-consistent action | eligible opportunity, post-exposure)
  -  P(policy-consistent action | eligible opportunity, pre-exposure)
```

`policy-consistent` means: among the reasonable candidates available at that decision, the played
move was one of those minimising `OwnExposure_post`. It is scored by the same frozen code on both
sides.

**Policy consistency and move quality are separate outcomes and are reported separately.** Mission
section 17: a good move is not evidence the rule was used, and a policy-consistent move that loses
material is not evidence the rule is good. Three quantities, never merged:

| | |
|---|---|
| `policy_consistency` | did the choice follow the frozen policy |
| `quality_loss` | B3's outcome, unchanged |
| `opportunity_rate` | did the situation arise at all |

### 3.4 Negative / generalisation endpoint

The cue must not spread to where it was never licensed. On decisions that are **not** eligible
opportunities, the rate of exposure-minimising choices must not rise. A rise there is
`OVERGENERALISATION / CRITERION_SHIFT`, which mission section 23 lists as a distinct result class
and which this design treats as a **failure**, not a partial success.

### 3.5 Stopping rule

Stop when **100 eligible post-exposure opportunities** have accumulated, or at 120 days, whichever
comes first. The 100 is the same number the GO threshold `C7` was derived from, so the design and
the gate agree by construction rather than by coincidence.

### 3.6 Exclusions and missing data, fixed now

- Games with fewer than 20 plies: excluded (the account-bridge rule, unchanged).
- Time forfeits: excluded, as in the corpus manifest.
- Decisions with no derivable think time: excluded.
- A decision whose position cannot be scored: excluded and **counted**; if exclusions exceed 10% of
  eligible opportunities the analysis is reported as `MEASUREMENT_INVALID` rather than patched.

### 3.7 Analysis

Paired comparison of proportions with a **game-level cluster bootstrap**, 5,000 replicates, seed
`20260902`. Games, not decisions, because decisions inside one game are not independent, which is
the same reason B3 resamples players.

---

## 4. What this design cannot deliver

It is one participant. It can produce `NATURAL_TRANSFER_SUPPORTED` only as an N-of-1 statement, and
mission section 24 forbids reading that as a population result. It also cannot separate "learned the
cue" from "started paying more attention because somebody was measuring", because there is no sham
arm. A second participant given a sham cue of matched form is the smallest design that could, and
that is a recruitment requirement, not something this repository can satisfy from data it already
holds.
