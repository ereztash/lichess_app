#!/bin/bash
# Diagnostic discovery runs (v1.6 design) over the non-observable vocabularies, sequentially.
S=/tmp/claude-0/-home-user/ee69b5a4-c8fc-5a0f-a62b-0e04fcb5bda2/scratchpad
cd $S
for V in HIST ENG TIME OBS+ENG; do
  tag=$(echo $V | tr -d '+')
  $S/venv/bin/python $S/analysis/run_discovery.py --decisions $S/decisions.parquet --vocab $V --residual 1 --boot 20 --depths 1,2,3 --out $S/results/discovery_${tag}_err_resid.json > $S/logs/discovery_${tag}.log 2>&1
  echo "diag $V done $(date)" >> $S/logs/driver.log
done
