#!/bin/bash
# When the personal scoring finishes: build the decisions table, then run the Node B harness
# (shuffled-null and planted worlds on the real feature table; the real target is not searched here).
cd /tmp/claude-0/-home-user/ee69b5a4-c8fc-5a0f-a62b-0e04fcb5bda2/scratchpad
while pgrep -f "frozen_2209.ndjson --out scored" > /dev/null; do sleep 20; done
echo "features start $(date)" >> logs/after.log
./venv/bin/python pipeline/features.py scored decisions.parquet >> logs/after.log 2>&1
echo "features done $(date)" >> logs/after.log
mkdir -p results
./venv/bin/python analysis/plant.py --decisions decisions.parquet --reps 20 --nulls 100 --depths 1,2,3 --residual 1 --vocab OBS --out results/nodeB_OBS_resid.json > logs/nodeB_OBS_resid.log 2>&1
echo "nodeB OBS resid done $(date)" >> logs/after.log
./venv/bin/python analysis/plant.py --decisions decisions.parquet --reps 20 --nulls 100 --depths 1,2,3 --residual 0 --vocab OBS --out results/nodeB_OBS_raw.json > logs/nodeB_OBS_raw.log 2>&1
echo "nodeB OBS raw done $(date)" >> logs/after.log
