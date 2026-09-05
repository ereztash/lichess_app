#!/bin/bash
# The three waiters deadlocked: their pgrep pattern matched the heredoc text inside their own launch shells.
for pat in "queue_population.sh" "after_scoring.sh" "queue_wasm.sh"; do
  for p in $(pgrep -f "$pat"); do
    if [ "$p" != "$$" ] && [ "$p" != "$PPID" ]; then kill "$p" 2>/dev/null && echo "killed $p ($pat)"; fi
  done
done
sleep 1
ps -eo pid,args | grep -E "[q]ueue_|[a]fter_scoring" | wc -l
