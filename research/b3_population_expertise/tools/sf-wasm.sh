#!/bin/sh
# The engine B2 was scored with, restored.
#
# research/b2/harness_report.json records `engineInvokedAs: "sf-wasm.sh"` and
# `engine: "Stockfish 18 Lite WASM"` -- but the script itself lived outside the repository, so the
# record named a wrapper nobody could run. This is that wrapper, written from the record: the
# SINGLE-THREADED lite build is the one whose UCI handshake answers `id name Stockfish 18 Lite
# WASM`; `stockfish-18-lite.js` answers `... Multithreaded` and is therefore a different engine
# than the one B2 used.
#
# stdio only, no arguments: `UciEngine.spawn` in scripts/uci-engine.ts talks UCI to whatever this
# execs.
exec node "$(dirname "$0")/../../../node_modules/stockfish/bin/stockfish-18-lite-single.js"
