# `research/evidence-architecture/`

The arithmetic behind [`docs/evidence-architecture/`](../../docs/evidence-architecture/) and
[`D25`](../../docs/decisions/D25-evidence-architecture.md).

Everything here runs against the **published corpus at the published seed**, and the scan reproduces
`docs/measurement/`'s manifest **exactly** — 60,834 games seen, 60,000 used, 180,000 positions,
12,119 in check, 580,852 records, identical trigger counts on all seventeen classes. A number that
cannot be reproduced is an anecdote.

| script | what it answers | engine? |
| --- | --- | --- |
| [`predicate_semantics.py`](predicate_semantics.py) | three claims made in `rule_classes.py` comments and in `ACTION_SET_REANALYSIS.md`, measured instead of asserted: RC-06's two cells, RC-21's scope, RC-13's matched promotions | **no** |
| [`branching_audit.py`](branching_audit.py) | which response predicates ask a different question on the two cells, and why the shipped source-text detector cannot see all of them | **no** |
| [`rc06_fixed_predicate.py`](rc06_fixed_predicate.py) | RC-06's separation with one predicate held fixed across both cells | yes |
| [`identifiability_simulation.py`](identifiability_simulation.py) | can the protocol distinguish the learner states that would take different interventions? | **no** |

Results: [`results/`](results/).

## Reproducing

```sh
python -m pip install -r ../measurement/environment.lock     # chess 1.11.2, numpy 2.4.6, scipy 1.17.1
curl -O https://database.lichess.org/standard/lichess_db_standard_rated_2013-01.pgn.zst

python ../measurement/scan_rule_classes.py \
    --pgn lichess_db_standard_rated_2013-01.pgn.zst \
    --max-games 60000 --per-game 3 --seed 20260831 \
    --out rc.jsonl --manifest results/corpus_manifest.json

python predicate_semantics.py --items rc.jsonl --rc06-cap 2000 \
    --out results/predicate_semantics.json
python branching_audit.py --items rc.jsonl --sample 2000 \
    --out results/branching_audit.json
python rc06_fixed_predicate.py --items rc.jsonl --engine ./stockfish \
    --sample 250 --nodes 200000 --seed 20260831 \
    --out results/rc06_fixed_predicate.json
python identifiability_simulation.py --rates results/rc06_item_chance_rates.json \
    --items 20 --out results/identifiability_simulation_20.json
```

**The engine is Stockfish 17.1**, the official `stockfish-ubuntu-x86-64-avx2` release build, at
200,000 nodes with `Threads 1` and `Hash 64` — the same pin `../measurement/environment.lock`
records, and the same build the published screen used. It is **not** the Stockfish 16 that
[#51](https://github.com/ereztash/lichess_app/pull/51)'s action-set model ran on, which is why
`rc06_fixed_predicate.py` carries its own positive control rather than differencing against a
published number.

## The one thing to look at first

`results/rc06_fixed_predicate.json`:

```
b_valid_branching   T+ .952   T-  .192    separation  +0.760
b_valid_symmetric   T+ .952   T- 1.000    separation  -0.048
```

The first row is the positive control and reproduces the published `.968 / .200 / +0.768` within its
intervals on an independent draw of 250 from the same cells. The second row is the same items, the
same engine and the same searches, with the response predicate held fixed across the two cells.
