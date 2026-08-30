# Preregistration — is a raw second the wrong unit for a blitz decision?

Written and committed **before the corpus was built and before anything was computed.** B2 of
`docs/ACTION_PLAN.md`, unblocked when `STOP-B1` was resolved by re-measuring the record on the
shipped engine.

---

## 1. Why this is being asked now

The product cuts its time buckets at **45 seconds** and **120 seconds**. On the canonical record —
1,587 decisions, six real players, `research/harness-shipped/` — those cuts do this:

| | |
| --- | ---: |
| median think time | **2 s** |
| under 5 s | 77.8% |
| under 45 s | **99.9%** |
| over 120 s | **0.1%** — one decision in 1,562 |

`fast-under-45s` is not a bucket, it is the record. `slow-over-2m` is empty. `GATE-SHUFFLE-REAL`
already reports that only **4 of 6** buckets are ever comparable, and this is why.

Inside the blitz subset alone (485 decisions), the thing those cuts are hiding:

| think time | n | accurate |
| --- | ---: | ---: |
| 0–1 s | 137 | **78.1%** |
| 2–3 s | 161 | 72.0% |
| 4–7 s | 89 | 50.6% |
| 8 s+ | 54 | **46.3%** |

Thirty-two points, monotone, all inside a single shipped bucket.

**And the same decisions split by time pressure instead** — clock remaining as a percentage of that
game's start — separate by **five** points, in the opposite direction (64.5% → 67.9% → 69.8%). That
is a real observation about this corpus and it is **not** evidence that time pressure does not
matter: the region where it would, below 25% of the clock, holds **13 decisions**. It is unmeasured,
not ruled out.

## 2. Three things this study cannot do, stated before it starts

### 2.1 It cannot study the calibration gap — the thing the buckets are actually for

`shared/detector.ts` compares the **calibration gap** — stated confidence against what happened —
inside a bucket versus outside it. `shared/import-diagnostic.ts` says, in its own words:

> *"It must not compute a gap. **There is no confidence in this data.** No field here is named
> `gap` or `confidence`, and a caller that wants one has to go through the record."*

Nobody was asked how sure they were during a game that was already over. So the outcome available
on any imported corpus is **accuracy**, and accuracy is a **proxy** for the outcome the product
reports. A representation that separates accuracy may fail to separate a calibration gap. That is
not a caveat to append at the end; it is the reason §7 forbids this study from moving a threshold
on its own.

### 2.2 It cannot separate thinking from difficulty

Hard positions take longer **and** are played worse. The 32-point spread above is at least partly —
possibly mostly — position difficulty wearing a clock. This study measures whether a representation
**separates**, and separation is not causation. No sentence produced by it may say that thinking
longer makes a player worse.

### 2.3 It cannot answer for anything but the corpus it runs on

One player, one site, two time controls. Nothing here transfers to bullet, to classical, or to
another person.

## 3. The corpus, with its selection rule fixed now

The owner's own games, because the owner plays 3+0 and 5+0 and the existing corpus holds **15**
blitz games. Imported through the product's own path, so the decisions are the product's decisions.

Fixed before anything is fetched:

- **The most recent 40 completed games** meeting every condition below, taken newest first with no
  further selection.
- Rated, standard chess only. Variants are excluded — every layer downstream assumes a standard
  opening position.
- Blitz only, as the site classifies it.
- The game must carry a clock for the owner's moves in its PGN. A game without one contributes
  nothing to a study about time and is counted as excluded rather than silently dropped.
- **Split by GAME, not by decision**, into a derivation half and a held-out half, alternating by
  recency so both halves span the same period. Decisions from one game never appear on both sides.
- If fewer than 40 games qualify, the study runs on what there is and **the shortfall is reported**;
  the rule is not relaxed to reach 40.

## 4. The candidate representations

| | |
| --- | --- |
| **raw seconds** | the baseline. Everything else must beat it out of sample or lose. |
| **log seconds** | `log(1 + s)`, for a distribution whose median is 2 and whose tail is 341 |
| **Lichess-shaped buckets** | the boundaries `lila` quantises move times to in `BinaryFormat.scala`: 0.1, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 40, 60 s. Dense below 2 s, sparse above 30. Chosen because it has a precedent over hundreds of millions of games, not because it looked right. |
| **the player's own quantiles** | quartiles of this player's own think times, computed on the derivation half only. Needs no threshold and transfers across time controls. |
| **time pressure** | clock remaining as a percentage of the game's starting clock, which is what Lichess Insights calls *"Time pressure — time left on the player clock, accounting for increment. 100% = full clock, 0% = flagging."* |

Lichess's own numeric bucket boundaries for its Insights dimensions were **not** obtainable and are
**not** guessed at. Only the encoding boundaries above, which are in a file that was read.

## 5. The measure, and the bar it has to clear — derived, not chosen

**The measure.** For a representation that divides decisions into k buckets, the separation is the
spread in accuracy across those buckets, weighted by bucket size.

**The bar.** A representation earns nothing by having more buckets or luckier boundaries, so it is
compared against what **random boundaries producing the same bucket sizes** achieve on the same
data. The bar is the **95th percentile of 1,000 such random re-bucketings**. A representation that
does not clear its own random-boundary null has found nothing.

That threshold comes from the data's own structure. It is not a number anyone picked, and it is the
same shape as `GATE-SHUFFLE-REAL` and `GATE-WORST-BUCKET`, which this repository already runs.

**And it must hold out of sample.** Boundaries and quantiles are fitted on the derivation half only,
then applied unchanged to the held-out half. The reported result is the held-out one.

## 6. Controls, fixed in advance

- **Outcome permutation.** Shuffle `accurate` within phase and standing, keeping every think time
  where it is. Every representation must stop separating. One that still separates is reading the
  bucketing, not the record.
- **Random-boundary null.** As in §5, and reported for every candidate including the baseline.
- **The difficulty confound, bounded rather than removed.** Repeat the whole comparison within a
  single phase and a single standing at a time. If a representation's separation collapses once
  position type is held fixed, the separation was position type. This bounds §2.2; it does not
  close it.

## 7. The outcome rule, fixed in advance

Let **H** be the held-out separation of the best candidate and **N** its random-boundary null.

| | verdict |
| --- | --- |
| No candidate beats raw seconds out of sample | **STOP-B2-A.** Keep raw seconds. Write "no representation was better." |
| A candidate beats raw seconds but not its own null | **STOP-B2-B.** Report the null as unbeaten. Adopt nothing. |
| The winner differs between the two halves | **STOP-B2-C.** Report as unstable. Adopt nothing. |
| A candidate beats both, on both halves | **Observation only.** It is written up as a candidate representation and **nothing in the product changes.** |

**Even a clean win changes nothing on its own.** The buckets exist to compare a calibration gap, and
this study cannot see one (§2.1). A representation that wins here must be re-tested against a live
record carrying stated confidence before any cut moves. That record does not exist yet.

## 8. What is forbidden

- **No threshold moves.** Not `45`, not `120`, not the accuracy rule, not the separability bar. This
  study's output is a document.
- **No re-running for a better answer.** One corpus, built once by the rule in §3. A technical
  failure is reported and repeated; a completed run is the result whatever it says.
- **No dropping decisions or games** after seeing them. Exclusions are the ones in §3 and they are
  counted.
- **No swapping the outcome or the measure** to find significance. Accuracy, as defined in
  `shared/detector.ts`, and the spread in §5.
- **No new candidate added after seeing the data.** The five in §4 are the five.

---

## 9. Amendment 1 — the corpus is 75 games, not 40

**Written and committed 2026-08-30T12:04Z**, while the scoring run was still mid-flight and before
any number this study produces existed. `research/b2/` at the moment of writing held `corpus.json`,
`corpus_manifest.json` and `analyse.py` and nothing else: no `decision_evidence.jsonl`, no
`harness_report.json`, no separation, no null, no verdict. `analyse.py` has never been executed on
any corpus. The amendment is therefore blind in the only sense that matters — it cannot have been
chosen for its answer, because there was no answer to choose it for.

### What changed

§3 fixed **"the most recent 40 completed games."** The account holds more than that. Applying §3's
own conditions to the full export — 120 games, 45 excluded as unrated, none excluded for any other
reason — leaves **75 qualifying games**, and the study runs on all 75.

### Why 40 was there in the first place

It was a number written before the data existed. §3 anticipated a **shortage** and said what to do
about one: *"If fewer than 40 games qualify, the study runs on what there is and the shortfall is
reported; the rule is not relaxed to reach 40."* It never anticipated a surplus and says nothing
about one. 40 was not a supply limit, a power calculation, or a boundary anything depends on; it
was a guess at how many blitz games a person has.

### Why enlarging is safe here, specifically

Because the preregistered analysis survives intact rather than being replaced. The newest 40 are a
**strict subset** of the 75 under the same newest-first ordering, and §3 assigns halves by
**recency index** — alternating, so game *i* is derivation when *i* is even. That index is identical
in both corpora, and it was checked rather than assumed: every one of the 75 games' half assignment
equals its index parity, and the newest 40 split 20 derivation / 20 held-out exactly as they would
have in a 40-game corpus. One scoring run over 75 games therefore yields **both** analyses from
**identical per-decision rows** — the preregistered 40-game study and an amended 75-game one — with
no second engine pass and no opportunity for the two to disagree about anything but sample.

### What it costs, which is not nothing

The 35 added games are **not** a neutral enlargement. They are the older slab, and the account
changed across the window:

| | preregistered 40 | added 35 | amended 75 |
| --- | ---: | ---: | ---: |
| span | 10 Jul – 29 Aug | 28 May – 28 Jun | 28 May – 29 Aug |
| rating (own), median | 1569 | **1647** | 1622 |
| rating range | 1516–1634 | 1590–1665 | 1516–1665 |
| 3+0 share | 20/40 = 50% | **30/35 = 86%** | 50/75 = 67% |

So the amended corpus is a **different mixture** — older, stronger, and far more 3+0 — not the same
player sampled more deeply. Any difference between the two analyses may be composition rather than
statistical power, and no sentence produced by this study may attribute such a difference to sample
size without saying that.

### The rule that stops this being a second attempt, fixed now

- **The preregistered 40-game analysis is the result.** It is computed and reported whatever it says.
- The 75-game analysis is reported **beside** it, always, including when it is the less interesting
  of the two.
- **If the two reach different verdicts under §7, the preregistered verdict stands** and the
  disagreement is reported as instability — the same treatment §7 already prescribes for a winner
  that differs between halves.
- Neither corpus may be selected after seeing its numbers, and no third corpus size exists.
- §8 applies unchanged to both. No threshold moves, no added candidates, no re-running, no dropping
  games.

---

## 10. Amendment 2 — the analysis was re-run after review found three defects in it

**Written and committed 2026-08-30T12:45Z, after the result was published.** This is the amendment
that most easily becomes a second chance, so it says exactly what was done and prints both answers.

### What was not re-run

**The scoring run.** §8 forbids re-running for a better answer, and one corpus scored once is the
thing that rule protects. `research/b2/decision_evidence.jsonl` is byte-identical, its sha256 is
unchanged, and no game entered or left the corpus. The engine was not started again.

### What was re-run, and why

The **analysis over that fixed evidence**, after automated review of the pull request found three
implementation defects. Each was verified against the evidence before anything was changed, and each
was real:

- **(a)** The bucket floor stopped applying when *no* bucket reached it, which is exactly the case
  §6's within-cell control runs in. The `opening/winning` cell's reported **30.41 pp "survives"** was
  computed on buckets of 1, 1, 2, 3, 5, 7, 8, 8 and 11 decisions against a stated floor of 20.
- **(b)** The starting clock for `time pressure` was inferred from *eligible* decisions, which exclude
  book — and book is the opening, where the clock is fullest. 63 of 75 games had an understated start.
- **(c)** The exclusion ledger listed 36 rows twice, so its arithmetic did not close.

§8's prohibitions are on **moving thresholds, adding candidates, dropping data, swapping the outcome
or the measure, and re-running to get a nicer number.** None of those happened. `MIN_BUCKET` is still
20, the five candidates in §4 are still the five, the measure in §5 is unchanged, and the corpus is
untouched. What changed is that the floor now actually applies and the clock denominator is read from
the PGN header instead of guessed.

### The rule that keeps this from being a second chance

- **Both analyses are printed side by side** in `TIME_REPRESENTATION_RESULTS.md` §7, permanently. The
  as-published numbers are not deleted, corrected in place, or moved to a footnote.
- **The correction is not allowed to be the interesting part.** It changed no verdict: OBSERVATION on
  both corpora, same winner, same ordering of every candidate.
- **What it did change, it changed against the result's own favour.** The study's central caution —
  that the separation is position type — went from *five of six cells collapse, one survives* to
  *eight of eight collapse, no survivor*. A correction that had gone the other way would need this
  paragraph far more, so it is stated for the case where it is uncomfortable and not only for this one.
- **A regression for each defect is now in `research/b2/controls.py`**, so the floor cannot switch
  itself off again silently.
- **No third analysis run.** If a further defect is found, it is fixed, declared here, and both prior
  answers stay printed.
