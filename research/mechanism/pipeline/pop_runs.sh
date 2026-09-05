#!/bin/bash
# Design v1.8: population-baseline personal search, blitz only, OBS vocabulary; then 30 i.i.d. nulls.
S=/tmp/claude-0/-home-user/ee69b5a4-c8fc-5a0f-a62b-0e04fcb5bda2/scratchpad
export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1
cd $S
for T in cls_tactical cls_hung_material err; do
  $S/venv/bin/python $S/analysis/run_discovery.py --decisions $S/decisions_v2.parquet --population $S/decisions_pop.parquet --blitz-only 1 --vocab OBS --boot 30 --depths 1,2,3 --target $T --out $S/results/discovery_POP_${T}.json > $S/logs/discovery_POP_$T.log 2>&1
  $S/venv/bin/python $S/analysis/plant.py --decisions $S/decisions_v2.parquet --population $S/decisions_pop.parquet --blitz-only 1 --reps 1 --nulls 30 --depths 1,2 --residual 1 --vocab OBS --target $T --worlds W5-null --out $S/results/nodeB_null_POP_$T.json > $S/logs/nodeB_null_POP_$T.log 2>&1
  echo "pop run $T done $(date)" >> $S/logs/driver.log
done
