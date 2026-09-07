# Readiness — can a foreign username be handed to this pipeline now?

The eight deliverables the generalisation was asked for, answered.

---

## 1. Complexity audit — what was hard-coded, what was generalised

Full table in `HARDCODE_AUDIT.md`. The shape of it:

**Infrastructure hard-code, generalised (13 sites).** One question — *which side am I studying?* —
was answered by the literal `erez281` in four places: a colour test in the scorer
(`"w" if white.user.id == "erez281" else "b"`, which silently made every other player Black), a
default corpus label, the population leakage filter (`corpus != "erez281"`), and the session chain's
`prev_game_result`. Plus a default `load_decisions(corpus="erez281")` that quietly studied erez281
whenever a caller forgot the argument, absolute scratchpad paths in eight shell drivers and four
Python files, and report keys named after a person. All now flow from one `FocalPlayer`.

**Research-semantic rules, parameterised but not re-valued (12 sites).** The design constants, the
vocabulary, the baseline, the eligibility rule, the judge, the split, the targets and the claim
ladder are untouched. Exactly one of them was genuinely erez281-shaped: the **population band
1450–1850**, which is his band written as a constant. It is now
`round(median blitz rating / 50) * 50 ± 200`, which returns `(1450, 1850)` for his median of 1654 —
the baseline's band, derived rather than typed.

**`AMBIGUOUS_BASELINE`, declared (6 questions).** Minimum corpus size, no-blitz players, which
rating defines the band, berserk asymmetry, duplicate games, and the window when a player has more
games than erez281. Each is resolved by the weakest rule the *already-frozen* design implies, never
by looking at a new player's data. The minimum-corpus numbers, for instance, are not evidence
thresholds: they are the points below which `min_size`, `min_n_validate` and `within_game_contrast`
are undefined.

## 2. Generic input contract

```
platform + username
```

```bash
npm run replicate:player -- --platform lichess --username SOMEUSER
```

Nothing else is asked. Rating, colour, game ids, dates, the split and the feature family are all
derived. The optional flags are operational (`--workers`, `--engine`, `--run-id`, `--root`,
`--ids-file`, `--window`, `--stop-after`), and `--window` must be declared before the fetch because
a window chosen after a reading is a window chosen for its reading.

`LICHESS_API_TOKEN` and `SF_BIN` are environment configuration, not per-player input.

## 3. Frozen replication protocol

`PROTOCOL.md`, machine-readable in `contract.py`. Sixteen sections: input contract, ingestion,
eligibility, corpus freeze, pre-registration, engine regime, splits, minimum corpus, population
baseline, the frozen chain, output classes, failure behaviour, claim ladder, reversal, governance,
the gate. `REPLICATION_PREREG.json` is written and self-hashed **before scoring** — before the first
outcome-bearing stage — and is never rewritten.

## 4. Erez equivalence result

```
EQUIVALENT
```

`GATE-GENERIC-PIPELINE-EQUIVALENCE` — **GREEN**, 114 artifacts compared, 0 failing. Full table in
`EQUIVALENCE_REPORT.md`. The load-bearing rows:

| | old | generic |
| --- | --- | --- |
| eligible decisions / games | 52,881 / 2,161 | 52,881 / 2,161 |
| DERIVE / VALIDATE / TEST | 31,851 / 10,626 / 10,404 | identical, same game ids |
| feature table | 59,419 × 155 | **bitwise identical, every column** |
| R\* | `material_balance>=-2 AND own_overloaded_piece_count>=1`, n_in 2,937, 25.67%/13.84%, wg +11.53 pp, z 11.24 | identical |
| R\* stability, bootstrap winners | 17/30, winner table | identical |
| population band | 1450–1850 | derived 1450–1850 |
| population model holdout AUC | 0.7646499173025916 | identical to the last digit |
| R\*\* | `material_balance:[0:3[ AND own_overloaded_piece_count>=1`, n_in 1,199, +13.46 pp, residual z 4.5202 | identical |
| final evidence state | `PERSONAL_RESIDUAL_CANDIDATE` | identical |

**The only non-zero difference anywhere** is three `resid_wg_z` values of the R\* run agreeing to
~5e-12 relative (8.55646910972384 vs 8.556469109680593), which is the LBFGS solve inside the
difficulty baseline. The tolerance (1e-9 relative for floats, exact for everything else) was
declared in the gate's source before the comparison was run.

**The gate has been shown red.** Four positive controls re-inject one removed hard-code each; every
one turns it red, and each is caught by a named row:

| control | what it broke |
| --- | --- |
| `focal_color_is_erez281` | the focal side of a non-erez281 white player came back `'b'` instead of `'w'` |
| `load_decisions_default_erez281` | a non-erez281 corpus loaded 0 rows instead of 38,580, and a two-corpus file was silently reduced to one |
| `population_excludes_only_erez281` | 200 focal rows stayed inside the population frame the baseline is fit on |
| `population_band_is_1450_1850` | a 2,010-rated player got erez281's band instead of 1800–2200 |

The gate also proves the machinery in the other direction: every one of the four output classes is
reachable, each by its own cause (`failure_modes`, 9 artifacts), and the eligibility transcription
rejects each of the baseline's own rejection reasons with the baseline's own precedence
(`eligibility_rule`, 10 artifacts).

## 5. One-command runner

```bash
npm run replicate:player -- --platform lichess --username SOMEUSER
npm run replicate:gate            # must be GREEN before any new player
npm run replicate:gate:controls   # each control must turn it RED
```

`.github/workflows/mechanism-generic-pipeline-equivalence.yml` re-runs both on every pull request
that touches `analysis/`, `pipeline/` or `replication/`, rebuilding the generic outputs from the
committed frozen scored corpus rather than trusting a file on disk.

## 6. First-new-player readiness

**Yes, for a lichess account whose blitz median rating is 1450–1850, given a game-id source.**

What has actually been run, not just written:

- the front half end-to-end on a player who is not erez281 (account verified, 6 games fetched, 3
  excluded as `termination:Time forfeit` by the frozen rule, 3 scored under the research engine,
  features extracted with the focal side resolved per game, schema gate passed, splits computed,
  `INSUFFICIENT_CORPUS` returned with what was missing and what was needed — no stack trace, no
  lowered threshold);
- the whole chain on erez281 through the generic entrypoint, reproducing the baseline;
- the ingest + eligibility layer against a live re-fetch of the frozen 2,209 game ids: **2,209
  admissible → 2,161 scorable, and the 48 exclusions are exactly the 47 `fromPosition` + 1 `atomic`
  the ledger records**, with the same 2,161 game ids as the frozen corpus.

Cost, measured rather than guessed: **~30 engine positions/second on 4 cores**, so a 2,000-game
corpus is **~1.2 hours** of scoring, then ~1.5 min of feature extraction and ~15 min of search.

## 7. Remaining blockers — only real ones

1. **Game enumeration needs `LICHESS_API_TOKEN`.** `GET /api/games/user/<name>` answers 404 to an
   unauthenticated request for every account — the mission ledger recorded the same thing a year
   ago. Without a token, a run must be given an id list (`--ids-file`), which the `_ids` endpoint
   then fetches without authentication. This is environment configuration, not a research gap, and
   the runner fails with `FETCH_FAILED` naming the remedy rather than half-fetching.
2. **The population registry holds one band.** `population_2026-06` covers 1450–1850 blitz. A player
   outside it gets `POPULATION_BASELINE_INSUFFICIENT` and **no personal finding** — the correct
   answer, not a bug. `build_population.py` builds a new band's corpus; its filter is verified (all
   600 frozen games satisfy it, drawn from the same 80 MB prefix), but its **sampler is an
   `AMBIGUOUS_BASELINE`**: the ledger records only "hash-sampled with seed string `20260905:<gameId>`",
   and ordering by `sha256("20260905:<gameId>")` recovers 143 of the frozen 600 — far above the ~18
   expected by chance, so the hash and seed are right and the selection procedure around them is
   not recoverable. A corpus built for a new band is therefore a **new registered asset** with its
   own id; it never claims to be `population_2026-06`, and registering it is a dated human decision.
3. **Non-blitz players are out of scope**, because the population corpus is blitz-only. Building a
   rapid or bullet population would be a new research decision, not a configuration change.

Not blockers: the engine (Stockfish 17.1 avx2 is the published build and reproduces the regime),
compute (~1.2 h/player on 4 cores), or the analysis layer (proven equivalent).

## 8. Research claim — what can be said now, and what cannot

**Can be said.** The capability demonstrated on `erez281` is a property of the *harness*, not of
one hand-fitted configuration. The same frozen code, given a player as a parameter, reproduces the
original result on that player bit-for-bit, and it runs on a player it has never seen without a
single threshold moving. Every rule that decides what counts as evidence — eligibility, splits,
vocabulary, judge, population contract, stopping rules, output classes — is written down and hashed
before a run starts, and the machinery for saying **`NO PERSONAL RESIDUAL SUPPORTED`** is built,
tested and reachable.

**Cannot be said.** Nothing about whether the *method* generalises. One player has been run through
it, and that player is the one it was built on. Until a genuinely new player goes through, the
distribution of outcomes across players is unknown, and so is the answer to the question this was
all for:

> did Decision Lab find a personal mechanism in one case, or is there a system that knows how to
> look for one in general?

Equivalence answers the first half of that — the *looking* is now general and provably unchanged.
The second half needs Player B, then Player C. Nothing in this work licenses a claim about them,
and, per the governance rule, nothing learned from their runs may be folded back into the pipeline
and still be called a replication of it.

Also unchanged, and unchangeable by this pipeline under any result: CAUSALITY, INTERVENTION and
OUTCOME. A `PERSONAL_RESIDUAL_CANDIDATE` is a candidate.
