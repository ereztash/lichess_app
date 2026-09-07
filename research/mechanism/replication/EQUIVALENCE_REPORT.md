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
| columns differing bitwise (identity columns excluded) | `(none)` | `(none)` | exact | PASS |
| corpus label is constant | `1` | `1` | exact | PASS |
| corpus label is the one the run declared | `lichess:erez281` | `lichess:erez281` | exact | PASS |
| player_key is unchanged | `erez281` | `erez281` | exact | PASS |

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

### invariance — PASS

| Artifact | Old | Generic | Exact / tolerance | Result |
| --- | --- | --- | --- | --- |
| region | `material_balance>=-2 AND own_overloaded_piece…` | `material_balance>=-2 AND own_overloaded_piece…` | exact | PASS |
| frame | `VALIDATE` | `VALIDATE` | exact | PASS |
| overall n_in | `2937` | `2937` | exact | PASS |
| overall n_out | `7689` | `7689` | exact | PASS |
| overall p_in | `0.256724548859` | `0.256724548859` | rel<=1e-09 | PASS |
| overall p_out | `0.138379503186` | `0.138379503186` | rel<=1e-09 | PASS |
| overall diff | `0.118345045673` | `0.118345045673` | rel<=1e-09 | PASS |
| overall z | `11.5930700314` | `11.5930700314` | rel<=1e-09 | PASS |
| strata rows | `26` | `26` | exact | PASS |
| strata keys | `['clock_state', '30-60s']; ['clock_state', '<…` | `['clock_state', '30-60s']; ['clock_state', '<…` | exact | PASS |
| strata judged | `22` | `22` | exact | PASS |
| strata with a positive raw elevation | `22` | `22` | exact | PASS |
| strata differing in n_in, diff or z | `(none)` | `(none)` | exact | PASS |
| leave-one-context-out rows | `clock_state=30-60s; clock_state=<30s; clock_s…` | `clock_state=30-60s; clock_state=<30s; clock_s…` | exact | PASS |
| leave-one-out rows differing | `(none)` | `(none)` | exact | PASS |

### stability_loco — PASS

| Artifact | Old | Generic | Exact / tolerance | Result |
| --- | --- | --- | --- | --- |
| region | `material_balance>=-2 AND own_overloaded_piece…` | `material_balance>=-2 AND own_overloaded_piece…` | exact | PASS |
| target | `cls_tactical` | `cls_tactical` | exact | PASS |
| depth | `2` | `2` | exact | PASS |
| variants | `drop color=w; drop eco_family=A; drop eco_fam…` | `drop color=w; drop eco_family=A; drop eco_fam…` | exact | PASS |
| re-derivations returning R* exactly (J = 1.00) | `12` | `12` | exact | PASS |
| variants differing in winner, n or Jaccard | `(none)` | `(none)` | exact | PASS |

### holdout_test — PASS

| Artifact | Old | Generic | Exact / tolerance | Result |
| --- | --- | --- | --- | --- |
| region | `material_balance>=-2 AND own_overloaded_piece…` | `material_balance>=-2 AND own_overloaded_piece…` | exact | PASS |
| fit_on | `derive` | `derive` | exact | PASS |
| n_fit | `31851` | `31851` | exact | PASS |
| frames | `TEST` | `TEST` | exact | PASS |
| [TEST] n | `10404` | `10404` | exact | PASS |
| [TEST] games | `432` | `432` | exact | PASS |
| [TEST] region n_in | `2812` | `2812` | exact | PASS |
| [TEST] region p_in | `0.241109530583` | `0.241109530583` | rel<=1e-09 | PASS |
| [TEST] region p_out | `0.135800842993` | `0.135800842993` | rel<=1e-09 | PASS |
| [TEST] region z | `10.6028700207` | `10.6028700207` | rel<=1e-09 | PASS |
| [TEST] baseline gap gap_in | `0.0447761282093` | `0.0447761282088` | rel<=1e-09 | PASS |
| [TEST] baseline gap gap_out | `-0.0288988206908` | `-0.0288988206906` | rel<=1e-09 | PASS |
| [TEST] baseline gap diff | `0.0736749489001` | `0.0736749488995` | rel<=1e-09 | PASS |
| [TEST] baseline gap z | `7.78448080303` | `7.78448080296` | rel<=1e-09 | PASS |
| [TEST] M0_history logloss | `0.44672666274` | `0.44672666274` | rel<=1e-09 | PASS |
| [TEST] M0_history auc | `0.5` | `0.5` | rel<=1e-09 | PASS |
| [TEST] M1_six_buckets logloss | `0.44511045623` | `0.44511045623` | rel<=1e-09 | PASS |
| [TEST] M1_six_buckets auc | `0.533248731221` | `0.533248731221` | rel<=1e-09 | PASS |
| [TEST] M2_context logloss | `0.445423678329` | `0.445423678329` | rel<=1e-09 | PASS |
| [TEST] M2_context auc | `0.537880537061` | `0.537880537061` | rel<=1e-09 | PASS |
| [TEST] M3_baseline logloss | `0.423666452137` | `0.423666452137` | rel<=1e-09 | PASS |
| [TEST] M3_baseline auc | `0.664159536951` | `0.664159536951` | rel<=1e-09 | PASS |
| [TEST] M4_baseline_region logloss | `0.41895596951` | `0.41895596951` | rel<=1e-09 | PASS |
| [TEST] M4_baseline_region auc | `0.682122955594` | `0.682122955594` | rel<=1e-09 | PASS |
| [TEST] M5_context_region logloss | `0.438160420171` | `0.438160420171` | rel<=1e-09 | PASS |
| [TEST] M5_context_region auc | `0.599601877689` | `0.599601877689` | rel<=1e-09 | PASS |
| [TEST] region gain over baseline | `0.00471048262692` | `0.00471048262707` | rel<=1e-09 | PASS |
| [TEST] shuffled-label p | `0` | `0` | rel<=1e-09 | PASS |
| [TEST] max shuffled gain | `-0.000908547950161` | `-0.000908547949904` | rel<=1e-09 | PASS |

### population_comparison — PASS

| Artifact | Old | Generic | Exact / tolerance | Result |
| --- | --- | --- | --- | --- |
| region | `material_balance>=-2 AND own_overloaded_piece…` | `material_balance>=-2 AND own_overloaded_piece…` | exact | PASS |
| frame | `VALIDATE` | `VALIDATE` | exact | PASS |
| population n | `34794` | `34794` | exact | PASS |
| population games | `600` | `600` | exact | PASS |
| population sides | `1200` | `1200` | exact | PASS |
| population base_err | `0.144392711387` | `0.144392711387` | rel<=1e-09 | PASS |
| population raw n_in | `8454` | `8454` | exact | PASS |
| population raw p_in | `0.227348000946` | `0.227348000946` | rel<=1e-09 | PASS |
| population raw p_out | `0.117767653759` | `0.117767653759` | rel<=1e-09 | PASS |
| population raw diff | `0.109580347188` | `0.109580347188` | rel<=1e-09 | PASS |
| population raw z | `18.6716042683` | `18.6716042683` | rel<=1e-09 | PASS |
| population residual resid_in | `0.0511057083212` | `0.0511057083212` | rel<=1e-09 | PASS |
| population residual resid_out | `-0.0163623337122` | `-0.0163623337122` | rel<=1e-09 | PASS |
| population residual diff | `0.0674680420334` | `0.0674680420334` | rel<=1e-09 | PASS |
| population residual z | `12.5551129506` | `12.5551129506` | rel<=1e-09 | PASS |
| focal n | `10626` | `10626` | exact | PASS |
| focal raw n_in | `2937` | `2937` | exact | PASS |
| focal raw p_in | `0.256724548859` | `0.256724548859` | rel<=1e-09 | PASS |
| focal raw p_out | `0.138379503186` | `0.138379503186` | rel<=1e-09 | PASS |
| focal raw diff | `0.118345045673` | `0.118345045673` | rel<=1e-09 | PASS |
| focal raw z | `11.5930700314` | `11.5930700314` | rel<=1e-09 | PASS |
| focal residual under the population baseline resid_in | `0.0617919815009` | `0.0617919815009` | rel<=1e-09 | PASS |
| focal residual under the population baseline resid_out | `-0.0257540971894` | `-0.0257540971894` | rel<=1e-09 | PASS |
| focal residual under the population baseline diff | `0.0875460786903` | `0.0875460786903` | rel<=1e-09 | PASS |
| focal residual under the population baseline z | `8.45009523836` | `8.45009523836` | rel<=1e-09 | PASS |
| per-side count | `456` | `456` | exact | PASS |
| per-side elevation mean | `0.0550249046756` | `0.0550249046756` | rel<=1e-09 | PASS |
| per-side elevation sd | `0.143832400993` | `0.143832400993` | rel<=1e-09 | PASS |
| focal elevation | `0.0875460786903` | `0.0875460786903` | rel<=1e-09 | PASS |
| focal percentile | `0.616228070175` | `0.616228070175` | rel<=1e-09 | PASS |
| focal raw elevation | `0.118345045673` | `0.118345045673` | rel<=1e-09 | PASS |
| focal raw percentile | `0.585526315789` | `0.585526315789` | rel<=1e-09 | PASS |
| leakage guard removed the focal corpus from the population … | `0` | `0` | exact | PASS |
| leakage guard names the focal corpus | `True` | `True` | exact | PASS |

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

### R_star_star_second_target — PASS

| Artifact | Old | Generic | Exact / tolerance | Result |
| --- | --- | --- | --- | --- |
| target | `cls_tactical` | `cls_tactical` | exact | PASS |
| vocabulary | `OBS` | `OBS` | exact | PASS |
| Node C depth | `1` | `1` | exact | PASS |
| CV mean z depth 1 | `3.34005040626` | `3.34005040626` | rel<=1e-09 | PASS |
| CV mean z depth 2 | `2.51653523184` | `2.51653523184` | rel<=1e-09 | PASS |
| CV mean z depth 3 | `2.40938830357` | `2.40938830357` | rel<=1e-09 | PASS |
| population model holdout AUC | `0.766121276415` | `0.766121276415` | rel<=1e-06 | PASS |
| frozen candidates | `standing=='level'; material_balance: [0:3[; n…` | `standing=='level'; material_balance: [0:3[; n…` | exact | PASS |
| [standing=='level'] n_derive | `9001` | `9001` | exact | PASS |
| [standing=='level'] DERIVE within-game | `-0.000282524395397` | `-0.000282524395397` | rel<=1e-09 | PASS |
| [standing=='level'] stability share J>=0.60 | `0.9` | `0.9` | rel<=1e-09 | PASS |
| [standing=='level'] VALIDATE n_in | `3246` | `3246` | exact | PASS |
| [standing=='level'] VALIDATE p_in | `0.174060382009` | `0.174060382009` | rel<=1e-09 | PASS |
| [standing=='level'] VALIDATE p_out | `0.16979347312` | `0.16979347312` | rel<=1e-09 | PASS |
| [standing=='level'] VALIDATE wg_est | `-0.00465814057594` | `-0.00465814057594` | rel<=1e-09 | PASS |
| [standing=='level'] VALIDATE wg_z | `-0.413082138774` | `-0.413082138774` | rel<=1e-09 | PASS |
| [standing=='level'] VALIDATE resid_wg_z | `4.15732864694` | `4.15732864694` | rel<=1e-09 | PASS |
| [standing=='level'] VALIDATE pass | `False` | `False` | exact | PASS |
| [material_balance: [0:3[] n_derive | `10698` | `10698` | exact | PASS |
| [material_balance: [0:3[] DERIVE within-game | `0.00160096975693` | `0.00160096975693` | rel<=1e-09 | PASS |
| [material_balance: [0:3[] stability share J>=0.60 | `0.1` | `0.1` | rel<=1e-09 | PASS |
| [material_balance: [0:3[] VALIDATE n_in | `3837` | `3837` | exact | PASS |
| [material_balance: [0:3[] VALIDATE p_in | `0.164972634871` | `0.164972634871` | rel<=1e-09 | PASS |
| [material_balance: [0:3[] VALIDATE p_out | `0.175417246175` | `0.175417246175` | rel<=1e-09 | PASS |
| [material_balance: [0:3[] VALIDATE wg_est | `0.000182441924798` | `0.000182441924798` | rel<=1e-09 | PASS |
| [material_balance: [0:3[] VALIDATE wg_z | `0.0155967760096` | `0.0155967760096` | rel<=1e-09 | PASS |
| [material_balance: [0:3[] VALIDATE resid_wg_z | `4.10752211319` | `4.10752211319` | rel<=1e-09 | PASS |
| [material_balance: [0:3[] VALIDATE pass | `True` | `True` | exact | PASS |
| [n_good_captures>=1] n_derive | `8606` | `8606` | exact | PASS |
| [n_good_captures>=1] DERIVE within-game | `0.0928279035278` | `0.0928279035278` | rel<=1e-09 | PASS |
| [n_good_captures>=1] stability share J>=0.60 | `0` | `0` | rel<=1e-09 | PASS |
| [n_good_captures>=1] VALIDATE n_in | `3076` | `3076` | exact | PASS |
| [n_good_captures>=1] VALIDATE p_in | `0.238621586476` | `0.238621586476` | rel<=1e-09 | PASS |
| [n_good_captures>=1] VALIDATE p_out | `0.139413480731` | `0.139413480731` | rel<=1e-09 | PASS |
| [n_good_captures>=1] VALIDATE wg_est | `0.0995101507139` | `0.0995101507139` | rel<=1e-09 | PASS |
| [n_good_captures>=1] VALIDATE wg_z | `10.0280616721` | `10.0280616721` | rel<=1e-09 | PASS |
| [n_good_captures>=1] VALIDATE resid_wg_z | `1.50129741339` | `1.50129741339` | rel<=1e-09 | PASS |
| [n_good_captures>=1] VALIDATE pass | `False` | `False` | exact | PASS |
| bootstrap winner table | `{"standing=='level'": 27, 'material_balance: …` | `{"standing=='level'": 27, 'material_balance: …` | exact | PASS |

### classifier_verdict — PASS

| Artifact | Old | Generic | Exact / tolerance | Result |
| --- | --- | --- | --- | --- |
| output class | `PERSONAL_RESIDUAL_CANDIDATE` | `PERSONAL_RESIDUAL_CANDIDATE` | exact | PASS |
| R* region | `material_balance>=-2 AND own_overloaded_piece…` | `material_balance>=-2 AND own_overloaded_piece…` | exact | PASS |
| R** region | `material_balance: [0:3[ AND own_overloaded_pi…` | `material_balance: [0:3[ AND own_overloaded_pi…` | exact | PASS |
| R** target | `cls_hung_material` | `cls_hung_material` | exact | PASS |
| residual targets, in frozen precedence order | `cls_hung_material; cls_tactical` | `cls_hung_material; cls_tactical` | exact | PASS |
| the highest-precedence passing candidate is R** | `cls_hung_material; material_balance: [0:3[ AN…` | `cls_hung_material; material_balance: [0:3[ AN…` | exact | PASS |

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

### classifier_precedence — PASS

*This check has no old-pipeline counterpart: it asks whether the generalisation actually generalises. The two columns are what the contract requires and what the code returned.*

| Artifact | Required | Observed | Exact / tolerance | Result |
| --- | --- | --- | --- | --- |
| a lower-quality primary-target candidate still comes first | `cls_hung_material; PRIMARY_LOW_QUALITY` | `cls_hung_material; PRIMARY_LOW_QUALITY` | exact | PASS |
| target order is the frozen precedence, not the quality order | `cls_hung_material; cls_tactical` | `cls_hung_material; cls_tactical` | exact | PASS |
| within one target, quality still orders the candidates | `PRIMARY_LOW_QUALITY; PRIMARY_LOWER` | `PRIMARY_LOW_QUALITY; PRIMARY_LOWER` | exact | PASS |
| every passing candidate is kept, none dropped | `3` | `3` | exact | PASS |

### readiness_semantics — PASS

*This check has no old-pipeline counterpart: it asks whether the generalisation actually generalises. The two columns are what the contract requires and what the code returned.*

| Artifact | Required | Observed | Exact / tolerance | Result |
| --- | --- | --- | --- | --- |
| integer medians that derive the registered band | `1626; 1674` | `1626; 1674` | exact | PASS |
| median 1500 derives | `1300; 1700` | `1300; 1700` | exact | PASS |
| median 1500 is inside the registered band 1450-1850 | `True` | `True` | exact | PASS |
| median 1500 is NOT ready | `False` | `False` | exact | PASS |
| and the blocker names the population baseline | `True` | `True` | exact | PASS |
| median 1654 derives | `1450; 1850` | `1450; 1850` | exact | PASS |
| median 1654 IS ready | `True` | `True` | exact | PASS |
| median 1625 derives | `1400; 1800` | `1400; 1800` | exact | PASS |
| median 1625.5 derives | `1450; 1850` | `1450; 1850` | exact | PASS |
| a red gate blocks readiness | `False` | `False` | exact | PASS |
| no enumeration blocks readiness | `False` | `False` | exact | PASS |

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
| `classifier_ranks_across_targets` | classify.passing ranks every passing candidate by DERIVE quality ACROSS targets, a quantity the mission says is not comparable between targets with different base rates | True | PASS |

What each control caught:

- `focal_color_is_erez281` → *focal side of a non-erez281 white player*: correct `w`, hard-coded path returned `b`
- `load_decisions_default_erez281` → *rows loaded for a non-erez281 corpus, corpus not named*: correct `38580`, hard-coded path returned `0`
- `load_decisions_default_erez281` → *refuses to guess between two corpora in one file*: correct `True`, hard-coded path returned `False`
- `population_excludes_only_erez281` → *focal rows left inside the population frame*: correct `0`, hard-coded path returned `200`
- `population_band_is_1450_1850` → *band for a 2010-rated player*: correct `1800; 2200`, hard-coded path returned `1450; 1850`
- `population_band_is_1450_1850` → *band for a 1180-rated player*: correct `1000; 1400`, hard-coded path returned `1450; 1850`
- `classifier_ranks_across_targets` → *a lower-quality primary-target candidate still comes first*: correct `cls_hung_material; PRIMARY_LOW_QUALITY`, hard-coded path returned `cls_tactical; SECONDARY_HIGH_QUALITY`
- `classifier_ranks_across_targets` → *target order is the frozen precedence, not the quality order*: correct `cls_hung_material; cls_tactical`, hard-coded path returned `cls_tactical; cls_hung_material`

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

*Generated by `make_equivalence_report.py` from the gate's own output on 2026-09-07; repo `8a53dc5ec264`.*
