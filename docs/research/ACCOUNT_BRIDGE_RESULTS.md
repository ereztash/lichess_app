# Results — does the import bridge register a hypothesis on a real account?

Preregistration: `docs/research/ACCOUNT_BRIDGE_PREREG.md`, frozen at commit `53129a7`.
Report: `research/harness-account/prereg_report.json`. Evidence:
`research/harness-account/decision_evidence.jsonl` (gitignored; sha256 in the report).

Every sentence below is tagged with the rung it stands on: **[obs]** what the data show,
**[constr]** what a variable is claimed to measure, **[pred]** out-of-sample predictive power.
Nothing here reaches a causal or a product claim.

---

## 0. The answer

**`not-separable`.** [obs]

The bridge refused. The lowest-scoring bucket over this account's 48 most recent admissible games
could not be told apart from the next-lowest, so no hypothesis was registered and the live detector
gets no narrowed search. This is one of the four refusals §7 counts as a result, and it is the
refusal that carries the most information, because it comes with numbers.

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

The expansion run is under way against exactly this number. Its result is §7 of this document, and
it is a **test of the line above**, not a second attempt at a registration.

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

Pending. Written up here on the same terms when the run completes, against the 1,240 predicted in
§5.

## 8. What this does not establish

One account, one window, one engine, one depth. The bridge refused **here**; nothing above shows it
would refuse for another player, and nothing shows it would register for one either. No calibration
gap was measured, because an import cannot measure one — nobody was asked how sure they were during
a game that was already over — so every rate above is **accuracy, a proxy** for the quantity the
product actually reports. This account has recorded zero live decisions, which is why
`decisions_before` is 0 and why the pipeline stopped at `measured`.
