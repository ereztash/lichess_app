# Results — does the import bridge register a hypothesis on a real account?

Preregistration: `docs/research/ACCOUNT_BRIDGE_PREREG.md`, frozen at commit `53129a7`.
Reports: `research/harness-account/prereg_report.json` (48 games) and
`research/harness-account-1240/prereg_report.json` (the expansion). Evidence: the
`decision_evidence.jsonl` beside each (gitignored; sha256 in the report).

Every sentence below is tagged with the rung it stands on: **[obs]** what the data show,
**[constr]** what a variable is claimed to measure, **[pred]** out-of-sample predictive power.
Nothing here reaches a causal or a product claim.

---

## 0. The answer

**At 48 games: `not-separable`. At the 1,240 games those 48 predicted: `registered`.** [obs]

The prediction in §5 was written down before the larger corpus was built, and it held — by 0.0133
percentage points. §7 is the full account, and the sentence that matters most there is that **the
gap did not grow. It shrank.** What crossed the bar was the bar coming down.

The 48-game reading, which everything through §6 describes:

The bridge refused at this size. The lowest-scoring bucket over this account's 48 most recent
admissible games could not be told apart from the next-lowest, so no hypothesis was registered and
the live detector got no narrowed search. This is one of the four refusals the preregistration's §7
counts as a result, and it is the refusal that carries the most information, because it comes with
numbers.

|                                             |                                                 |
| ------------------------------------------- | ----------------------------------------------- |
| lowest bucket                               | `phase-middlegame`, n = 790, **60.3%** accurate |
| next-lowest                                 | `standing-losing`, n = 258, **61.6%** accurate  |
| separation                                  | **1.37 pp**                                     |
| bar (two standard errors of the difference) | **6.98 pp**                                     |

The separation is **one fifth** of the bar. Not a near miss.

## 1. The run, and whether it is a reading at all

|                                                   |                                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| account                                           | one, `erez281`, salted id `4a30b8ff03e5e01e`                                             |
| games                                             | 48 most recent admissible, of 2,209                                                      |
| decisions scored                                  | 1,361                                                                                    |
| eligible after exclusions                         | 1,220                                                                                    |
| excluded: book 137, forced 4, wrong time class 20 |                                                                                          |
| engine                                            | `Stockfish 18 Lite WASM` — the shipped build — depth 12, `Threads 1`, `Hash 16`, cleared |
| repeats in a second process                       | **true**                                                                                 |
| independent of game order                         | **true**                                                                                 |
| wall clock, canonical run                         | 119.6 s for 2,767 positions (43 ms/position)                                             |

Runs B and C matched run A field for field, per decision. [obs] The reading is a reading: it does
not move when the engine process changes or when the games arrive in the opposite order — the
property `run_import_harness.ts` records as having once failed by 14.3 percentage points before
`StockfishClient` began sending `ucinewgame`.

## 2. The full reading

| bucket             |     n |  accurate |             |
| ------------------ | ----: | --------: | ----------- |
| `phase-endgame`    |    87 | **81.6%** |             |
| `clock-under-1m`   |   145 | **77.2%** |             |
| `standing-level`   |   495 |     62.6% |             |
| `fast-under-45s`   | 1,196 |     62.5% |             |
| `standing-winning` |   467 |     62.3% |             |
| `phase-opening`    |   343 |     62.1% |             |
| `standing-losing`  |   258 |     61.6% | ← runner-up |
| `phase-middlegame` |   790 |     60.3% | ← lowest    |
| `slow-over-2m`     |     0 |         — | too few     |

**Six of the eight readable buckets sit inside 2.3 percentage points of each other.** [obs] That is
the shape that produced the refusal, and it is worth stating as its own observation rather than as
an explanation of a null: the ordering's structure is not at the bottom, where a six-way tie sits at
60–63%. It is at the **top**, where two buckets stand 15 to 21 points clear of that pack.

`worstBucketVerdict` looks for a bucket that is worse than the rest, and finds a tie. What this
reading has instead is two buckets that are **better** than the rest. Whether that asymmetry says
something about this player, about accuracy as a proxy, or about a search shaped to look downward,
this run cannot tell — one account, one window. It is recorded here because it is the most
interesting thing in the table and it would be invisible in the verdict alone. **No threshold moves
because of it** (§9).

### The endgame number is the one to distrust first

`phase-endgame` at 81.6% over n = 87 is the largest rate in the table and rests on the smallest
sample. [obs] A 3+0 endgame is also where a decision is most likely to be forced-in-all-but-name —
one recapture, one legal king move that is not immediately losing — and `forced` only excludes
positions with exactly one legal move (4 of 1,361 here). The number is reported; it is not treated
as a finding.

## 3. What the corpus reproduced, without being asked to

`TIME_REPRESENTATION_PREREG.md` opens on a distribution measured over the canonical record: six
anonymous players, 1,587 decisions, games drawn from the February open database, scored by a native
Stockfish. This run shares none of that: **one named account, its own games, the API, the shipped
WebAssembly build.**

|                   | canonical record | this account |
| ----------------- | ---------------: | -----------: |
| median think time |              2 s |      **2 s** |
| under 5 s         |            77.8% |    **72.1%** |
| under 45 s        |            99.9% |    **99.6%** |
| over 120 s        |             0.1% |     **0.1%** |

[obs] And the consequence lands identically: `fast-under-45s` holds **1,196 of 1,220** eligible
decisions, and `slow-over-2m` holds **zero**. The preregistration's own words for the canonical
record — _"`fast-under-45s` is not a bucket, it is the record. `slow-over-2m` is empty"_ — describe
this corpus without a word changed.

This was not the question. It is an independent replication of that document's premise on a
different account, a different source and a different engine build, and it is stronger evidence for
that premise than anything in this repository so far, because nothing about the two corpora is
shared. [obs]

## 4. The `speedOf` fix, checked against ground truth rather than believed

The window is 47 blitz games and 1 rapid. The diagnostic set `timeBucketSpeed: "blitz"` and
**excluded 20 decisions for being the wrong class.** [obs] Before the fix in this branch, that rapid
game carried no class at all, half the corpus carried none either, and the clock buckets would have
averaged a 45-second move in a 3+0 game together with one in a 10+0 game — the failure
`build_import_corpus.ts` documents in its own comment.

Verified over all 2,209 admissible games against the API's own `speed` field: **2,144 agree, 0
disagree, 65 unreadable.** [obs] The 65 are custom arena titles — `Lichess Liga 12B Team Battle`,
`2024 Spring Marathon`, `טורניר שישי בשתיים Arena` — that carry no class word for any pattern to
find. **That floor cannot be fixed by a better regex**, which is the argument for
`build_account_corpus.ts` taking the class off the JSON field and running `speedOf` beside it only
as a check. `tests/research/a-time-class-read-off-a-display-name.test.ts` pins all three groups,
including the floor.

## 5. The prediction, recorded before the larger run started

Per §8, the reading's own `resolutionFactor` was computed and written down **before** any larger
corpus was built or scored:

|                   |                                               |
| ----------------- | --------------------------------------------- |
| resolution factor | **25.82**                                     |
| predicted window  | **1,240 games** (48 × 25.82, capped at 2,209) |

[pred] This is the size at which a gap **this big** would clear its own bar, and it holds only if
the rates stay where they are. It is not a prediction that the gap survives. **The informative
outcome is the one where it does not:** if 1,240 games make the separation vanish rather than
sharpen, the 1.37 pp was sampling noise, and that is a better thing to learn than a registration.

The expansion ran against exactly this number. Its result is §7 below, and it is a **test of the
line above**, not a second attempt at a registration. It came back `registered`, and §7 is careful
about which half of that sentence the prediction actually earned.

## 6. One defect found, not acted on, and why

Of the 2,209 admissible games, **48 are not standard chess**: 47 `fromPosition` and 1 `atomic`.
[obs] The repository's `admissible()` rule filters on termination, clocks and ply count, and does
not look at the variant. An `atomic` game scored by a standard Stockfish is a meaningless number,
and a `fromPosition` game starts outside the opening book and outside whatever the phase model
assumes.

**The 48-game window contains none of them** — all 48 are Standard — so nothing in §0 through §5 is
affected. The 1,240-game window contains **20 `fromPosition` games, 1.6% of it.**

The filter was **not** added. §9 forbids changing the selection rule after a score has been seen,
and the reason for the rule is exactly this situation: a filter that is obviously correct is still a
filter chosen after a result. The contamination is measured and reported in §7 instead, and a
variant filter is the right thing to **preregister for the next study**, before it has an outcome to
be chosen against.

## 7. The expansion

**Outcome: `registered`.** [obs] `phase-middlegame`, the same bucket the 48 games put last.

|                  |                         48 games |                             1,240 games |
| ---------------- | -------------------------------: | --------------------------------------: |
| decisions scored |                            1,361 |                              **33,213** |
| eligible         |                            1,220 |                              **29,465** |
| lowest bucket    | `phase-middlegame` 60.25%, n=790 | `phase-middlegame` **60.24%**, n=19,577 |
| runner-up        |   `standing-losing` 61.6%, n=258 |   `standing-level` **61.40%**, n=11,537 |
| separation       |                         1.375 pp |                            **1.158 pp** |
| bar              |                         6.985 pp |                            **1.145 pp** |
| separable        |                               no |                   **yes, by 0.0133 pp** |

Run B in a second engine process and run C with the games reversed again matched run A field for
field, per decision — this time over 67,605 positions per pass, 47.7 minutes each. [obs]

### The prediction held, and what held is narrower than "the gap got clearer"

`resolutionFactor` said 25.82, so the window said 1,240, and at 1,240 the separation cleared the bar
by **1.2% of the bar's own size.** That is a precise landing, and it is precise for a reason that is
worth stating rather than admiring: the factor is _defined_ as the point where separation equals
threshold **if the rates stay where they are**, and the rates stayed. `phase-middlegame` moved from
60.25% to **60.24%** across a 24-fold increase in sample. [obs] The assumption the prediction rested
on was the thing under test, and it survived.

**But the gap itself got smaller, not larger:** 1.375 pp → 1.158 pp. The threshold fell from 6.985
to 1.145, as 1/sqrt(n) says it must. **The registration is an error-bar effect end to end.** [obs]
Nothing about this player's middlegame became more distinct; the measurement of it became less
uncertain, and the difference that was always there stopped being indistinguishable from noise.

That is the correct behaviour of a separability bar, and it is also the reason the next sentence
matters.

### What was registered is 1.16 percentage points

`phase-middlegame` at 60.2% against `standing-level` at 61.4%. Statistically separable at n ≈ 20,000
and **substantively very small** — a difference no player would feel and no screen should dramatise.
[obs] The bar was not moved and is not being argued with (§9); what is being recorded is what
clearing it at this sample size actually means.

**This does not make the registration worthless, and the reason is in `shared/prereg.ts` itself:**
the import names _where to look_, not what will be found there. What the registration buys is that
the live detector may search one bucket at `PREREGISTERED_THRESHOLDS` instead of six — measured
median first claim 65 decisions → 45. Whether `phase-middlegame` is the _right_ place to look is a
question only live decisions carrying a stated confidence can answer, and this account has recorded
none. The 1.16 points are the reason the bucket was named. They are not the finding. [constr]

### The runner-up changed identity, which the 48 games could not have told you

At 48 games the second-lowest was `standing-losing` (61.6%, n=258). At 1,240 it is `standing-level`
(61.40%, n=11,537), and `standing-losing` has risen to **63.15%.** [obs] The bucket the small reading
was _nearly_ separable from was not the bucket it is actually separable from. A near miss at n=258
identified the wrong comparison.

### The full reading at 1,240

| bucket             |      n | accurate |      SE |
| ------------------ | -----: | -------: | ------: |
| `phase-endgame`    |  1,251 |   81.06% |    1.11 |
| `clock-under-1m`   |  2,315 |   69.72% |    0.95 |
| `phase-opening`    |  8,637 |   64.64% |    0.51 |
| `standing-losing`  |  7,693 |   63.15% |    0.55 |
| `standing-winning` | 10,235 |   63.01% |    0.48 |
| `fast-under-45s`   | 26,580 |   62.58% |    0.30 |
| `standing-level`   | 11,537 |   61.40% |    0.45 |
| `phase-middlegame` | 19,577 |   60.24% |    0.35 |
| `slow-over-2m`     |  **2** |        — | too few |

Three things carried over from §2 and one did not.

**The endgame number survived its own caveat.** §2 flagged 81.6% over n=87 as the first number to
distrust. At n=1,251 it reads **81.06%.** [obs] Fourteen times the sample, half a point of movement.
Whatever produces it is not sampling noise.

**The top-heavy shape survived.** The lowest six buckets span 4.4 points; `phase-endgame` sits **20.8
points** above the bucket the bridge registered. [obs] The bridge searches downward and registered a
1.16-point difference at the bottom while a 20-point difference sat at the top of the same table. No
threshold moves because of that (§9), and it is recorded here for the third time because it is the
largest structure in this account's data and the instrument is not built to see it.

**`slow-over-2m` still cannot be read** — **two decisions in 1,240 games.** [obs] Not a bucket that
needs more games. A bucket this player's time controls cannot fill.

**`clock-under-1m` did not survive.** 77.2% at n=145, **69.72%** at n=2,315: a 7.5-point fall. [obs]
The 48-game figure was the second-largest in that table and it was inflated by a small sample. Named
because §2 printed it without flagging it, and the endgame figure got the caveat instead.

### The `fromPosition` contamination, measured rather than filtered (§6)

The 20 non-standard games in this window contributed **463 eligible decisions, 1.57%** of 29,465,
scoring 64.6% against 62.4% for the standard-only remainder. All 463 fall in `opening` (140) and
`middlegame` (323) — so they land on the registered bucket, which is the case that had to be
checked. [obs]

Dropping them — **as a sensitivity check reported beside the result, not as a change to the selection
rule**:

|                     |    separation |       bar | separable |
| ------------------- | ------------: | --------: | --------- |
| as preregistered    |     1.1583 pp | 1.1450 pp | yes       |
| standard games only | **1.1708 pp** | 1.1536 pp | **yes**   |

The registration does not depend on them, and it is marginally stronger without them. [obs] The
filter still belongs in the _next_ preregistration rather than this one, for the reason §6 gives.

### The think-time gradient, at 24 times the sample

§3 reported a 25.6-point monotone drop hidden inside `fast-under-45s`, with the last two bands
resting on n=32 and n=4. Every band now has n ≥ 99:

| think time |      n |  accurate |
| ---------- | -----: | --------: |
| 0–1 s      |  7,840 | **71.7%** |
| 2–3 s      | 10,777 |     64.7% |
| 4–7 s      |  6,904 |     56.0% |
| 8–15 s     |  2,961 |     50.0% |
| 16–45 s    |    884 |     46.9% |
| 46 s+      |     99 | **40.4%** |

**31.3 points, monotone across all six bands, entirely inside the one bucket the product reads as a
flat 62.58%.** [obs] `fast-under-45s` holds 26,580 of 29,465 eligible decisions.

This remains **not a causal claim** and the reason has not changed: hard positions take longer _and_
are played worse, which is §2.2 of `TIME_REPRESENTATION_PREREG.md`. What the sample size buys is
that the _shape_ is no longer in question. [obs]

## 8. What this does not establish

One account, two windows, one engine, one depth. The bridge refused at 48 and registered at 1,240 —
**for this account**; nothing above shows it would do either for another player. The
window that registered was **1,240 games**, which is not a number a person importing an account will
have; the smaller reading this product can actually expect is the one in §0 through §6, and it
refused. No calibration
gap was measured, because an import cannot measure one — nobody was asked how sure they were during
a game that was already over — so every rate above is **accuracy, a proxy** for the quantity the
product actually reports. This account has recorded zero live decisions, which is why
`decisions_before` is 0 and why the pipeline stopped at `measured`.
