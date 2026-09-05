#!/bin/bash
# Resumable compute driver, stage 2 (decisions.parquet already exists). Engines are started staggered.
cd /tmp/claude-0/-home-user/ee69b5a4-c8fc-5a0f-a62b-0e04fcb5bda2/scratchpad
mkdir -p scored_pop scored_post scored_wasm results logs
echo "driver2 start $(date)" >> logs/driver.log

PIDS=""
for w in 0 1 2 3; do
  ./venv/bin/python pipeline/score_games.py --in population/pop_games.ndjson --out scored_pop --worker $w --workers 4 >> logs/pop_w$w.log 2>&1 &
  PIDS="$PIDS $!"; sleep 8
done
wait $PIDS
echo "population scoring done $(date)" >> logs/driver.log

./venv/bin/python pipeline/score_games.py --in account/post_freeze_admissible.ndjson --out scored_post --worker 0 --workers 1 >> logs/post.log 2>&1
./venv/bin/python pipeline/features.py scored_post decisions_post.parquet > logs/features_post.log 2>&1
./venv/bin/python pipeline/features.py scored_pop decisions_pop.parquet > logs/features_pop.log 2>&1
echo "post + population features done $(date)" >> logs/driver.log

PIDS=""
for w in 0 1 2 3; do
  ./venv/bin/python pipeline/score_games.py --engine wasm --in account/frozen_2209.ndjson --out scored_wasm --worker $w --workers 4 >> logs/wasm_w$w.log 2>&1 &
  PIDS="$PIDS $!"; sleep 8
done
wait $PIDS
echo "wasm rescore done $(date)" >> logs/driver.log
