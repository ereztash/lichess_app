"""A UCI driver for a native Stockfish, shaped for B3.

WHY NOT `scripts/uci-engine.ts`. That driver is correct and B3's settings are deliberately the same
shape -- node budgets, MultiPV, a cleared hash before every search -- but B3's analysis is Python,
and a second process boundary per decision would cost more than the search. The one thing that must
not be re-derived is the SEMANTICS, so the rules that file records are kept verbatim here:

  * search by NODES, never by time, so a busy machine cannot change a result;
  * `ucinewgame` + `isready` before EVERY position, because a warm transposition table makes a
    position's evaluation depend on what was searched before it -- the repository measured that as
    up to 14.3 percentage points of a player's accuracy moving on game order alone;
  * the engine's own `id name` is the provenance, not the filename, because a filename can name a
    wrapper script and a wrapper script is not a chess engine.

WHAT IS NEW HERE: the whole iterative-deepening trace is kept, not just the final lines. That trace
is where B3's value-of-computation and search-complexity features come from, and keeping it makes
them free -- one search answers both "what does the engine think" and "how much did thinking
change its mind", with no second search and no second budget to justify.
"""
from __future__ import annotations

import subprocess
from dataclasses import dataclass, field

from common import comparable_cp, win_probability


@dataclass
class Iteration:
    """One completed iterative-deepening pass: the whole MultiPV set at that depth."""

    depth: int
    nodes: int
    # multipv index (1-based) -> (score kind, score value, principal variation as UCI moves)
    lines: dict[int, tuple[str, int, list[str]]] = field(default_factory=dict)

    def cp(self, mpv: int = 1) -> int:
        kind, value, _ = self.lines[mpv]
        return comparable_cp(kind, value)

    def wp(self, mpv: int = 1) -> float:
        return win_probability(self.cp(mpv))

    def move(self, mpv: int = 1) -> str:
        return self.lines[mpv][2][0] if self.lines[mpv][2] else ""

    def is_mate(self, mpv: int = 1) -> bool:
        return self.lines[mpv][0] == "mate"


@dataclass
class Search:
    """Everything one `go nodes` produced. `terminal` positions have no iterations at all."""

    best_move: str | None
    iterations: list[Iteration]
    terminal: bool = False

    def complete(self, expected_k: int) -> list[Iteration]:
        """Iterations whose MultiPV set is FULL.

        A node limit stops the search mid-iteration, so the deepest depth seen is usually a partial
        set: line 1 present, lines 2..K not. Reading a partial set as "the engine's opinion at depth
        d" would compare a full set at the shallow end against a truncated one at the deep end, and
        every ranking feature below would inherit that as signal. Only full sets count.
        """
        return [it for it in self.iterations if len(it.lines) == expected_k]


class Engine:
    """One long-lived Stockfish process. Not thread-safe; one per worker."""

    def __init__(self, binary: str, hash_mb: int = 32, multipv: int = 4, threads: int = 1):
        self.binary = binary
        self.multipv = multipv
        self.proc = subprocess.Popen(
            [binary],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
        )
        self._send("uci")
        self.name = "unknown"
        while True:
            line = self.proc.stdout.readline()
            if not line:
                raise RuntimeError(f"{binary} died during the UCI handshake")
            if line.startswith("id name "):
                self.name = line.strip()[len("id name ") :]
            if line.startswith("uciok"):
                break
        for option, value in (("Threads", threads), ("Hash", hash_mb), ("MultiPV", multipv)):
            self._send(f"setoption name {option} value {value}")
        self._sync()

    def _send(self, text: str) -> None:
        self.proc.stdin.write(text + "\n")
        self.proc.stdin.flush()

    def _sync(self) -> None:
        self._send("isready")
        while True:
            line = self.proc.stdout.readline()
            if not line:
                raise RuntimeError("engine died waiting for readyok")
            if line.startswith("readyok"):
                return

    def search(self, fen: str, nodes: int) -> Search:
        # The clear is not an optimisation to skip. See the module note.
        self._send("ucinewgame")
        self._sync()
        self._send(f"position fen {fen}")
        self._send(f"go nodes {nodes}")

        by_depth: dict[int, Iteration] = {}
        best_move: str | None = None
        while True:
            raw = self.proc.stdout.readline()
            if not raw:
                raise RuntimeError("engine died during search")
            line = raw.strip()
            if line.startswith("bestmove"):
                parts = line.split()
                best_move = parts[1] if len(parts) > 1 and parts[1] != "(none)" else None
                break
            if not line.startswith("info ") or " pv " not in line:
                continue
            # A bounded score is a search artefact of an unfinished window, not an evaluation.
            if "lowerbound" in line or "upperbound" in line:
                continue
            tok = line.split()

            def after(key: str) -> str | None:
                return tok[tok.index(key) + 1] if key in tok else None

            depth = int(after("depth") or 0)
            mpv = int(after("multipv") or 1)
            nodes_seen = int(after("nodes") or 0)
            si = tok.index("score")
            kind, value = tok[si + 1], int(tok[si + 2])
            pv = tok[tok.index("pv") + 1 :]
            it = by_depth.setdefault(depth, Iteration(depth=depth, nodes=nodes_seen))
            it.nodes = max(it.nodes, nodes_seen)
            it.lines[mpv] = (kind, value, pv)

        iterations = [by_depth[d] for d in sorted(by_depth)]
        return Search(best_move=best_move, iterations=iterations, terminal=not iterations)

    def quit(self) -> None:
        try:
            self._send("quit")
            self.proc.wait(timeout=5)
        except Exception:
            self.proc.kill()
