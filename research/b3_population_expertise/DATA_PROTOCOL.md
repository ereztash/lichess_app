# B3 -- Data protocol

Frozen with `PREREGISTRATION.md`. Every number this file produces is written to
`results/corpus_manifest.json` as a count, including every exclusion.

---

## 1. Source

The public Lichess game database, `https://database.lichess.org/standard/`, monthly PGN dumps of
**rated Standard games only** (the file name asserts it; `WhiteRatingDiff`/`BlackRatingDiff`
presence confirms it per game, which is the structural test B2 adopted after its `Event`-string
rule mislabelled a third of its corpus).

Each monthly file is a single `zstd` stream of tens of gigabytes. It is read as an **HTTP prefix**
(`Range: bytes=0-N`) and decompressed as a stream; nothing is stored on disk except the sampled
records. The dumps are ordered by game start time, so a prefix is a contiguous window from the
start of the month.

**Ingest rule (frozen):** read from byte 0 and stop at the first game whose `UTCDate` is **not**
day 01 of that month. The period is therefore *every rated Standard game that started on the first
UTC day of the month*, which is a complete diurnal cycle and is constructed identically for every
period. The byte prefix actually consumed is recorded, not chosen.

| Period | File | Window |
|---|---|---|
| DEVELOPMENT | `lichess_db_standard_rated_2026-02.pgn.zst` | `UTCDate == 2026.02.01` |
| VALIDATION | `lichess_db_standard_rated_2026-04.pgn.zst` | `UTCDate == 2026.04.01` |
| FINAL | `lichess_db_standard_rated_2026-06.pgn.zst` | `UTCDate == 2026.06.01` |

The sha256 of the consumed prefix and its byte length are recorded per period.

---

## 2. Game-level inclusion

A game qualifies when **all** hold. Each failure is counted under its own name.

| Test | Rule |
|---|---|
| rated | `WhiteRatingDiff` or `BlackRatingDiff` present |
| variant | no `Variant` header, or `Variant == "Standard"` |
| time control | `TimeControl` header equals the period's target exactly (`180+0` primary, `300+0` secondary) |
| clocks | `%clk` present on every ply of the movetext |
| not berserk | the **first** clock reading on both sides equals the base seconds exactly (a berserked arena game starts at half the clock and is a different time control wearing the same header) |
| ratings present | `WhiteElo` and `BlackElo` both parse as integers in `[600, 3000]` |
| not a bot | neither `WhiteTitle` nor `BlackTitle` is `BOT` |
| terminated normally | `Termination` in `{Normal, Time forfeit}`; `Abandoned`, `Rules infraction` and `Unterminated` are excluded |
| long enough | at least 20 plies of movetext |
| parses | every SAN move is legal from the start position |

`Time forfeit` is **kept**. It is the ordinary way a blitz game ends and removing it would delete
exactly the decisions where time pressure mattered most.

---

## 3. Side-level (analysed player) inclusion

A qualifying game contributes up to two **sides**. A side qualifies when its rating at game time is
in `[800, 2600)`.

## 4. Sampling -- player-balanced, order-independent

The design goal is *hundreds of independent players per rating band*, not millions of moves from a
few accounts.

1. **Acceptance is a deterministic hash, not arrival order.** A side is a candidate iff
   `blake2b(SEED || game_id || side) mod 10**6 < q_b * 10**6`, where `b` is the rating band of that
   side and `q_b` is the band's frozen acceptance rate. This makes the draw a uniform random sample
   of sides that does not depend on where in the stream a game appeared, and it is reproducible
   from the seed alone.
2. `q_b` is set **once**, by the cost pilot, so that each band reaches its decision target or takes
   everything available, whichever binds first. Scarce bands get `q_b = 1.0`. The rates are frozen
   before any period is scored and are identical across periods.
3. **At most ONE analysed side per game** (Gate 1, R6). When both sides of a game clear the hash,
   the side with the smaller `unit_hash(SEED, game_id, side)` is taken and the other is counted.
   Accepting both looks like two observations and is not: they are alternate plies of one position
   sequence, their clocks are coupled, and each is the other's `clock_ms_opp` and `rating_diff`.
   The dependence graph would then be a player-**game** graph rather than the tree
   `move ⊂ game ⊂ player` that the player bootstrap assumes, so every band-level interval would be
   too narrow -- worst in the thinnest bands, which is exactly where the strongest verdict is
   decided.
4. **Cap: at most 2 accepted sides per player per period**, applied by reservoir sampling over the
   player's accepted candidates, so the cap is order-independent too.
5. **Cap: at most 60 eligible decisions per side**, applied by taking every eligible decision when
   a side has 60 or fewer and otherwise an evenly spaced subsample by ply. A single very long game
   cannot dominate a player.

6. **Account status** (Gate 1, R10). After sampling and **before any engine work is spent**, one
   batch lookup of the sampled usernames' public account status (`POST /api/users`, 300 ids per
   call). A side whose account is `disabled` or `tosViolation` at the lookup date is excluded and
   counted per band. The lookup date is recorded in the manifest. The rule is identical for every
   period, reads no game content, and for FINAL runs after Gate 2 as part of the mechanical ingest.

   Why it is here and not in the honest-limitations list: time that tracks engine-measured
   difficulty, paired with low quality loss, is close to what assistance detection looks for, and it
   is precisely what Metric B rewards. Assisted accounts concentrate in the upper bands of a fast
   time control, and verdict condition 5 is a contrast between the top and bottom adequately powered
   bands, so a few percent of assisted sides in the top band would inflate `TAE(highest)` directly.
   Titled bots are excluded by header; accounts later closed for engine use are not marked in the
   dumps at all.

   It is a **snapshot**, and the limitation runs both ways: an account closed after the lookup date
   is still in the corpus, and an account closed for a reason unrelated to engine use is removed. A
   username the endpoint does not return counts as *not* excluded, and the number of such accounts
   is reported -- inventing a closure for an account we know nothing about would thin the sample in
   whichever band the endpoint happened to miss.

### Two consequences of these rules, disclosed rather than corrected for

**One side per game skews `rating_diff` composition by band.** Under the rule as coded, a side that
clears the hash is displaced with probability roughly `q_opponent / 2`, so a band with a high
acceptance rate is enriched for sides facing opponents in low-rate or out-of-range bands, and a
low-rate band for the mirror case. `rating_diff` is adjusted linearly and by spline through T1P, so
the first-order effect is removed; residual heterogeneity of the allocation slope in `rating_diff`
would not be. Reported, not corrected.

**The account-status lookup has a lag that differs by period.** DEVELOPMENT games were played in
February and FINAL games in June, but the lookups happen within days of each other, so Lichess has
had four months longer to close a DEVELOPMENT account than a FINAL one. **FINAL's top band is the
least cleaned of the three.** The lookup date is recorded per period, the per-band exclusion rate is
reported per period, and the primary Metric B condition is **always** additionally reported with the
top adequately powered band dropped. Fixed at Gate 2: the first wording made that conditional on the
rate differing "materially" between periods, which is a judgement call sitting inside a rule, made
after the rates are visible. It is now unconditional. It is a reporting rule, not a threshold, and
it changes no verdict.
This is the direction that matters: the exclusion removes accounts whose time tracks engine
difficulty with low loss, which is what Metric B rewards, so under-cleaning FINAL's top band works
**in favour** of the hypothesis.

`SEED = 20260901`. Fixed, never tuned.

Player identity is the lowercased Lichess username, stored as `blake2b(username, 8 bytes)`. The
plaintext username is never written to any committed artifact.

---

## 5. Decision eligibility

Within an accepted side, ply `i` (0-based, `i` even = White to move) is an eligible **decision**
when all hold:

| Test | Rule |
|---|---|
| it is the player's move | side to move matches the analysed side |
| a think time exists | the side has a clock reading at ply `i-2`; the first move of each side has none |
| think time is possible | `0 <= T <= base_seconds`, `T = clk[i-2] - clk[i] + increment` |
| there was a choice | more than one legal move (forced moves are excluded, as in B2) |
| not the last ply | a decision needs a resulting position to score |
| board is legal | the pre-move position loads |

**Book positions are kept in the primary analysis** and removed in C11, per the mission plan's
control list. The book is the repository's frozen 833-position set
(`shared/opening-book-keys.ts`, built from 2026-03, disjoint from every B3 period), matched on the
four position-determining FEN fields.

Think time granularity is **whole seconds** -- that is what the Lichess dumps carry, and the same
granularity B2's API export carried. `T = 0` therefore means "under one second", and it is a large
share of blitz decisions. C17 repeats the whole analysis without them.

---

## 6. What is recorded per decision

Written to `data/<period>/decisions.jsonl.zst`, one JSON object per decision, sorted by
`(player_hash, game_id, ply)` so the file is byte-reproducible from the seed.

Identity and design: `player_hash`, `game_id`, `ply`, `period`, `side`, `rating`, `rating_band`,
`opponent_rating`, `is_book`.
Clock: `clock_ms_self`, `clock_ms_opp`, `seconds_taken`.
Pre-move features: everything in `FEATURE_SCHEMA.md` §3-§5, each tagged `PRE_MOVE`.
Outcome: `quality_loss`, `accurate`, tagged `POST_MOVE`.

No raw PGN and no username is committed. The manifest carries what is needed to rebuild the file
from the public source: URL, prefix bytes, prefix sha256, seed, acceptance rates, caps, engine
identity and options.
