# Results — is a raw second the wrong unit for a blitz decision?

The study preregistered in `TIME_REPRESENTATION_PREREG.md`. Every threshold, candidate, measure,
control and outcome rule was committed before any corpus was scored. **Nothing in the product
changes as a result of this document**, and §7 said so before the answer was known.

**Read §7 first if you read nothing else.** This study was published twice on a corpus that was
missing a third of its games, and the corrected corpus **overturned its central conclusion.** Both
earlier results are printed here in full, unmodified.

| | |
| --- | --- |
| engine | **Stockfish 18 Lite WASM** — the build the product ships, by its own `id name` |
| depth | 12, the depth a real import searches at |
| corpus | **117** rated blitz games, one account, `research/b2/corpus_manifest.json` |
| decisions scored | 3,067 |
| scoring runs | **two.** 75 games, then 117 after the corpus rule was found wrong. Both kept. |
| analysis runs | three. See §7. Every one is printed. |

---

## 1. What holds, and needs no engine at all

Computed from the PGN clocks alone across all 117 games — 2,950 own-move think times:

| | |
| --- | ---: |
| median think time | **2 s** |
| 90th percentile | 9 s |
| longest | 81 s |
| under 45 s | **99.7%** |
| **over 120 s** | **0 decisions** |
| non-integer values | **0** |

**The shipped cut resolves nothing.** `raw seconds` — the product's 45 s and 120 s boundaries — puts
**all 1,308** held-out decisions in one bucket and separates accuracy by **0.00 pp**. `slow-over-2m`
is not sparse on this account. It is empty, across every rated blitz game in the export.

**And there is no sub-second resolution.** Lichess's `[%clk]` comments carry `H:MM:SS`, so every
think time is a whole number of seconds and **zero** decisions fall between 0 and 1 s. §4 chose the
Lichess encoding scale *because* it is dense below 2 s (0.1, 0.5, 1, 1.5 …). Those boundaries are
**inert** here. The scale that won was never tested at the feature that distinguishes it.

These two findings survived every corpus change below without moving. They are the ones that bear on
the product.

## 2. §7's verdict — OBSERVATION, on every corpus this study has had

| representation | buckets | prereg 40 | its null | all 117 | its null |
| --- | ---: | ---: | ---: | ---: | ---: |
| raw seconds (the shipped cut) | 1 | 0.00 pp | 0.00 | 0.00 pp | 0.00 |
| log seconds | 4 / 6 | 10.86 pp | 6.23 | 11.74 pp | 4.43 |
| **lichess encoding buckets** | 8 / 11 | **13.03 pp** | 8.16 | **11.76 pp** | 5.61 |
| the player's own quartiles | 3 / 4 | 10.77 pp | 5.43 | 11.07 pp | 3.73 |
| time pressure (clock %) | 4 | 4.12 pp | 5.92 | 3.77 pp | 3.77 |

Same verdict, same winner, same ordering on both halves of the corrected corpus, so Amendment 1's
disagreement clause does not fire.

Held-out accuracy across the winning representation, all 117 games:

| think time | n | accurate |
| --- | ---: | ---: |
| 0 s | 54 | **76%** |
| 1 s | 290 | 76% |
| 2 s | 260 | 66% |
| 3 s | 179 | 65% |
| 4 s | 93 | 52% |
| 5 s | 106 | 50% |
| 6–7 s | 109 | 49% |
| 8–9 s | 73 | 48% |
| 10–14 s | 96 | **41%** |
| 15–19 s | 22 | 45% |
| 20–77 s | 26 | 50% |

Thirty-five points, near-monotone, entirely inside the single bucket the product ships.

**Two hurdles in that table are not what they look like.** *Beating raw seconds was free*, because
raw seconds separates by zero — §7's first row could only have fired if a candidate had separated by
nothing at all. *And the winner is a coin flip*: the three time candidates finish within **0.69 pp**
of each other on 1,308 held-out decisions, and §1 says why — with integer-second data all three
reduce to nearly the same discretisation. The finding is *"some sub-45-second split separates"*, not
*"Lichess's encoding is the right one"*.

### 2.1 Time pressure, which fails on every corpus

`time pressure` does not beat its null anywhere (4.12 pp against 5.92; 3.77 pp against 3.77). Its
held-out buckets are non-monotone, and the reason is visible in their composition:

| clock remaining | n | accurate | what is in it |
| --- | ---: | ---: | --- |
| under 25% | 162 | **67%** | 62 endgame, 100 middlegame, **no opening** |
| 25–50% | 187 | 61% | mostly middlegame |
| 50–75% | 266 | **55%** | 263 of 266 middlegame |
| 75–100% | 693 | 62% | 379 opening, 314 middlegame |

Phase accuracy on this corpus is **endgame 72.1%**, opening 64.0%, middlegame 58.3%. So the
clock-percentage buckets are very largely a phase ordering wearing a clock: the low-clock bucket is
38% endgame and holds no opening at all, and the middle bucket is 99% middlegame. *"Under time
pressure this player is accurate"* is mostly *"late in the game this player is accurate"*.

## 3. §6's controls — and this is where the corrected corpus changed the answer

### 3.1 Plain outcome permutation — passes

Shuffling `accurate` across all held-out decisions leaves **5.5–8.0%** of permutations still clearing
a 95th-percentile bar. That is what a 95th percentile means. The bar is calibrated and the separation
is not an artefact of bucket count.

### 3.2 Permutation within phase × standing — the confound is real, and smaller than reported

| | plain | within phase × standing |
| --- | ---: | ---: |
| log seconds | 5.5% | **18.5%** |
| lichess encoding buckets | 6.0% | **16.0%** |
| the player's own quartiles | 8.0% | **19.0%** |
| time pressure | 7.0% | 9.5% |

Shuffling the outcome *within* a phase and a standing preserves each cell's own accuracy while
destroying any link between time and outcome inside it. Sixteen per cent of those shuffles still
produce a "significant" separation, against a calibrated six. **So a real part of the separation is
composition** — think times are not spread evenly across phases and standings, and phases differ in
accuracy by fourteen points on their own.

**But the 75-game document argued this got *stronger* with more data, and that was wrong.** It said:
*"the effect is larger on the bigger corpus (28.5% against 17.0%), which is what a real confound does
when it is given more data, and not what noise does."* The corrected corpus is larger again — 117
games, 1,308 held-out decisions — and the figure is **16.0%**, back to where the 40-game corpus put
it. The trend that argument was built on does not exist. It was reading noise, and said so with
confidence.

### 3.3 The same comparison inside one phase and standing — three cells now survive

§6: *"If a representation's separation collapses once position type is held fixed, the separation was
position type."*

| cell | n | separation | its null | |
| --- | ---: | ---: | ---: | --- |
| middlegame / level | 250 | 13.93 pp | 11.69 | **survives** |
| middlegame / losing | 288 | 11.89 pp | 10.45 | **survives** |
| middlegame / winning | 274 | 12.85 pp | 10.57 | **survives** |
| opening / level | 279 | 5.18 pp | 9.17 | collapses |
| opening / winning | 55 | 9.27 pp | 12.93 | collapses |
| opening / losing | 58 | 6.08 pp | 13.13 | collapses |
| endgame / winning | 44 | 7.65 pp | 15.10 | collapses |

**All three middlegame cells survive. Every opening cell and the endgame cell collapse.** On the
preregistered newest 40 of the same corpus, the one survivor of four is again `middlegame / winning`.

At a 95th-percentile bar you expect **0.35** survivors in seven. Three is not that, and they are not
scattered — they are exactly the three cells of one phase.

**Is it just power?** That is the first thing to check, because the middlegame cells are the biggest.
It is not sufficient: `opening / level` holds **279** held-out decisions — more than two of the three
survivors — and collapses hard, at 5.18 pp against a 9.17 pp null. Size is not what separates the two
groups.

**What this does and does not license.** §2.2 forbids saying that thinking longer makes this player
worse, and that prohibition stands — nothing here separates thinking from difficulty. What can be
said is narrower: *on this corpus, the separation between think time and accuracy survives holding
phase and standing fixed inside the middlegame, and does not survive it in the opening or the
endgame.* That is a fact about where the confound explains everything and where it does not.

## 4. What the two preregistered rules add up to now

§7 returns OBSERVATION. §6 says a real part of the separation is composition — and, on the corrected
corpus, **not all of it**. Both were fixed in advance and both are reported.

The operative consequence is unchanged, and §7 fixed it before the answer was known: **nothing in the
product changes.** A winner must be re-tested against a live record carrying stated confidence before
any cut moves, because the buckets exist to compare a **calibration gap** and no imported corpus has
one (§2.1). That record does not exist yet.

What this study licenses without any contested inference remains §1: **on 117 real blitz games, the
product's time buckets put every decision in one bucket, and the second bucket is empty.** That is a
fact about the cut.

## 5. The control that makes a null result mean anything

§7's likeliest verdict was STOP-B2-A, *"no representation was better"* — which is also the verdict of
a script that cannot see anything at all. `research/b2/controls.py` separates them on a **synthetic**
corpus, so running it is never a second look at the real one. Five runs plus three merge-floor cases,
each of which must land where it is told; the planted run returns OBSERVATION at 27.7 pp against a
7.2 pp null, **naming the candidate the signal was written from.**

## 6. Every decision accounted for

| | |
| --- | ---: |
| games in the export | 120 |
| excluded, too few clock readings | 3 |
| **qualifying, and used** | **117** |
| decisions scored | 3,067 |
| dropped — book | 336 |
| dropped — effectively forced | 11 |
| **eligible** | **2,720** |
| derivation / held-out | 1,412 / 1,308 |

3,067 − 336 − 11 = 2,720, and that closes. 58 of the dropped rows also had no derivable think time —
a player's first move has no previous reading of their own clock — but all 58 are inside the book and
forced rows, so they are an overlap and not a fourth exclusion.

One game contributed **zero** eligible decisions, so the full analysis runs on 116 games' decisions.
Reproducibility, from `harness_report.json`: the run repeats itself decision for decision, is
order-independent as the product configures it, and the historical warm-hash control still comes
apart — its largest bucket shift is 1.49 pp. Clearing the table costs **1.41×**.

## 7. Everything that was wrong, and when

### Before any number existed

**A falsy-zero bug in the bucket merge.** `max(...) or min(...)` treats bucket `0` as absent because
`0` is falsy in Python. Reproduced in isolation and fixed while the first scoring run was going.

**§6 and §7 were not implemented.** The analysis' docstring claimed §7 was *"applied verbatim at the
end"*; it printed spreads and left a human to choose a verdict. Both are code now.

### Amendment 2 — three defects found by review, after publication

Automated review of the pull request found three, all verified against the evidence before anything
changed, all real: **(a)** the bucket floor stopped applying when *no* bucket reached it — exactly the
case §6's within-cell control runs in, where it had produced a **30.41 pp "survives"** on buckets of
one and two decisions; **(b)** the `time pressure` denominator was inferred from *eligible* rows,
which exclude book, and book is the opening where the clock is fullest — 63 of 75 games had an
understated start; **(c)** the exclusion ledger double-counted 36 rows.

### Amendment 3 — the corpus rule was applied to prose, and dropped 42 rated games

**This is the one that mattered, and it was found because the account holder asked whether the engine
had been run on every game it could.**

`build_corpus.py` decided rated-ness by testing the PGN's free-text `Event` header:

```python
if "rated" not in event: drop("unrated")
```

A Lichess **arena** game's Event is `Hourly SuperBlitz Arena`. The substring never appears, so every
arena game the account had played was dropped and counted as unrated — **42 rated blitz games, more
than a third of the corpus.** They are rated: all 42 carry `WhiteRatingDiff`, which Lichess writes
only for a rated game. **The study ran on 75 games when 117 qualified**, and an earlier version of
this document called the exclusion a success: *"The rule caught them and counted them."* It had
caught rated games and mislabelled them.

**Why this survived when three analysis defects did not.** `analyse.py` was committed, so review read
it and found three real bugs within the hour. `build_corpus.py` lived in a scratch directory and was
never committed, so nobody read it at all — and it decided **which games existed**. Every control in
this study operates on the corpus it is given; none can see a game that was never in it. The builder
is in the repository now, and its rule is structural: rated from `RatingDiff`, blitz from the time
control, standard from `Variant`, and the `Event` string parsed only to **report** a disagreement.

### What the corrections did — all three results, side by side

| | 40 (published) | 75 (published) | **117 (§3, correctly applied)** |
| --- | --- | --- | --- |
| §7 verdict | OBSERVATION | OBSERVATION | **OBSERVATION** |
| winner | lichess encoding | lichess encoding | **lichess encoding** |
| held-out separation | 11.38 pp / null 9.34 | 10.33 pp / null 7.06 | **11.76 pp / null 5.61** |
| time pressure | fails | fails | **fails** |
| stratified permutation, winner | 17.0% | 28.5% | **16.0%** |
| **within-cell control** | 3 of 3 collapse | 8 of 8 collapse | **3 of 7 SURVIVE** |

**The verdict never moved. The conclusion did.**

Amendment 2's corrections took §6's within-cell control from *five of six collapse, one survives* to
*eight of eight collapse, no survivor*, and this document then said, in its own words, that the
separation *"is position type in every cell where that can be checked"* and that the bound was
*"total, within the resolution available"*.

**That was a claim about a corpus missing 42 of its games.** On the corpus §3 actually specifies,
three cells survive — all three middlegame cells — and the "the confound grows with more data"
argument is falsified by the more data it asked for.

Amendment 3 recorded the expectation **before the run finished**: *"42 more games from the same
account, the same time controls and the same period will not move much."* It is written into the
preregistration for exactly this purpose, and it was **wrong**. The corrected corpus did not confirm
the published conclusion; it overturned it, in the direction of the study's own result rather than
against it, which is the uncomfortable direction to have to report.

The 75-game run is preserved unmodified in `research/b2/as-published-75/`, including the sha256 of
its decision evidence.

## 8. What this cannot support

- **One account, one site, three time controls.** Nothing transfers to another player, to bullet, or
  to classical.
- **Accuracy is a proxy** for the calibration gap the product reports (§2.1). Nobody was asked how
  sure they were during a game already over.
- **Separation is not causation.** §3.3 says where the confound explains everything and where it does
  not; it does not say what causes the rest.
- **The winning representation won by 0.69 pp** over two others, at a resolution the data does not
  have. *"Some sub-45-second split separates"* is the finding.
- **`MIN_BUCKET = 20` was chosen after §4 was frozen.** Still the thing a reviewer should push on
  first — one did, and it was wrong in a way worth fixing.
- **This study has been wrong twice in public.** Once in its analysis, once in its corpus. The second
  was found by a question from the account holder, not by any control in the repository — because no
  control in it could see a game that was never selected.
