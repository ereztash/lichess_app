# Results — is a raw second the wrong unit for a blitz decision?

The study preregistered in `TIME_REPRESENTATION_PREREG.md`, run once, on the corpus that
preregistration fixed. Every threshold, candidate, measure, control and outcome rule below was
committed before the corpus was scored. **Nothing in the product changes as a result of this
document**, and §7 said so before the answer was known.

| | |
| --- | --- |
| engine | **Stockfish 18 Lite WASM** — the build the product ships, by its own `id name` |
| depth | 12, the depth a real import searches at |
| corpus | 75 rated blitz games, one account, `research/b2/corpus_manifest.json` |
| decisions scored | 1,787 |
| evidence | `research/b2/harness_report.json`, sha256 `648c5e9d…81ee90` |
| run | one, as §8 requires |

---

## 1. Four findings, in the order they should be read

**1. The shipped cut resolves nothing.** `raw seconds` — the product's 45 s and 120 s boundaries —
puts **all 806** held-out decisions in one bucket and separates accuracy by **0.00 pp**. It is not a
weak representation on this corpus; it is not a representation at all. Median think time is 3 s,
99.6% of decisions are under 45 s, and **zero** are over 120 s. `slow-over-2m` is not sparse here.
It is empty.

**2. Something inside that one bucket separates hard.** Held-out accuracy across think time, all 75
games, the winning representation after small buckets are merged:

| think time | n | accurate |
| --- | ---: | ---: |
| 0 s | 43 | **81%** |
| 1 s | 188 | 73% |
| 2 s | 149 | 66% |
| 3 s | 105 | 60% |
| 4 s | 61 | 49% |
| 5 s | 48 | 56% |
| 6–7 s | 76 | 51% |
| 8–9 s | 41 | 56% |
| 10–52 s | 95 | **47%** |

Thirty-four points, near-monotone, **entirely inside the single bucket the product ships.**

**3. Most of that is position type, not time.** §6's controls say so from two directions, and §2.2
predicted it before the data existed. This is §3 below and it is the part a reader must not skip.

**4. The data has no sub-second resolution, which quietly disarmed the winner.** Every one of the
1,578 eligible think times is a whole number of seconds — Lichess's `[%clk]` comments carry
`H:MM:SS`, so a difference of two readings is always an integer. There are **zero** decisions
between 0 and 1 second. §4 chose the Lichess encoding scale *because* it is dense below 2 s
(0.1, 0.5, 1, 1.5 …), and on this corpus those boundaries are **inert**: they cannot separate values
that do not exist. The scale that won was never tested at the feature that distinguishes it.

**So: the shipped cut is empty, a finer one is not obviously the fix, and this study is not allowed
to move it anyway.**

## 2. §7's verdict, applied verbatim

Both corpora reach the same row of §7's table, with the same winner.

| | preregistered 40 | amended 75 |
| --- | --- | --- |
| verdict | **OBSERVATION** | **OBSERVATION** |
| winner | lichess encoding buckets | lichess encoding buckets |
| held-out separation | 11.34 pp | 10.33 pp |
| its random-boundary null | 8.85 pp | 6.73 pp |
| raw seconds | 0.00 pp | 0.00 pp |

Amendment 1's disagreement clause does not fire: the two agree on the verdict, on the winner, and on
the ordering of every candidate. Held-out separation, all five:

| representation | buckets | prereg 40 | its null | amended 75 | its null |
| --- | ---: | ---: | ---: | ---: | ---: |
| raw seconds (the shipped cut) | 1 | 0.00 pp | 0.00 | 0.00 pp | 0.00 |
| log seconds | 5 / 6 | 10.56 pp | 6.89 | 9.96 pp | 5.65 |
| **lichess encoding buckets** | 9 | **11.34 pp** | 8.85 | **10.33 pp** | 6.73 |
| the player's own quartiles | 4 | 10.43 pp | 6.14 | 9.69 pp | 4.64 |
| time pressure (clock %) | 4 | 3.39 pp | 6.71 | 4.02 pp | 4.82 |

**Two hurdles in that table are not what they look like.**

*Beating raw seconds was free.* Raw seconds separates by zero, because every decision falls on one
side of 45 s. §7's first row — "no candidate beats raw seconds out of sample" — could only have
fired if a candidate had separated by nothing at all. The real gate was always the null.

*And "the winner" is a coin flip.* The three time-based candidates finish within **0.9 pp** of each
other on the preregistered corpus and **0.6 pp** on the amended one, on a few hundred held-out
decisions — and finding 4 explains why. With integer-second data, all three reduce to nearly the
same discretisation: "each of the first few seconds on its own, everything slow lumped together."
What the data supports is *"some sub-45-second split separates"*. It does not support *"Lichess's
encoding is the right one"*; `lila`'s boundaries win by less than their own noise, at a resolution
the corpus cannot express.

## 2.1 Time pressure, which fails — and fails informatively

`time pressure` does not beat its null on either corpus (3.39 pp against 6.71; 4.02 pp against 4.82).
Its held-out buckets are not merely flat, they are **inverted and non-monotone**:

| clock remaining | n | accurate |
| --- | ---: | ---: |
| under 25% | 110 | **72%** |
| 25–50% | 79 | 61% |
| 50–75% | 175 | 59% |
| 75–100% | 442 | 61% |

The most time-pressured decisions are the most accurate. §1 of the preregistration recorded the same
direction on the old corpus and refused to call it evidence that time pressure does not matter. It
still is not — and now there is a concrete mechanism instead of a shrug. **The low-clock bucket is
where the endgame lives:** 45 of its 110 decisions are endgame, against 66 of 806 held-out decisions
overall. And endgame accuracy on this corpus is **83.3%**, against 60.6% in the opening and 59.7% in
the middlegame.

So "under time pressure this player is accurate" is very largely "late in the game this player is
accurate, and late in the game the clock is low." Which is the same confound as §3, arriving from
the other side.

## 3. §6's controls, which are the real result

Three controls were fixed in advance. One passes, two fail, and the two that fail say the same thing.

### 3.1 Plain outcome permutation — passes

Shuffling `accurate` across all held-out decisions, keeping every think time where it is, leaves
**3.0–7.5%** of permutations still clearing a 95th-percentile bar, for every candidate. That is what
a 95th percentile means. The bar is calibrated, and the separation is not an artefact of having nine
buckets instead of three.

### 3.2 Permutation within phase × standing — fails

§6: *"Every representation must stop separating."* It does not.

| | plain | within phase × standing |
| --- | ---: | ---: |
| log seconds | 3.0% | **42.0%** |
| lichess encoding buckets | 3.5% | **32.0%** |
| the player's own quartiles | 5.0% | **36.0%** |
| time pressure | 5.5% | 32.0% |

*(amended corpus; the preregistered corpus gives 20.5 / 18.0 / 17.5 / 16.5% against the same ~5%)*

Shuffling the outcome **within** a phase and a standing preserves each cell's own accuracy while
destroying any link between time and outcome inside it. A third of those shuffles still produce a
"significant" separation. So a third of the time, the bucket rates can be reproduced from **which
positions land in which bucket** — think times are not distributed evenly across phases and
standings, and phases and standings differ in accuracy by more than twenty points on their own.

The effect is *larger* on the bigger corpus (32% against 18%), which is what a real confound does
when it is given more data, and not what noise does.

### 3.3 The same comparison inside one phase and standing — collapses

§6: *"If a representation's separation collapses once position type is held fixed, the separation
was position type."*

| cell | n | separation | its null | |
| --- | ---: | ---: | ---: | --- |
| endgame / winning | 53 | 1.80 pp | 9.63 | collapses |
| middlegame / level | 162 | 8.91 pp | 10.74 | collapses |
| middlegame / losing | 122 | 4.97 pp | 10.03 | collapses |
| middlegame / winning | 197 | 8.65 pp | 10.85 | collapses |
| opening / level | 187 | 6.57 pp | 8.91 | collapses |
| opening / winning | 46 | 30.41 pp | 27.14 | survives |

Five of six cells collapse. The survivor holds 46 decisions against a 27 pp null — at a 95% bar, one
survivor in six is roughly what chance delivers (0.3 expected). The preregistered corpus has the same
shape: two of three collapse, and the survivor is `opening / level` at n = 95.

**This is §2.2's confound, bounded rather than removed exactly as promised — and the bound is
large.** Hard positions take longer *and* are played worse. Nothing here separates the two, and under
this preregistration's own rule the separation is mostly position type.

**No sentence in this document says that thinking longer makes this player worse.** §2.2 forbade it
before the data existed, and the controls have now earned the prohibition.

## 4. What the two preregistered rules add up to

§7's table returns OBSERVATION. §6's controls say the observation is largely composition. Both were
fixed in advance, and neither may quietly overwrite the other, so both are reported.

They are not in conflict, because they ask different questions. §7 asks *"does this representation
separate more than random boundaries of the same shape?"* — and it does. §6 asks *"is what it
separates about time?"* — and mostly it is not.

The operative consequence is identical under either reading, and §7 fixed it in advance: **nothing in
the product changes.** A representation that wins here must be re-tested against a live record
carrying stated confidence before any cut moves, because the buckets exist to compare a
**calibration gap** and this corpus has none (§2.1). That record does not exist yet.

What this study does license is a **narrower and stronger** statement than the one it set out to
test, because it needs none of the contested inference: *on 75 real blitz games, the product's time
buckets put every decision in one bucket.* That is a fact about the cut, not about time.

## 5. The control that makes this document worth reading

§7's likeliest verdict was STOP-B2-A, *"no representation was better"* — which is also the verdict of
a script that cannot see anything at all. `research/b2/controls.py` separates the two on a
**synthetic** corpus, so running it is never a second look at the real one:

```
  no signal          ['STOP-B2-C', 'STOP-B2-B']      not OBSERVATION       ok
  plant-signal       ['OBSERVATION', 'OBSERVATION']  found, and named      ok
  shuffle-outcome    ['STOP-B2-B', 'STOP-B2-B']      not OBSERVATION       ok
  shuffle-time       ['STOP-B2-B', 'STOP-B2-B']      not OBSERVATION       ok
  constant-outcome   ['STOP-B2-A', 'STOP-B2-A']      not OBSERVATION       ok
```

The planted run writes accuracy as a function of the Lichess bucket index, and the study returns
OBSERVATION at 27.7 pp against a 7.2 pp null, **naming the candidate the signal was written from.**
The study can see a signal, and it finds nothing when there is none to see.

## 6. Every decision, accounted for

| | |
| --- | ---: |
| games in the export | 120 |
| excluded, unrated | 45 |
| qualifying, and used | **75** |
| decisions scored | 1,787 |
| dropped, book | 206 |
| dropped, effectively forced | 3 |
| dropped, no derivable think time | 36 |
| **eligible** | **1,578** |
| derivation / held-out | 772 / 806 |

One game, `WqAO8YzL`, contributed **zero** eligible decisions: it produced three scored rows and all
three were book. So the amended analysis runs on 74 games' decisions, not 75, and the number is
printed rather than rounded away.

The distribution the shipped cut was applied to:

| | |
| --- | ---: |
| median think time | **3 s** |
| 90th percentile | 10 s |
| longest | 63 s |
| recorded as 0 s | 68 decisions, 4.3% |
| under 45 s | **99.6%** |
| over 120 s | **0 decisions** |
| non-integer values | **0 of 1,578** |

## 7. What was found blind, before any number existed

**A bug in the bucket merge.** `merge_small` routed small buckets with `max(...) or min(...)`, which
treats bucket **0** as absent because `0` is falsy in Python. Bucket 0 is the fastest bucket in every
candidate and, on this distribution, one of the largest — so the bug pushed small buckets away from
the one neighbour they almost always belonged to. Reproduced in isolation, then fixed, while the
scoring run was still going.

**§6 and §7 were not implemented.** The analysis' own docstring claimed §7 was *"applied verbatim at
the end"*; it was not applied at all. It printed spreads and left a human to choose a verdict
afterwards — which is the failure mode a preregistration exists to prevent. Both are now code, and
the verdict is printed by the script rather than chosen by a reader.

**A silent-dropout guard.** `gameId` comes from the harness and the halves come from the manifest,
and nothing forces the two to agree. A decision that maps to neither half now stops the study instead
of shrinking it quietly.

## 8. What this cannot support

- **One account, one site, two time controls.** Nothing here transfers to another player, to bullet,
  or to classical.
- **Accuracy is a proxy** for the calibration gap the product actually reports (§2.1). Nobody was
  asked how sure they were during a game that was already over.
- **Separation is not causation**, and §3.3 says most of this separation is position type anyway.
- **The winning representation won by less than a percentage point** over two others, at a resolution
  the data does not have. Treat *"some sub-45-second split separates"* as the finding, and the
  identity of the winner as unresolved.
- **`MIN_BUCKET = 20` was chosen after §4 was frozen.** A bucket of six decisions is not a rate, so
  buckets under twenty are merged into the nearest large neighbour, below first. Defensible, and
  still the thing in this study a reviewer should push on first.
- **The corpus is the account owner's own games**, chosen because the existing corpus held 15 blitz
  games. The owner is also the person the product is for. That is a conflict this study cannot remove
  and does not pretend to.
