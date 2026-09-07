# Hard-code audit — `research/mechanism/`

**Phase 2 of the generalisation.** Every assumption the mechanism package encoded about `erez281`,
classified before anything was changed, into two kinds:

- **Infrastructure hard-code** — a path, a column name, a corpus label, a colour test, report copy.
  Generalising it changes nothing a research claim rests on. These were generalised.
- **Research-semantic rule** — a threshold, a split, a vocabulary, a judge, a population contract.
  Changing one is a new design version and needs an explicit research decision. These were
  **parameterised, never re-valued**: the parameter's value for `erez281` is exactly what the
  baseline used, and the gate proves it.

A third label appears where the baseline never wrote a rule down:

- **`AMBIGUOUS_BASELINE`** — the original had no need to state it (it had one player, 2,209 games,
  and one rating band). Resolved here only by the weakest rule the *already-frozen* design implies,
  and never by looking at a new player's data.

Search terms swept: `erez281`, `erez`, `owner`, `owner_color`, `erez_color`, `frozen_2209`,
`post_freeze`, `personal corpus`, `owner corpus`, plus absolute paths, file names, corpus labels,
rating bands, date windows, colour detection, game-count assumptions, output directories, report
copy, manifest naming, population exclusion and holdout logic.

---

## A. Infrastructure hard-code — generalised

| Location | Current assumption | Research-semantic? | Infrastructure-only? | Generalisation |
| --- | --- | --- | --- | --- |
| `pipeline/score_games.py:144` | `"erez_color": "w" if players.white.user.id == "erez281" else "b"` — the focal side is decided by a string literal, and every non-erez281 game silently becomes Black | no | yes | `resolve_focal(game, focal_player_id)` writes `focal_color`; precedence is explicit `focal_colors` > the focal player's account id > the record's own `focal_player_id`, and a game where the focal player is on neither side is an error, not a default |
| `pipeline/score_games.py:145` | `"corpus": g.get("corpus", "erez281")` — an unlabelled corpus becomes the owner's | no | yes | `--corpus` argument; a record with no label and no argument is refused |
| `pipeline/score_games.py:18` | `SF` defaults to an absolute scratchpad path on one machine | no | yes | `SF_BIN` env var, default `stockfish` on `PATH` |
| `pipeline/score_games.py:73` | shipped-engine wrapper at the absolute path `/home/user/lichess_app/scripts/sf-wasm.sh` | no | yes | resolved relative to the repository root |
| `pipeline/features.py:45` | `BOOK_KEYS_PATH` absolute | no | yes | repo-relative, `BOOK_KEYS_PATH` env override |
| `pipeline/features.py:46` | `PLAYER = "erez281"` (dead constant) | no | yes | removed |
| `pipeline/features.py:280-281,341,499` | `rec["erez_color"]` read four times as "the side I am studying" | no | yes | `focal_color_of(rec)`, which still accepts the legacy `erez_color` key so the frozen scored artifact keeps loading |
| `pipeline/features.py:531` | `build_sessions` computes `prev_game_result` from `erez_color`, i.e. from the erez281 colour test | no | yes | sessions are carried per **session owner** (the account playing that side), keyed `(game_id, focal_color)`. Identical on any one-owner corpus; on a two-sided population corpus the old code silently used Black for every game, and those columns are excluded from the population model anyway (`search.population_feature_columns`) |
| `pipeline/features.py:550,552` | `r.get("focal_colors") or [r["erez_color"]]`, `row["corpus"] = r.get("corpus", "erez281")` | no | yes | `focal_colors_of(rec)`; corpus label from the record or `CORPUS_LABEL`/argv, never defaulted to a person |
| `analysis/common.py:30` | `load_decisions(path, corpus="erez281")` — every caller that forgot the argument silently studied erez281 | no | yes | default `AUTO_CORPUS`: the file's single corpus, or an error if the file holds more than one. Same rows as before on the frozen table |
| `analysis/run_discovery.py:94`, `analysis/population.py:40`, `analysis/plant.py:107` | `pop[pop["corpus"] != "erez281"]` — the leakage guard is a string literal | **partly** (the *rule* "the focal player is not in their own baseline" is semantic; the *literal* is not) | the literal is | `focal.exclude_focal(pop, focal_corpus, focal_keys)` — guards on the corpus label **and** the player key, because a focal player can legitimately sit inside a same-band population corpus under a different label. `leakage_report` records what it removed |
| `analysis/population.py` output keys | `"erez281"`, `erez_elev`, `erez_percentile`, `erez_raw_elev`, `erez_raw_percentile` | no | yes | `focal`, `focal_elev`, `focal_percentile`, `focal_raw_elev`, `focal_raw_percentile` |
| `analysis/test_leakage.py:14,36` | absolute `sys.path` into a scratchpad; `rec["erez_color"]` | no | yes | repo-relative path; `F.focal_color_of(rec)` |
| `analysis/*.py` CLI defaults | `decisions.parquet`, `decisions_v2.parquet`, `decisions_pop.parquet`, `results/…` relative to one scratchpad | no | yes | every one is a run-directory path supplied by `replication/run.py`; defaults kept so the historical commands still work |
| `pipeline/*.sh` (`driver.sh`, `driver2.sh`, `classes.sh`, `pop_runs.sh`, `diagnostics.sh`, `after_scoring.sh`, `queue_*.sh`, `kill_waiters.sh`, `killpat.sh`) | every one `cd`s to `/tmp/claude-0/-home-user/ee69b.../scratchpad` and hard-codes `frozen_2209.ndjson`, `decisions_v2.parquet`, `account/`, `population/` | no | yes | superseded by `replication/run.py`, which runs the same programs with the same arguments against a run directory. The shell drivers are left in place as the historical record of what was executed (Phase 20: do not touch frozen history) |
| `pipeline/reeval_deep.py:17`, `pipeline/threat.py:24`, `pipeline/rescore_wasm.py:16` | absolute engine / repo paths | no | yes | left as-is: these are Node-G side controls that ran once on the erez281 corpus and are not on the replication path. Recorded here so the audit is complete |
| `analysis/rstarstar_provenance.py`, `..._blitz.py`, `..._persistent_followup.py` | `--owner` argument names, `!= "erez281"` | no | yes | **deliberately not generalised.** These are the post-hoc localisation of the frozen R\*\* finding (`RSTARSTAR_MECHANISM_LOCALIZATION.md`). Phase 20 forbids touching R\*/R\*\* history; they are historical analyses of one finding, not stages of the pipeline |

---

## B. Research-semantic rules — parameterised, not re-valued

| Location | Rule | Was it erez281-specific? | Generalisation | Value for erez281 after the change |
| --- | --- | --- | --- | --- |
| `analysis/vocab.py DESIGN` | seed 20260905, derive 0.60 / validate 0.20, k = 3.5, `min_n_validate` 100, `min_size` 300, `max_size` 12,000, `n_freeze` 3 | no — design constants | untouched | identical |
| `analysis/vocab.py VOCAB_OBS/ENG/TIME/HIST` | the feature vocabulary and every cut point | no | untouched; a schema gate asserts an arbitrary player's feature table is structurally identical to the baseline's | identical |
| `analysis/vocab.py BASELINE_COLS/CAT` | the difficulty/time/context/ease baseline | no | untouched | identical |
| `analysis/common.py eligible()` | not forced, not book, seconds and clock present | no — the product's rule | untouched, restated in `contract.DECISION_ELIGIBILITY` | identical |
| `scripts/build_import_corpus.ts admissible()` | Termination Normal, `%clk` present, ≥ 20 clocked plies | no — the product's rule | transcribed into `replication/eligibility.py` **with the baseline's own reason precedence**, so the exclusion tally is reproducible | 2,209 admissible → 2,161 scorable, exactly the frozen window |
| scorer's `variant != "standard"` skip | non-standard variants are not scored | no | kept, and counted separately as `non-standard-variant` instead of vanishing | 48 (47 `fromPosition`, 1 `atomic`) |
| ledger §Environment | population band **1450–1850** | **yes** — that is erez281's band, written as a constant | `contract.population_band(median_blitz_rating)` = round-to-50 ± 200. Peers are never chosen to maximise a residual: the band is fixed by the player's own rating before any search result is read | erez281 blitz median 1654 → **(1450, 1850)**, the baseline's band exactly |
| ledger §Environment | population = 600 games of 2026-06, 180+0 and 300+0, both sides in band, one game per player, Normal, clocks, no berserk, ≥ 20 plies, hash seed `20260905:<gameId>` | no — a population construction rule | recorded in `contract.POPULATION_CONTRACT` and in `registry/populations.json`. A player whose band has no registered corpus returns `POPULATION_BASELINE_INSUFFICIENT` — never a weaker comparison, never a personal finding | unchanged |
| design v1.8 | population model = HistGradientBoosting, blitz-only frame | no | untouched | identical |
| ledger §Final-candidate rule (15:50 UTC) | the final candidate is the passing candidate of the **union** class `cls_tactical` with the highest DERIVE quality; sub-classes are refinements | no | `contract.BROAD_TARGET` | identical |
| design v1.8 | the personal residual is searched on `cls_hung_material` under the population baseline | no | `contract.RESIDUAL_PRIMARY` | identical |
| ledger §Frozen design v1 | TEST is opened once, for the frozen candidate only | no | `contract.SPLIT["test_opened"]`; `run.py` opens TEST only after a candidate passes the VALIDATE judge | identical |
| `NETA_FINDING.json` | claim ladder, permissions, reversal conditions | no | `contract.CLAIM_LADDER`, `contract.REVERSAL`, reprinted in every report | identical |

---

## C. `AMBIGUOUS_BASELINE` — written down where the baseline was silent

| Question | What the baseline says | Resolution here | Why this and not something else |
| --- | --- | --- | --- |
| How many games does a player need? | nothing. It had 2,209 and never asked | `contract.MIN_CORPUS`: DERIVE ≥ 300 decisions and ≥ 5 games, VALIDATE and TEST ≥ 200 decisions and ≥ 2 games | These are not evidence thresholds. They are the points below which the **already-frozen** statistics are undefined: `min_size` is the search's own minimum support, `min_n_validate` is the judge's own `n_in`/`n_out` floor, 5 games is what the Node C 5-fold game-grouped CV needs, 2 games is what `within_game_contrast` needs to have a variance at all. Below them the run returns `INSUFFICIENT_CORPUS`, never a weaker verdict |
| What if a player has no blitz games? | nothing. erez281 is 87% blitz | the population corpus is blitz-only, so no band can be derived → `POPULATION_BASELINE_INSUFFICIENT` | Inventing a rapid or bullet population would be a new research decision, and comparing a bullet player to a blitz population would silently redefine "a same-rating player" |
| Which rating: current, peak, or median? | ledger calls erez281 "a 1,650-rated blitz player"; his blitz median is 1654 and his live rating 1649 | median `own_rating` over admissible **blitz games**, one reading per game | The median over the corpus is a property of the corpus the population must match, and it cannot drift between the fetch and the run the way a live rating can. It reproduces (1450, 1850) for erez281 |
| Is a berserk game excluded? | design v1.1 handles berserk **in the clock model** for the personal corpus; the population sample excluded berserk games | kept asymmetric, exactly as it was: `contract.BERSERK_HANDLING = "clock-model"` for the focal corpus, `no_berserk: true` in the population contract | Making the two symmetric would change one of them, and either change is a research decision |
| What about duplicate games in a re-fetch? | nothing — the baseline fetched once | first occurrence wins, counted as `duplicate-game-id` | Silent double-counting would inflate a corpus; a named exclusion is reproducible |
| What is the window when a player has more games than erez281? | "the N most recent admissible games, in the API's own dateDesc order" with N = every admissible game | `WINDOW_RULE = "all-admissible-in-dateDesc-order"`; an optional `--window` cap must be declared before the fetch | A cap chosen after seeing the corpus is a window chosen for its reading, which is the killed path the manifest itself names |

---

## D. What was *not* generalised, on purpose

- `nodeA/`, `nodeB/`, `NETA_FINDING.json`, `MISSION_LEDGER.md`, `RSTARSTAR_MECHANISM_LOCALIZATION.md`,
  `PRE_FIELD_FREEZE_EREZ281_*`, `chesscom/` — the frozen record of one mission. Phase 20.
- `FIELD_PROTOCOL_TEMPLATE.md` — already a template with blanks; the field protocol is not on the
  replication path (a replication run stops at a bounded candidate, never at an intervention).
- The product: no detector threshold, no cue, no Decision Lab surface, no measurement protocol.
  Nothing outside `research/mechanism/` was modified.
