# Preregistration — does the import bridge register a hypothesis on a real account?

**Status: FROZEN.** Every rule below was written before a single position was scored, and this
document is committed before any result was seen. The corpus builder, the runner and the engine
wrapper are in the same commit; the run was launched from exactly this code and its output had not
been read when the commit was made. That is the claim, and it is the one `git log` can check --
"nothing had started" would be a stronger sentence and a false one. Anything that changes afterwards is recorded as a deviation in
`ACCOUNT_BRIDGE_RESULTS.md`, with the reason and the date, and is labelled exploratory.

**Frozen at commit:** see `git log -1 --format=%H -- docs/research/ACCOUNT_BRIDGE_PREREG.md`.

---

## 1. The question

`shared/prereg.ts` is the bridge between the two halves of this product: an import measures accuracy
over finished games and names ONE bucket, and that naming is what lets the live detector search one
bucket instead of six at `PREREGISTERED_THRESHOLDS`. The module's own header says what the naming is
worth and what it is not allowed to do.

**It has never met a live account.** Every exercise of it to date is one of two things: a synthetic
diagnostic assembled inside a test, or the frozen open-database corpus of six anonymous players
whose games were drawn from a monthly dump. Nobody has pointed it at a real Lichess account, through
the API the product itself calls, and asked the only question that matters at the end of that
pipeline:

> On a real account's real games, does `hypothesisFromImport` return `registered` — or does it
> return one of its four refusals?

That is the whole study. It is one question with five possible answers, and **four of the five are
refusals that this preregistration counts as results rather than failures.**

### What is NOT being asked

- Not whether the player is over- or under-confident anywhere. The import cannot know that and
  `shared/prereg.ts` forbids it in as many words: nobody was asked how sure they were during a game
  that was already over. The outcome available here is accuracy, and accuracy is a proxy.
- Not whether the bucket named is the RIGHT bucket. That is the live loop's to settle, on decisions
  recorded after registration, and this account has none.
- Not whether the engine is right. `ENGINE_PARITY_PREREG.md` owns that question.

## 2. Why the API path is the object of study, and not an implementation detail

`scripts/build_import_corpus.ts` says, in a comment that has governed every real-game measurement in
this repository:

> *"WHY THE OPEN DATABASE AND NOT THE LICHESS API. The games-export endpoint answers 404 through
> this environment's proxy."*

**That is no longer true.** Measured before this document was written, and recorded here because it
is the fact that makes the study possible rather than a finding of the study:
`GET /api/games/user/{username}` returned **HTTP 200 and 5,987,271 bytes** for 3,195 rated games.
The comment is stale, and the corpus builder's stated reason for avoiding the product's own source
of games no longer holds.

This matters beyond convenience. The open database and the API are **not the same PGN.** They differ
in the `[Event]` tag, and the difference lands on a field the product's bucketing depends on. See §5.

## 3. The account, and what it is not

| | |
| --- | --- |
| account | `erez281`, the repository owner's own |
| rated games | 3,195 |
| admissible under the repo's own `admissible()` | **2,209** |
| plies carrying `[%clk]` in those | 121,647 |
| dominant time control | `180+0` (1,426 games), then `300+0` (420) |

**One player, not six.** Every conclusion here is about one account, and the canonical record's
six-player corpus remains the only multi-player reading this repository has. A bridge that registers
for this player has not been shown to register for anyone else, and a bridge that refuses has not
been shown to refuse for anyone else. This is stated first because it is the limit most likely to be
forgotten when a result is quoted.

**The player is not blind to the instrument.** The account owner is the person who commissioned the
run and can read the code. That cannot bias an engine's centipawn loss over games played before the
run existed, which is why this study is still worth doing; it would seriously bias anything asking
the player to act, and nothing here does.

## 4. Selection rule, fixed before anything was scored

1. **Source.** `GET https://lichess.org/api/games/user/erez281` with `rated=true`, `clocks=true`,
   `opening=true`, `sort=dateDesc`. One request, the full history, streamed to a file.
2. **Filter.** The repository's own `admissible()`, unchanged and re-used rather than re-stated:
   `Termination` is `Normal`, the PGN carries `%clk`, at least 20 plies carry it, and White, Black
   and a game id are all present.
3. **Window.** The **48 most recent admissible games.** Forty-eight is the game count of the
   canonical record (48 games, six players, 1,587 decisions), chosen so the reading sits beside a
   number this repository already has rather than beside nothing.
4. **Nothing else.** Not filtered by time class, result, opponent, rating, or date beyond
   recency. No game is dropped after a score is seen.

## 5. One defect fixed before the run, and why fixing it is not a thumb on the scale

`speedOf` in `scripts/build_import_corpus.ts` matches `Rated <class> game|tournament|swiss` against
the `[Event]` tag. The API's arena games are tagged **`Hourly SuperBlitz Arena`**, `Eastern Blitz
Arena`, `Hourly Rapid Arena` — none of which contain the word `Rated` or any of the three nouns.

Measured over the 2,209 admissible games: **1,104 of them, exactly half the corpus, arrive with no
time class at all.**

The function's own comment already describes this failure and its consequence, for the *other*
format it was fixed for:

> *"A player whose window happened to be tournament games then arrived with NO speed at all, which
> switches the product's clock buckets from 'the dominant class' to 'every class at once' -- the
> exact averaging the restriction exists to prevent, produced by the corpus rather than by the
> product."*

The same defect reappears through the API path. It is fixed here **before** the run because a run on
the broken corpus would measure the corpus builder rather than the player, and because the fix is
determined entirely by the Lichess PGN format and not by any outcome — it was written and committed
before the first position was scored, and it cannot be tuned toward a verdict. The corpus manifest
records the resulting class distribution so a reader can check that the fix did what it claims.

## 6. What is held fixed

| | |
| --- | --- |
| engine | `stockfish-18-lite-single` — the **shipped** build, over stdio via `scripts/sf-wasm.sh` |
| options | `Threads 1`, `Hash 16`, hash cleared before every position |
| depth | 12, which is what `analyzePositions` defaults to and what an import searches at |
| bucketings | the frozen six in `shared/detector.ts`, untouched |
| separability bar | `worstBucketVerdict` at **two standard errors**, the product's default, unchanged |
| `decisions_before` | **0.** No live record exists for this account, so every future decision is a decision after registration |

Clearing the hash is the product's behaviour and therefore the harness's. The historical warm-hash
control runs beside it, as `run_import_harness.ts` explains, because a fix whose evidence has been
deleted is a fix nobody can check.

## 7. The outcome rule

`hypothesisFromImport` returns exactly one of five things. **All five are results.** The rule is
that the run reports whichever one it gets, with the numbers underneath it, and nothing is retried:

| outcome | what it means here |
| --- | --- |
| `registered` | The lowest bucket beat the runner-up by more than two standard errors of the difference, and it is a bucket the live loop can fill. The bridge works end to end on a real account. |
| `not-separable` | The buckets are closer to each other than their own sampling error. **A finding**, not a shortfall: these games cannot tell this player's buckets apart. |
| `nothing-readable` | No bucket reached the decisions needed to read it at all. |
| `only-one-readable` | One bucket is a rate, not a comparison. |
| `not-registrable` | The lowest bucket is one the live loop cannot fill — `clock-under-1m` against a board that never writes a clock. The screen would be right to refuse. |

## 8. The expansion, declared now rather than after seeing the 48

The window is 48 because 2,209 games at depth 12 is roughly 2.6 hours of engine time per pass, and a
run that cannot be repeated is not a measurement. The larger run is intended. **Declaring how it is
allowed to happen is the point of this section**, because "it did not separate, so we added games
until it did" is the failure mode that would make the whole exercise worthless.

So, before the 48-game run:

- If the outcome is **`not-separable`**, `resolutionFactor` is computed from that reading and
  **recorded in the results document before the larger run starts.** It answers "how many times this
  corpus would be needed for a gap THIS SIZE to clear its own bar", and its load-bearing assumption
  is that the rates stay where they are.
- The larger window is then **48 × that factor, rounded up, capped at 2,209** — a number the
  48-game reading produces, not a number chosen after seeing the second result.
- The larger run's outcome is compared against that prediction. If the gap closes at roughly the
  predicted size, the extrapolation held. **If the gap vanishes instead of sharpening, the 48-game
  separation was sampling noise, and that is the more informative result of the two.**
- If the outcome at 48 is anything other than `not-separable`, there is no predicted size and the
  expansion is exploratory. It is labelled so.

## 9. What is forbidden

- **No re-running for a better answer.** One pass at 48. The expansion in §8 is a separate,
  pre-declared run with its own prediction, not a retry.
- **No threshold moves.** Not the separability bar, not the bucket cuts, not `MIN_BUCKET_N`. If the
  bridge refuses, that is a fact about this account, not a licence to re-derive the product.
- **No dropping games** after a score is seen, and none excluded for producing an inconvenient
  bucket.
- **No swapping the window** to a time class, a date range, or a rating band that separates better.
- **No reading a direction** into whatever is registered. The import has no confidence data.
  `predicts_overconfidence` stays the live loop's to determine, on decisions this account has not
  recorded.

## 10. What this cannot answer

One account, one window, one engine, one depth. It cannot say whether the bridge registers for other
players, whether the bucket it names is the right place to look, or whether anything found there
would be a calibration gap rather than an accuracy difference. The live loop owns all three, and
this account has recorded no live decisions at all.
