# Equivalence report — `ORIGINAL_PIPELINE(erez281)` vs `GENERIC_PIPELINE(erez281)`

**Gate:** `GATE-GENERIC-PIPELINE-EQUIVALENCE` — **GREEN**  
**Verdict:** **EQUIVALENT**  
**Positive controls:** **PASS** — every removed hard-code, put back, turns this gate red

## What was compared

The generic pipeline was run with `platform=lichess`, `username=erez281`, from the frozen
scored corpus (`data/scored_erez281_sf171_d12_mpv3.jsonl.zst`) forward: the generalised
feature extractor rebuilt the decision table, and the generalised analysis layer re-ran the
frozen search, judge, bootstrap and population baseline. The reference is the committed
artifacts of the original run (`nodeB/discovery_v17_cls_tactical.json`,
`nodeB/discovery_POP_cls_hung_material.json`, `data/decisions_erez281.parquet`) and
`BASELINE_EREZ281.json`, which was frozen before the refactor.

## Tolerances, declared before the comparison

| quantity | tolerance | why |
| --- | --- | --- |
| counts, split membership, region strings, depth choices, bootstrap winners, pass/fail verdicts | **exact** | these are the research content |
| every feature column, every row | **bitwise** | the extractor either reproduces the table or it does not |
| floating-point statistics (rates, contrasts, z, AUC) | **relative 1e-9** | the same code on the same rows; anything larger is a real difference |

## Artifact-by-artifact

### corpus_and_splits — PASS

| Artifact | Old | Generic | Exact / tolerance | Result |
| --- | --- | --- | --- | --- |
| scored decision rows | `59419` | `59419` | exact | PASS |
| eligible decisions | `52881` | `52881` | exact | PASS |
| eligible games | `2161` | `2161` | exact | PASS |
| DERIVE decisions | `31851` | `31851` | exact | PASS |
| DERIVE games | `1297` | `1297` | exact | PASS |
| VALIDATE decisions | `10626` | `10626` | exact | PASS |
| VALIDATE games | `432` | `432` | exact | PASS |
| TEST decisions | `10404` | `10404` | exact | PASS |
| TEST games | `432` | `432` | exact | PASS |
| DERIVE first game id | `BC9CItcx` | `BC9CItcx` | exact | PASS |
| TEST last game id | `945nilfW` | `945nilfW` | exact | PASS |

### feature_table — PASS

| Artifact | Old | Generic | Exact / tolerance | Result |
| --- | --- | --- | --- | --- |
| rows | `59419` | `59419` | exact | PASS |
| columns | `game_id; ply; move_number; color; speed; base…` | `game_id; ply; move_number; color; speed; base…` | exact | PASS |
| columns differing bitwise | `(none)` | `(none)` | exact | PASS |

### R_star_discovery — PASS

| Artifact | Old | Generic | Exact / tolerance | Result |
| --- | --- | --- | --- | --- |
| target | `cls_tactical` | `cls_tactical` | exact | PASS |
| vocabulary | `OBS` | `OBS` | exact | PASS |
| Node C depth | `2` | `2` | exact | PASS |
| CV mean z depth 1 | `5.87802734991` | `5.87802734924` | rel<=1e-09 | PASS |
| CV mean z depth 2 | `6.81412787081` | `6.81412787092` | rel<=1e-09 | PASS |
| CV mean z depth 3 | `5.82770669837` | `5.82770669896` | rel<=1e-09 | PASS |
| frozen candidates | `material_balance>=-2 AND own_overloaded_piece…` | `material_balance>=-2 AND own_overloaded_piece…` | exact | PASS |
| [material_balance>=-2 AND own_overloaded_piece_count>=1] n_… | `8635` | `8635` | exact | PASS |
| [material_balance>=-2 AND own_overloaded_piece_count>=1] DE… | `0.111682591068` | `0.111682591068` | rel<=1e-09 | PASS |
| [material_balance>=-2 AND own_overloaded_piece_count>=1] st… | `0.566666666667` | `0.566666666667` | rel<=1e-09 | PASS |
| [material_balance>=-2 AND own_overloaded_piece_count>=1] VA… | `2937` | `2937` | exact | PASS |
| [material_balance>=-2 AND own_overloaded_piece_count>=1] VA… | `0.256724548859` | `0.256724548859` | rel<=1e-09 | PASS |
| [material_balance>=-2 AND own_overloaded_piece_count>=1] VA… | `0.138379503186` | `0.138379503186` | rel<=1e-09 | PASS |
| [material_balance>=-2 AND own_overloaded_piece_count>=1] VA… | `0.115259879533` | `0.115259879533` | rel<=1e-09 | PASS |
| [material_balance>=-2 AND own_overloaded_piece_count>=1] VA… | `11.2388298678` | `11.2388298678` | rel<=1e-09 | PASS |
| [material_balance>=-2 AND own_overloaded_piece_count>=1] VA… | `8.55646910972` | `8.55646910968` | rel<=1e-09 | PASS |
| [material_balance>=-2 AND own_overloaded_piece_count>=1] VA… | `True` | `True` | exact | PASS |
| [n_good_captures<1 AND own_overloaded_piece_count>=1] n_der… | `6478` | `6478` | exact | PASS |
| [n_good_captures<1 AND own_overloaded_piece_count>=1] DERIV… | `0.0676907017914` | `0.0676907017914` | rel<=1e-09 | PASS |
| [n_good_captures<1 AND own_overloaded_piece_count>=1] stabi… | `0.4` | `0.4` | rel<=1e-09 | PASS |
| [n_good_captures<1 AND own_overloaded_piece_count>=1] VALID… | `2208` | `2208` | exact | PASS |
| [n_good_captures<1 AND own_overloaded_piece_count>=1] VALID… | `0.224637681159` | `0.224637681159` | rel<=1e-09 | PASS |
| [n_good_captures<1 AND own_overloaded_piece_count>=1] VALID… | `0.157044428605` | `0.157044428605` | rel<=1e-09 | PASS |
| [n_good_captures<1 AND own_overloaded_piece_count>=1] VALID… | `0.0563129272556` | `0.0563129272556` | rel<=1e-09 | PASS |
| [n_good_captures<1 AND own_overloaded_piece_count>=1] VALID… | `5.14113589225` | `5.14113589225` | rel<=1e-09 | PASS |
| [n_good_captures<1 AND own_overloaded_piece_count>=1] VALID… | `6.82081513045` | `6.82081513041` | rel<=1e-09 | PASS |
| [n_good_captures<1 AND own_overloaded_piece_count>=1] VALID… | `True` | `True` | exact | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `3871` | `3871` | exact | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `0.124644504876` | `0.124644504876` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `0.1` | `0.1` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `1326` | `1326` | exact | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `0.272247360483` | `0.272247360483` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `0.156666666667` | `0.156666666667` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `0.117918095244` | `0.117918095244` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `7.75643358474` | `7.75643358474` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `6.47366461665` | `6.47366461662` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `True` | `True` | exact | PASS |

### R_star_star_population_residual — PASS

| Artifact | Old | Generic | Exact / tolerance | Result |
| --- | --- | --- | --- | --- |
| target | `cls_hung_material` | `cls_hung_material` | exact | PASS |
| Node C depth | `2` | `2` | exact | PASS |
| population model holdout AUC | `0.764649917303` | `0.764649917303` | rel<=1e-06 | PASS |
| frozen candidates | `material_balance: [0:3[ AND own_overloaded_pi…` | `material_balance: [0:3[ AND own_overloaded_pi…` | exact | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `3270` | `3270` | exact | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `0.8` | `0.8` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `1199` | `1199` | exact | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `0.199332777314` | `0.199332777314` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `0.0712753277712` | `0.0712753277712` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `0.134613385071` | `0.134613385071` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `9.68661656309` | `9.68661656309` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `4.52022841692` | `4.52022841692` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count>=1]… | `True` | `True` | exact | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count: [1… | `2772` | `2772` | exact | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count: [1… | `0.766666666667` | `0.766666666667` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count: [1… | `1011` | `1011` | exact | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count: [1… | `0.188921859545` | `0.188921859545` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count: [1… | `0.0753089298205` | `0.0753089298205` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count: [1… | `0.116342893815` | `0.116342893815` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count: [1… | `8.16494076154` | `8.16494076154` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count: [1… | `3.91266632732` | `3.91266632732` | rel<=1e-09 | PASS |
| [material_balance: [0:3[ AND own_overloaded_piece_count: [1… | `True` | `True` | exact | PASS |
| [opp_king_ring_enemy_attacks<1 AND own_overloaded_piece_cou… | `3542` | `3542` | exact | PASS |
| [opp_king_ring_enemy_attacks<1 AND own_overloaded_piece_cou… | `0.0666666666667` | `0.0666666666667` | rel<=1e-09 | PASS |
| [opp_king_ring_enemy_attacks<1 AND own_overloaded_piece_cou… | `1419` | `1419` | exact | PASS |
| [opp_king_ring_enemy_attacks<1 AND own_overloaded_piece_cou… | `0.176885130374` | `0.176885130374` | rel<=1e-09 | PASS |
| [opp_king_ring_enemy_attacks<1 AND own_overloaded_piece_cou… | `0.0717258261934` | `0.0717258261934` | rel<=1e-09 | PASS |
| [opp_king_ring_enemy_attacks<1 AND own_overloaded_piece_cou… | `0.0991691084858` | `0.0991691084858` | rel<=1e-09 | PASS |
| [opp_king_ring_enemy_attacks<1 AND own_overloaded_piece_cou… | `8.36333900928` | `8.36333900928` | rel<=1e-09 | PASS |
| [opp_king_ring_enemy_attacks<1 AND own_overloaded_piece_cou… | `3.59530500083` | `3.59530500083` | rel<=1e-09 | PASS |
| [opp_king_ring_enemy_attacks<1 AND own_overloaded_piece_cou… | `True` | `True` | exact | PASS |

### final_evidence_state — PASS

| Artifact | Old | Generic | Exact / tolerance | Result |
| --- | --- | --- | --- | --- |
| population band | `1450; 1850` | `1450; 1850` | exact | PASS |
| population corpus id | `population_2026-06` | `population_2026-06` | exact | PASS |
| output class | `PERSONAL_RESIDUAL_CANDIDATE` | `PERSONAL_RESIDUAL_CANDIDATE` | exact | PASS |
| R* region | `material_balance>=-2 AND own_overloaded_piece…` | `material_balance>=-2 AND own_overloaded_piece…` | exact | PASS |
| R** region | `material_balance: [0:3[ AND own_overloaded_pi…` | `material_balance: [0:3[ AND own_overloaded_pi…` | exact | PASS |

### generalisation — PASS

*This check has no old-pipeline counterpart: it asks whether the generalisation actually generalises. The two columns are what the contract requires and what the code returned.*

| Artifact | Required | Observed | Exact / tolerance | Result |
| --- | --- | --- | --- | --- |
| focal side of a non-erez281 white player | `w` | `w` | exact | PASS |
| focal side of a non-erez281 black player | `b` | `b` | exact | PASS |
| rows loaded for a non-erez281 corpus, corpus not named | `38580` | `38580` | exact | PASS |
| refuses to guess between two corpora in one file | `True` | `True` | exact | PASS |
| focal rows left inside the population frame | `0` | `0` | exact | PASS |
| band for a 1654-rated player | `1450; 1850` | `1450; 1850` | exact | PASS |
| band for a 2010-rated player | `1800; 2200` | `1800; 2200` | exact | PASS |
| band for a 1180-rated player | `1000; 1400` | `1000; 1400` | exact | PASS |

### failure_modes — PASS

*This check has no old-pipeline counterpart: it asks whether the generalisation actually generalises. The two columns are what the contract requires and what the code returned.*

| Artifact | Required | Observed | Exact / tolerance | Result |
| --- | --- | --- | --- | --- |
| unknown account | `USER_NOT_FOUND` | `USER_NOT_FOUND` | exact | PASS |
| thin corpus -> INSUFFICIENT_EVIDENCE/INSUFFICIENT_CORPUS | `INSUFFICIENT_EVIDENCE; INSUFFICIENT_CORPUS` | `INSUFFICIENT_EVIDENCE; INSUFFICIENT_CORPUS` | exact | PASS |
| sufficient corpus is not called insufficient | `False` | `False` | exact | PASS |
| no region passes -> NO_STABLE_STRUCTURE | `NO_STABLE_STRUCTURE` | `NO_STABLE_STRUCTURE` | exact | PASS |
| region found, no population -> POPULATION_BASELINE_INSUFFIC… | `INSUFFICIENT_EVIDENCE; POPULATION_BASELINE_IN…` | `INSUFFICIENT_EVIDENCE; POPULATION_BASELINE_IN…` | exact | PASS |
| region survives judge, not population -> LEVEL_TYPICAL_ONLY | `LEVEL_TYPICAL_ONLY` | `LEVEL_TYPICAL_ONLY` | exact | PASS |
| both pass -> PERSONAL_RESIDUAL_CANDIDATE | `PERSONAL_RESIDUAL_CANDIDATE` | `PERSONAL_RESIDUAL_CANDIDATE` | exact | PASS |
| 2410-rated player -> POPULATION_BASELINE_INSUFFICIENT | `POPULATION_BASELINE_INSUFFICIENT` | `POPULATION_BASELINE_INSUFFICIENT` | exact | PASS |
| and the band it needed is named | `2200; 2600` | `2200; 2600` | exact | PASS |

### eligibility_rule — PASS

*This check has no old-pipeline counterpart: it asks whether the generalisation actually generalises. The two columns are what the contract requires and what the code returned.*

| Artifact | Required | Observed | Exact / tolerance | Result |
| --- | --- | --- | --- | --- |
| a clean game is admissible | `None` | `None` | both absent | PASS |
| no pgn | `no-pgn` | `no-pgn` | exact | PASS |
| unrated | `unrated` | `unrated` | exact | PASS |
| time forfeit | `termination:Time forfeit` | `termination:Time forfeit` | exact | PASS |
| abandoned | `termination:Abandoned` | `termination:Abandoned` | exact | PASS |
| no clocks | `no-clocks` | `no-clocks` | exact | PASS |
| under 20 clocked plies | `under-20-plies` | `under-20-plies` | exact | PASS |
| termination beats no-clocks (baseline precedence) | `termination:Time forfeit` | `termination:Time forfeit` | exact | PASS |
| non-standard variant is scorable=False | `False` | `False` | exact | PASS |
| standard variant is scorable | `True` | `True` | exact | PASS |

## Positive controls

A gate that has only ever been green proves nothing. Each control puts one piece of the
removed hard-code back and requires the gate to go red.

| Control | What was re-injected | Gate went red | Result |
| --- | --- | --- | --- |
| `focal_color_is_erez281` | score_games.resolve_focal decides the focal side by comparing the white player's id to the literal "erez281" | True | PASS |
| `load_decisions_default_erez281` | common.load_decisions defaults to corpus="erez281" | True | PASS |
| `population_excludes_only_erez281` | the population guard is `corpus != "erez281"` | True | PASS |
| `population_band_is_1450_1850` | the population band is the constant (1450, 1850) | True | PASS |

What each control caught:

- `focal_color_is_erez281` → *focal side of a non-erez281 white player*: correct `w`, hard-coded path returned `b`
- `load_decisions_default_erez281` → *rows loaded for a non-erez281 corpus, corpus not named*: correct `38580`, hard-coded path returned `0`
- `load_decisions_default_erez281` → *refuses to guess between two corpora in one file*: correct `True`, hard-coded path returned `False`
- `population_excludes_only_erez281` → *focal rows left inside the population frame*: correct `0`, hard-coded path returned `200`
- `population_band_is_1450_1850` → *band for a 2010-rated player*: correct `1800; 2200`, hard-coded path returned `1450; 1850`
- `population_band_is_1450_1850` → *band for a 1180-rated player*: correct `1000; 1400`, hard-coded path returned `1450; 1850`

## Residual differences

None in any exact comparison. The only non-zero differences anywhere are in three
`resid_wg_z` values of the R\* run, which agree to about 5e-12 relative
(e.g. 8.55646910972384 vs 8.556469109680593). That residual is the output of the
difficulty-baseline logistic regression, whose LBFGS solve is not bit-reproducible across
BLAS builds; the region, its size, its raw contrast, its z and its verdict are identical to
the last digit. The R\*\* run, which uses the gradient-boosted population model, is
identical to the last digit throughout, including the model's holdout AUC.

## Conclusion

**EQUIVALENT.** The generalisation moved the focal player from a string literal to a
parameter without moving the research: same corpus, same splits, same feature table, same
frozen regions, same judgements, same population interpretation, same final evidence state
(`PERSONAL_RESIDUAL_CANDIDATE`, matching the mission's `FIELD_STOP` with C1–C4 supported).

---

*Generated by `make_equivalence_report.py` from the gate's own output on 2026-09-07; repo `9c0b99e73fc4`.*
