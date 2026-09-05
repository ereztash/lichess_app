#!/bin/bash
# Sequential compute driver (no pgrep: waits on its own child pids).
cd /tmp/claude-0/-home-user/ee69b5a4-c8fc-5a0f-a62b-0e04fcb5bda2/scratchpad
mkdir -p scored_pop scored_post scored_wasm results logs
echo "driver start $(date)" >> logs/driver.log

# 1. decision table for the personal corpus (1 core) in parallel with population scoring (4 workers)
./venv/bin/python pipeline/features.py scored decisions.parquet > logs/features.log 2>&1 &
FEAT=$!
PIDS=""
for w in 0 1 2 3; do
  ./venv/bin/python pipeline/score_games.py --in population/pop_games.ndjson --out scored_pop --worker $w --workers 4 > logs/pop_w$w.log 2>&1 &
  PIDS="$PIDS $!"
done
wait $FEAT
echo "features done $(date)" >> logs/driver.log
wait $PIDS
echo "population scoring done $(date)" >> logs/driver.log

# 2. post-freeze holdout (12 games) and population features
./venv/bin/python pipeline/score_games.py --in account/post_freeze_admissible.ndjson --out scored_post --worker 0 --workers 1 > logs/post.log 2>&1
./venv/bin/python pipeline/features.py scored_post decisions_post.parquet > logs/features_post.log 2>&1
./venv/bin/python pipeline/features.py scored_pop decisions_pop.parquet > logs/features_pop.log 2>&1
echo "post + population features done $(date)" >> logs/driver.log

# 3. engine-artifact control: the shipped WASM engine over the whole personal corpus (4 workers)
PIDS=""
for w in 0 1 2 3; do
  ./venv/bin/python pipeline/score_games.py --engine wasm --in account/frozen_2209.ndjson --out scored_wasm --worker $w --workers 4 > logs/wasm_w$w.log 2>&1 &
  PIDS="$PIDS $!"
done
wait $PIDS
echo "wasm rescore done $(date)" >> logs/driver.log
