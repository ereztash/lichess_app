#!/bin/bash
# Class-target discovery (design v1.7): per error class, the OBS residual search + 30 i.i.d. nulls.
S=/tmp/claude-0/-home-user/ee69b5a4-c8fc-5a0f-a62b-0e04fcb5bda2/scratchpad
cd $S
until test -f $S/decisions_v2.parquet; do sleep 10; done
sleep 5
for C in tactical hung_material missed_material quiet_error missed_check allowed_check_tactic bad_capture missed_mate; do
  T=cls_$C
  $S/venv/bin/python $S/analysis/run_discovery.py --decisions $S/decisions_v2.parquet --vocab OBS --residual 1 --boot 30 --depths 1,2,3 --target $T --out $S/results/discovery_OBS_${T}_resid.json > $S/logs/discovery_cls_$C.log 2>&1
  $S/venv/bin/python $S/analysis/plant.py --decisions $S/decisions_v2.parquet --reps 1 --nulls 30 --depths 1,2 --residual 1 --vocab OBS --target $T --worlds W5-null --out $S/results/nodeB_null_${T}.json > $S/logs/nodeB_null_$C.log 2>&1
  echo "class $C done $(date)" >> $S/logs/driver.log
done
