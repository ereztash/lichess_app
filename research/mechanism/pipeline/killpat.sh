#!/bin/bash
# kill every process whose command line matches $1, except this script and its parent
for p in $(pgrep -f "$1"); do
  if [ "$p" != "$$" ] && [ "$p" != "$PPID" ]; then kill "$p" 2>/dev/null && echo "killed $p"; fi
done
