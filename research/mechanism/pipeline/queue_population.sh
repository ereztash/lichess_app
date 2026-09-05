#!/bin/bash
# Wait for the personal-corpus workers, then score the population corpus with the same regime.
cd /tmp/claude-0/-home-user/ee69b5a4-c8fc-5a0f-a62b-0e04fcb5bda2/scratchpad
while pgrep -f "frozen_2209.ndjson --out scored" > /dev/null; do sleep 30; done
echo "personal scoring finished at $(date)" >> logs/queue.log
mkdir -p scored_pop
for w in 0 1 2 3; do
  nohup ./venv/bin/python pipeline/score_games.py --in population/pop_games.ndjson --out scored_pop --worker $w --workers 4 > logs/pop_w$w.log 2>&1 &
done
wait
echo "population scoring finished at $(date)" >> logs/queue.log
# then the post-freeze holdout (12 games), single worker
mkdir -p scored_post
./venv/bin/python pipeline/score_games.py --in account/post_freeze_admissible.ndjson --out scored_post --worker 0 --workers 1 > logs/post.log 2>&1
echo "post-freeze scoring finished at $(date)" >> logs/queue.log
