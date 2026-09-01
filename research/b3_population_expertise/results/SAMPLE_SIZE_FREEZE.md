# B3 -- final sample size, frozen

Written **before** any period was scored, from the cost pilot only. The pilot measured cost and
supply. It did not estimate any scientific effect: it never touched `quality_loss`, never fitted a
model, and never joined a feature to an outcome. A pilot that peeks at the relationship and then
chooses N is choosing N to reach a p-value.

## What the pilot measured

| | DEVELOPMENT window (2026-02-01 UTC, `180+0`) |
|---|---|
| games in the window | 3,012,764 |
| compressed prefix consumed | 995,383,550 bytes (167 s of streaming) |
| candidate sides in the studied rating range | 1,149,595 |
| distinct players | 115,405 |
| mean eligible decisions per accepted side | 31.69 |
| engine throughput, 4 workers, 60k nodes, MultiPV 4, two searches per decision | ~20 decisions/s |
| account-status exclusion rate (measured on a smoke sample) | 5.5% of sampled sides |

Supply is not the binding constraint anywhere: the thinnest band, 2400-2599, offers 20,915
candidate sides and ~101,000 eligible decisions in a single day.

## What was frozen, and why these numbers

**Target: 320 accepted sides per band per period.** After the account-status exclusion (~5.5%) and
the movetext-level exclusions (~3%), that leaves ~294 sides and ~9,330 eligible decisions per band.

Both adequacy thresholds are cleared with roughly a **2x margin**:

| Requirement | Threshold | Expected |
|---|---|---|
| distinct players per band | >= 150 | ~294 |
| eligible decisions per band | >= 3,000 | ~9,330 |
| adequately powered bands (Gate 1, R4d) | >= 5 | **9 of 9** |

The margin is the point. `VERDICT_RULES.md` requires at least five adequately powered bands, the
acceptance rates are frozen from DEVELOPMENT and applied unchanged to VALIDATION and FINAL, and the
later periods will differ in volume. A target that only just cleared the bar on DEVELOPMENT could
drop a band below it on FINAL, and which bands are adequate would then be partly an accident of the
month.

**Acceptance rates** (`src/rates_primary.json`), each `320 / candidates_b` from the pilot:

| band | candidate sides | `q_b` |
|---|---|---|
| 800-999 | 27,471 | 0.011649 |
| 1000-1199 | 64,010 | 0.004999 |
| 1200-1399 | 113,921 | 0.002809 |
| 1400-1599 | 182,255 | 0.001756 |
| 1600-1799 | 245,192 | 0.001305 |
| 1800-1999 | 257,872 | 0.001241 |
| 2000-2199 | 168,716 | 0.001897 |
| 2200-2399 | 69,243 | 0.004621 |
| 2400-2599 | 20,915 | 0.015300 |

**Totals: ~84,000 eligible decisions and ~2,650 independent players per period; ~252,000 decisions
across the three primary periods.** The secondary time control (`300+0`) runs at half that target,
because it is a directional replication of a frozen pipeline rather than a second primary result.

## Why not more

The mission plan's order-of-magnitude target is 200,000-500,000 eligible decisions, and ~252,000
sits inside it. Going higher would buy narrower intervals on a design whose limiting uncertainty is
**not** sampling error. With ~2,650 independent players per period, the player-level block bootstrap
-- the only interval this study reports -- is governed by the cluster count, and the binding
uncertainties are the ones no N repairs: difficulty is measured with error by one engine at one
budget, and thinking time is quantised to whole seconds. Spending hours of engine time to make a
p-value smaller against those would be spending it in the wrong place.

## Cost

At ~20 decisions/s: ~70 minutes per primary period, ~35 for the secondary, ~4 hours in total,
plus the C9 re-score of 5,000 VALIDATION decisions at 150,000 nodes.
