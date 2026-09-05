# research/mechanism — cross-context personal decision-mechanism mission

Start with `MISSION_LEDGER.md` (the whole chain, every design version with the control that forced
it, every node's result, and the final report at the end) and `NETA_FINDING.json` (the Neta v0.2
finding, `FIELD_STOP`, validated by `Product-Perception-Sensemaking-Architect/scripts/validate_finding.py`).

| directory | contents |
| --- | --- |
| `pipeline/` | `score_games.py` (research engine, and `--engine wasm` for the shipped one), `features.py` (canonical definitions ported from `shared/`, verbatim P3 construct, error classes), `rescore_wasm.py`, `reeval_deep.py`, `threat.py`, drivers |
| `analysis/` | `vocab.py` (frozen design and vocabularies), `common.py` (eligibility, splits, within-game contrast, i.i.d. null), `search.py` (governed pysubgroup search, baselines, population model), `plant.py` (Node B harness), `run_discovery.py` (Node C/D/judge), `invariance.py`, `predict.py`, `population.py`, `stability_loco.py`, `describe_region.py`, `omitted_check.py`, `field_eval.py`, `test_leakage.py` |
| `nodeA/` | reader maps, synthesis, adversarial verification, corpus descriptives |
| `nodeB/` | every run's JSON, archived failed designs (`nodeB_v13_stalehistory`, `nodeB_v15_hypergeom`), derivation-only logs of stopped runs |
| `data/` | decision tables (owner, population, post-freeze), compressed engine lines for all three, the shipped-engine VALIDATE re-score, manifests and game lists |
| `FIELD_PROTOCOL_TEMPLATE.md` | the Node L template; the instantiated protocol is in the ledger |

Nothing here touches product code, thresholds, prompts or the detector.
