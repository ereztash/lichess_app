#!/bin/bash
# Engine-artifact control + field instrument: re-score the whole personal corpus with the SHIPPED engine
# (Stockfish 18 Lite WASM, depth 12, MultiPV 1, hash cleared) once the population/post-freeze runs are done.
cd /tmp/claude-0/-home-user/ee69b5a4-c8fc-5a0f-a62b-0e04fcb5bda2/scratchpad
while pgrep -f "queue_population.sh" > /dev/null; do sleep 30; done
echo "wasm rescore start $(date)" >> logs/queue.log
mkdir -p scored_wasm
for w in 0 1 2 3; do
  nohup ./venv/bin/python pipeline/score_games.py --engine wasm --in account/frozen_2209.ndjson --out scored_wasm --worker $w --workers 4 > logs/wasm_w$w.log 2>&1 &
done
wait
echo "wasm rescore done $(date)" >> logs/queue.log
