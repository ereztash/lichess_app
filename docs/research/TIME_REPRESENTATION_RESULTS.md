# Results — is a raw second the wrong unit for a blitz decision?

The study preregistered in `TIME_REPRESENTATION_PREREG.md`, on the corpus that preregistration fixed.
Every threshold, candidate, measure, control and outcome rule below was committed before the corpus
was scored. **Nothing in the product changes as a result of this document**, and §7 said so before
the answer was known.

| | |
| --- | --- |
| engine | **Stockfish 18 Lite WASM** — the build the product ships, by its own `id name` |
| depth | 12, the depth a real import searches at |
| corpus | 75 rated blitz games, one account, `research/b2/corpus_manifest.json` |
| decisions scored | 1,787 |
| evidence | `research/b2/harness_report.json`, sha256 `648c5e9d…81ee90` |
| scoring runs | **one**, as §8 requires. The evidence has not been regenerated. |
| analysis runs | **two** — see §7, *Amendment 2*. The first is reported beside the second, always. |

---

## 1. Four findings, in the order they should be read

**1. The shipped cut resolves nothing.** `raw seconds` — the product's 45 s and 120 s boundaries —
puts **all 806** held-out decisions in one bucket and separates accuracy by **0.00 pp**. It is not a
weak representation on this corpus; it is not a representation at all. Median think time is 3 s,
99.6% of decisions are under 45 s, and **zero** are over 120 s. `slow-over-2m` is not sparse here.
It is empty.

**2. Something inside that one bucket separates hard.** Held-out accuracy across think time, all 75
games, the winning representation after the bucket floor is applied:

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
| 10–14 s | 63 | 48% |
| 15–52 s | 32 | **47%** |

Thirty-four points, near-monotone, **entirely inside the single bucket the product ships.**

**3. All of it, in every cell where the comparison can be made, is position type.** §6's controls say
so from two directions, and §2.2 predicted it before the data existed. This is §3 below and it is the
part a reader must not skip.

**4. The data has no sub-second resolution, which quietly disarmed the winner.** Every one of the
1,578 eligible think times is a whole number of seconds — Lichess's `[%clk]` comments carry
`H:MM:SS`, so a difference of two readings is always an integer. There are **zero** decisions between
0 and 1 second. §4 chose the Lichess encoding scale *because* it is dense below 2 s
(0.1, 0.5, 1, 1.5 …), and on this corpus those boundaries are **inert**: they cannot separate values
that do not exist. The scale that won was never tested at the feature that distinguishes it.

**So: the shipped cut is empty, a finer one is not obviously the fix, and this study is not allowed
to move it anyway.**

## 2. §7's verdict, applied verbatim by the script rather than chosen by a reader

Both corpora reach the same row of §7's table, with the same winner.

| | preregistered 40 | amended 75 |
| --- | --- | --- |
| verdict | **OBSERVATION** | **OBSERVATION** |
| winner | lichess encoding buckets | lichess encoding buckets |
| held-out separation | 11.38 pp | 10.33 pp |
| its random-boundary null | 9.34 pp | 7.06 pp |
| raw seconds | 0.00 pp | 0.00 pp |

Amendment 1's disagreement clause does not fire: the two agree on the verdict, on the winner, and on
the ordering of every candidate. Held-out separation, all five:

| representation | buckets | prereg 40 | its null | amended 75 | its null |
| --- | ---: | ---: | ---: | ---: | ---: |
| raw seconds (the shipped cut) | 1 | 0.00 pp | 0.00 | 0.00 pp | 0.00 |
| log seconds | 5 / 6 | 10.56 pp | 6.89 | 9.96 pp | 5.65 |
| **lichess encoding buckets** | 10 | **11.38 pp** | 9.34 | **10.33 pp** | 7.06 |
| the player's own quartiles | 4 | 10.43 pp | 6.14 | 9.69 pp | 4.64 |
| time pressure (clock %) | 4 | 3.69 pp | 6.68 | 4.24 pp | 4.82 |

**Two hurdles in that table are not what they look like.**

*Beating raw seconds was free.* Raw seconds separates by zero, because every decision falls on one
side of 45 s. §7's first row — "no candidate beats raw seconds out of sample" — could only have fired
if a candidate had separated by nothing at all. The real gate was always the null.

*And "the winner" is a coin flip.* The three time-based candidates finish within **0.95 pp** of each
other on the preregistered corpus and **0.64 pp** on the amended one, on a few hundred held-out
decisions — and finding 4 explains why. With integer-second data all three reduce to nearly the same
discretisation: "each of the first few seconds on its own, everything slow lumped together." What the
data supports is *"some sub-45-second split separates"*. It does not support *"Lichess's encoding is
the right one"*; `lila`'s boundaries win by less than their own noise, at a resolution the corpus
cannot express.

### 2.1 Time pressure, which fails — and fails informatively

`time pressure` does not beat its null on either corpus (3.69 pp against 6.68; 4.24 pp against 4.82).
Its held-out buckets are not merely flat, they are **inverted and non-monotone**:

| clock remaining | n | accurate |
| --- | ---: | ---: |
| under 25% | 112 | **72%** |
| 25–50% | 78 | 60% |
| 50–75% | 178 | 59% |
| 75–100% | 438 | 61% |

The most time-pressured decisions are the most accurate. §1 of the preregistration recorded the same
direction on the old corpus and refused to call it evidence that time pressure does not matter. It
still is not — and now there is a concrete mechanism instead of a shrug. **The low-clock bucket is
where the endgame lives:** 47 of its 112 decisions are endgame (42%), against 66 of 806 held-out
decisions overall (8%). And endgame accuracy on this corpus is **83.3%**, against 60.6% in the
opening and 59.7% in the middlegame.

So *"under time pressure this player is accurate"* is very largely *"late in the game this player is
accurate, and late in the game the clock is low."* The same confound as §3, arriving from the other
side.

## 3. §6's controls, which are the real result

Three controls were fixed in advance. One passes, two fail, and the two that fail say the same thing.

### 3.1 Plain outcome permutation — passes

Shuffling `accurate` across all held-out decisions, keeping every think time where it is, leaves
**3.0–7.5%** of permutations still clearing a 95th-percentile bar, for every candidate. That is what
a 95th percentile means. The bar is calibrated, and the separation is not an artefact of having ten
buckets instead of three.

### 3.2 Permutation within phase × standing — fails

§6: *"Every representation must stop separating."* It does not.

| | plain | within phase × standing |
| --- | ---: | ---: |
| log seconds | 3.0% | **42.0%** |
| lichess encoding buckets | 3.5% | **28.5%** |
| the player's own quartiles | 5.0% | **36.0%** |
| time pressure | 5.0% | 31.0% |

*(amended corpus; the preregistered corpus gives 20.5 / 17.0 / 17.5 / 16.5% against a plain 6.5 / 5.0
/ 7.5 / 4.0%)*

Shuffling the outcome **within** a phase and a standing preserves each cell's own accuracy while
destroying any link between time and outcome inside it. Between a fifth and two fifths of those
shuffles still produce a "significant" separation. So that often, the bucket rates can be reproduced
from **which positions land in which bucket** — think times are not distributed evenly across phases
and standings, and phases and standings differ in accuracy by more than twenty points on their own.

The effect is *larger* on the bigger corpus (28.5% against 17.0%), which is what a real confound does
when it is given more data, and not what noise does.

### 3.3 The same comparison inside one phase and standing — collapses everywhere

§6: *"If a representation's separation collapses once position type is held fixed, the separation was
position type."*

| corpus | cell | n | separation | its null | |
| --- | --- | ---: | ---: | ---: | --- |
| amended 75 | endgame / winning | 53 | 1.80 pp | 9.63 | collapses |
| amended 75 | middlegame / level | 162 | 9.63 pp | 12.87 | collapses |
| amended 75 | middlegame / losing | 122 | 6.96 pp | 11.58 | collapses |
| amended 75 | middlegame / winning | 197 | 8.65 pp | 11.72 | collapses |
| amended 75 | opening / level | 187 | 7.15 pp | 10.03 | collapses |
| prereg 40 | middlegame / level | 96 | 10.97 pp | 13.88 | collapses |
| prereg 40 | middlegame / winning | 117 | 5.53 pp | 12.90 | collapses |
| prereg 40 | opening / level | 95 | 11.71 pp | 11.87 | collapses |

**Every cell in which the comparison can be made collapses — eight of eight, across both corpora.**
There is no survivor to explain away. Cells not listed held too few held-out decisions to produce two
buckets that clear the floor, and are reported as not comparable rather than as a result.

**This is §2.2's confound, bounded rather than removed exactly as promised — and the bound is total,
within the resolution available.** Hard positions take longer *and* are played worse. Nothing here
separates the two, and under this preregistration's own rule the separation is position type.

**No sentence in this document says that thinking longer makes this player worse.** §2.2 forbade it
before the data existed, and the controls have now earned the prohibition.

## 4. What the two preregistered rules add up to

§7's table returns OBSERVATION. §6's controls say the observation is composition. Both were fixed in
advance, and neither may quietly overwrite the other, so both are reported.

They are not in conflict, because they ask different questions. §7 asks *"does this representation
separate more than random boundaries of the same shape?"* — and it does. §6 asks *"is what it
separates about time?"* — and, in every cell where that can be checked, it is not.

The operative consequence is identical under either reading, and §7 fixed it in advance: **nothing in
the product changes.** A representation that wins here must be re-tested against a live record
carrying stated confidence before any cut moves, because the buckets exist to compare a **calibration
gap** and this corpus has none (§2.1). That record does not exist yet.

What this study does license is a **narrower and stronger** statement than the one it set out to
test, because it needs none of the contested inference: *on 75 real blitz games, the product's time
buckets put every decision in one bucket.* That is a fact about the cut, not about time.

## 5. The control that makes this document worth reading

§7's likeliest verdict was STOP-B2-A, *"no representation was better"* — which is also the verdict of
a script that cannot see anything at all. `research/b2/controls.py` separates the two on a
**synthetic** corpus, so running it is never a second look at the real one:

```
  merge floor  every bucket small           -> {3: 30}
  merge floor  one tiny between two large   -> {0: 53, 2: 50}
  merge floor  a long thin tail             -> {0: 51}
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
| dropped, **book** | 206 |
| dropped, **effectively forced** | 3 |
| **eligible** | **1,578** |
| derivation / held-out | 772 / 806 |

1,787 − 206 − 3 = 1,578, and that closes. **36 of those dropped rows also had no derivable think
time** — the player's first move has no previous reading of their own clock — but all 36 are inside
the 206 book rows, so they are an overlap and not a fourth exclusion. An earlier version of this
table listed them as a separate line, which made the arithmetic wrong by 36; review caught it.

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

## 7. What was wrong, and when it was found

### Before any number existed

**A bug in the bucket merge.** `merge_small` routed small buckets with `max(...) or min(...)`, which
treats bucket **0** as absent because `0` is falsy in Python. Bucket 0 is the fastest bucket in every
candidate and, on this distribution, one of the largest — so the bug pushed small buckets away from
the one neighbour they almost always belonged to. Reproduced in isolation, then fixed, while the
scoring run was still going.

**§6 and §7 were not implemented.** The analysis' own docstring claimed §7 was *"applied verbatim at
the end"*; it was not applied at all. It printed spreads and left a human to choose a verdict
afterwards — the exact failure mode a preregistration exists to prevent. Both are now code, and the
verdict is printed by the script rather than chosen by a reader.

**A silent-dropout guard.** `gameId` comes from the harness and the halves come from the manifest,
and nothing forces the two to agree. A decision that maps to neither half now stops the study instead
of shrinking it quietly.

### After publication — Amendment 2

Automated review of the pull request found **three** defects in the analysis. All three were verified
against the evidence before anything was changed, and all three were real. The scoring run was **not**
repeated — the evidence file and its sha256 are unchanged — but the analysis over it was, so this is
declared rather than absorbed, and **the as-published numbers are printed beside the corrected ones
below.**

**(a) The bucket floor switched off exactly where it was needed.** The merge folded a small bucket
into the nearest *large* neighbour — and when **no** bucket reached `MIN_BUCKET`, there was no target
and nothing merged at all. That is precisely the case §6's within-cell control runs in. On 46 held-out
`opening/winning` decisions the Lichess scale produced buckets of 1, 1, 2, 3, 5, 7, 8, 8 and 11, none
of them merged, and the **30.41 pp "survives"** this document reported was computed on them. The merge
is now iterative and unconditional: fold the smallest bucket into its nearer neighbour until every
bucket clears the floor, or one bucket is left and the cell is not comparable.

**(b) The starting clock was inferred from the wrong rows.** It was the largest clock remaining among
**eligible** decisions — but eligible excludes book, book is the opening, and the opening is where the
clock is fullest. In **63 of 75** games the inferred start was below the real one, by up to 86 s. The
inference is now gone entirely: the manifest carries `baseClockMs` from the PGN `TimeControl` header,
and a game missing one stops the study. (Taking the maximum over *all* scored rows, which the review
offered as an alternative, recovers 180 s and 300 s — and 301, 302, 304 and 306 for the `300+3` games,
where the clock climbs past its own start. The header is the only thing that is actually the start.)

**(c) The exclusion ledger double-counted.** §6's table listed 36 "no derivable think time" rows as a
separate drop when all 36 are inside the 206 book rows, so 1,787 − 206 − 3 − 36 did not equal 1,578.
Corrected above.

**What the corrections did to the answer:**

| | as published | corrected |
| --- | --- | --- |
| §7 verdict, both corpora | OBSERVATION | **OBSERVATION** (unchanged) |
| winner, both corpora | lichess encoding buckets | **unchanged** |
| held-out separation, amended | 10.33 pp vs null 6.73 | 10.33 pp vs null **7.06** |
| held-out separation, prereg | 11.34 pp vs null 8.85 | **11.38** pp vs null **9.34** |
| time pressure, amended | 4.02 pp vs null 4.82 | **4.24** pp vs null 4.82 — still fails |
| stratified permutation, lichess | 32.0% | **28.5%** |
| **within-cell control** | **5 of 6 collapse**, `opening/winning` survives at 30.41 pp | **8 of 8 collapse**, no survivor |

**The corrections did not rescue a result; they removed the only two data points that cut against the
conclusion.** The headline verdict is untouched, and the study's central caution — that the separation
is position type — went from "five of six cells, and the survivor is about what chance gives you" to
"every cell in which the comparison can be made". A regression for the floor is now part of
`controls.py`, so the case cannot come back silently.

## 8. What this cannot support

- **One account, one site, two time controls.** Nothing here transfers to another player, to bullet,
  or to classical.
- **Accuracy is a proxy** for the calibration gap the product actually reports (§2.1). Nobody was
  asked how sure they were during a game that was already over.
- **Separation is not causation**, and §3.3 says this separation is position type in every cell that
  could be checked.
- **The winning representation won by less than a percentage point** over two others, at a resolution
  the data does not have. Treat *"some sub-45-second split separates"* as the finding, and the
  identity of the winner as unresolved.
- **`MIN_BUCKET = 20` was chosen after §4 was frozen.** Defensible, and still the thing in this study
  a reviewer should push on first — as one did, and it was wrong in a way worth fixing.
- **The corpus is the account owner's own games**, chosen because the existing corpus held 15 blitz
  games. The owner is also the person the product is for. That is a conflict this study cannot remove
  and does not pretend to.
