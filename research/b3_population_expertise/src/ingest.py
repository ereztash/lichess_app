"""Stream a Lichess monthly dump, keep the qualifying games, and sample sides without ever letting
arrival order decide anything.

WHY A STREAM AND NOT A DOWNLOAD. A monthly dump is ~30 GB compressed. The window this study wants
-- one complete UTC day -- is a prefix of it, so the file is read with an HTTP range request and
decompressed on the fly; nothing but the sampled records touches disk.

WHY A HASH AND NOT A COUNTER. The obvious sampler ("take the first N in each band") makes the
corpus a fact about 00:00 UTC. Acceptance here is `unit_hash(SEED, game_id, side) < q_band`, which
is a uniform draw over sides, independent of where in the stream a game appeared, and reproducible
from the seed alone. The per-player cap is a reservoir for the same reason.

EVERY EXCLUSION IS COUNTED. A game that leaves the corpus leaves a number behind, under its own
name, in the manifest. B2's ledger records what the alternative costs: a rule that read rated-ness
out of the free-text `Event` header dropped 42 rated games as "unrated" and the study reported the
exclusion as a success.
"""
from __future__ import annotations

import collections
import hashlib
import io
import re

import chess
import requests
import zstandard

from clock import berserked, clock_seconds, opponent_previous_think, own_previous_think, think_time
from common import rating_band, unit_hash, player_hash

HEADER = re.compile(r'\[(\w+) "(.*)"\]')
BASE_URL = "https://database.lichess.org/standard/lichess_db_standard_rated_{month}.pgn.zst"
SEED = 20260901

COMMENT = re.compile(r"\{[^}]*\}")
MOVE_NUMBER = re.compile(r"\b\d+\.(\.\.)?")
NAG = re.compile(r"\$\d+")
ANNOTATION = re.compile(r"[?!]+$")
RESULTS = {"1-0", "0-1", "1/2-1/2", "*"}


def san_moves(movetext: str) -> list[str]:
    """Every SAN token, by removing everything that is not one.

    Deliberately subtractive rather than a SAN pattern: a regex that tries to DESCRIBE SAN is a
    regex that silently drops the cases it forgot -- a first draft of this function matched
    disambiguated and capture moves and quietly discarded every plain pawn push, which would have
    shifted every ply index in the corpus without failing anything. What is left after the comments,
    move numbers, NAGs and the result token are gone is a move, and `parse_san` is the arbiter.
    """
    stripped = NAG.sub(" ", MOVE_NUMBER.sub(" ", COMMENT.sub(" ", movetext)))
    # `?`, `?!` and `!` suffixes: a game the owner ran Lichess's computer analysis on carries them
    # in the dump, and `parse_san` rejects `h5?`. Left in, this dropped 10.7% of sampled sides --
    # and not at random, because "somebody asked for an analysis" is not independent of the game.
    return [ANNOTATION.sub("", t) for t in stripped.split() if t not in RESULTS]


class _Tallied:
    """A read-through wrapper that records exactly how many compressed bytes were consumed, and
    their sha256, so the manifest states the provenance of the prefix rather than asserting it."""

    def __init__(self, raw):
        self.raw = raw
        self.bytes_read = 0
        self.digest = hashlib.sha256()

    def read(self, size=-1):
        chunk = self.raw.read(size)
        if chunk:
            self.bytes_read += len(chunk)
            self.digest.update(chunk)
        return chunk

    def readinto(self, buffer):
        n = self.raw.readinto(buffer)
        if n:
            self.bytes_read += n
            self.digest.update(bytes(memoryview(buffer)[:n]))
        return n


def stream_games(month: str, day: str, max_bytes: int, progress=None, tally=None):
    """Yield `(headers, movetext)` for every game in the prefix whose `UTCDate` is `day`.

    Stops at the first game past the day, so the window is defined by the data and not by a byte
    count; the bytes actually consumed are recorded rather than chosen.
    """
    url = BASE_URL.format(month=month)
    response = requests.get(
        url,
        headers={"Range": f"bytes=0-{max_bytes - 1}", "User-Agent": "b3-research"},
        stream=True,
        timeout=1800,
    )
    response.raise_for_status()
    source = _Tallied(response.raw)
    if tally is not None:
        tally["stream"] = source
    dctx = zstandard.ZstdDecompressor(max_window_size=2**31)
    reader = dctx.stream_reader(source, read_across_frames=True)
    text = io.TextIOWrapper(reader, encoding="utf-8", errors="replace")

    headers: dict[str, str] = {}
    seen = 0
    for line in text:
        if line.startswith("["):
            match = HEADER.match(line.strip())
            if match:
                headers[match.group(1)] = match.group(2)
        elif line.strip():
            date = headers.get("UTCDate")
            if date and date != day:
                if date > day:  # past the window; the dump is ordered by start time
                    response.close()
                    return
                headers = {}
                continue
            seen += 1
            if progress and seen % 200000 == 0:
                progress(seen)
            yield headers, line.strip()
            headers = {}
    response.close()


def parse_time_control(value: str) -> tuple[int, int] | None:
    match = re.match(r"(\d+)\+(\d+)$", value or "")
    return (int(match.group(1)), int(match.group(2))) if match else None


class Sampler:
    """Header-level qualification, hash acceptance, and the two caps."""

    def __init__(self, time_control: str, rates: dict[str, float], games_per_player: int = 2):
        self.time_control = time_control
        parsed = parse_time_control(time_control)
        if not parsed:
            raise ValueError(f"unparseable time control {time_control!r}")
        self.base_seconds, self.increment = parsed
        self.rates = rates
        self.games_per_player = games_per_player
        self.excluded: collections.Counter = collections.Counter()
        self.accepted: dict[str, list] = collections.defaultdict(list)
        self.seen_candidates: collections.Counter = collections.Counter()
        self.games_seen = 0

    def _drop(self, why: str) -> None:
        self.excluded[why] += 1

    def offer(self, headers: dict[str, str], movetext: str) -> None:
        self.games_seen += 1
        if headers.get("TimeControl") != self.time_control:
            self._drop("time control")
            return
        # Rated is read STRUCTURALLY, from the rating delta Lichess writes only for rated games --
        # never from the Event string, which is the rule B2 had to repair.
        if "WhiteRatingDiff" not in headers and "BlackRatingDiff" not in headers:
            self._drop("not rated (no RatingDiff)")
            return
        variant = headers.get("Variant", "Standard")
        if variant != "Standard":
            self._drop(f"variant: {variant}")
            return
        if headers.get("WhiteTitle") == "BOT" or headers.get("BlackTitle") == "BOT":
            self._drop("bot")
            return
        if headers.get("Termination") not in ("Normal", "Time forfeit"):
            self._drop(f"termination: {headers.get('Termination')}")
            return
        try:
            elos = {"w": int(headers["WhiteElo"]), "b": int(headers["BlackElo"])}
        except (KeyError, ValueError):
            self._drop("rating missing or unparseable")
            return
        if not all(600 <= e <= 3000 for e in elos.values()):
            self._drop("rating out of sanity range")
            return

        bands = {side: rating_band(elos[side]) for side in ("w", "b")}
        if not any(bands.values()):
            self._drop("neither side in the studied rating range")
            return

        game_id = (headers.get("Site") or "").rsplit("/", 1)[-1]
        if not game_id:
            self._drop("no game id")
            return

        """AT MOST ONE ANALYSED SIDE PER GAME (Gate 1, R6).

        Accepting both sides of a game looks like two observations and is not. They are alternate
        plies of ONE position sequence, their clocks are coupled, and each is the other's
        `clock_ms_opp` and `rating_diff`. The dependence graph is then a player-GAME graph rather
        than the tree `move in game in player` that the player bootstrap assumes, so every band-level
        interval would be too narrow -- worst in the thinnest bands, which is exactly where the
        strongest verdict is decided. With both sides eligible, the one with the smaller hash is
        taken and the other is counted.
        """
        wanted = []
        for side in ("w", "b"):
            band = bands[side]
            if band is None:
                continue
            self.seen_candidates[band] += 1
            if unit_hash(SEED, game_id, side) < self.rates.get(band, 0.0):
                wanted.append(side)
        if not wanted:
            return
        if len(wanted) == 2:
            self._drop("second side of the same game (one analysed side per game)")
            wanted = [min(wanted, key=lambda s: unit_hash(SEED, game_id, s))]

        # Only now is the expensive work done: everything above is header arithmetic.
        clocks = clock_seconds(movetext)
        moves = san_moves(movetext)
        if len(clocks) != len(moves) or not moves:
            self._drop("clock trace does not match the movetext")
            return
        if len(moves) < 20:
            self._drop("shorter than 20 plies")
            return
        if berserked(clocks, self.base_seconds):
            self._drop("berserk or impossible starting clock")
            return

        for side in wanted:
            username = headers["White" if side == "w" else "Black"]
            self.accepted[player_hash(username)].append(
                {
                    "username": username,  # in memory only; never written to any artifact
                    "game_id": game_id,
                    "side": side,
                    "rating": elos[side],
                    "band": bands[side],
                    "opponent_rating": elos["b" if side == "w" else "w"],
                    "moves": moves,
                    "clocks": clocks,
                    "result": headers.get("Result"),
                    "termination": headers.get("Termination"),
                    "utc": f"{headers.get('UTCDate')} {headers.get('UTCTime')}",
                }
            )

    def finalise(self) -> list[dict]:
        """Apply the per-player cap by reservoir, so the cap is order-independent too."""
        out = []
        capped = 0
        for player, sides in sorted(self.accepted.items()):
            if len(sides) > self.games_per_player:
                capped += len(sides) - self.games_per_player
                sides = sorted(
                    sides, key=lambda s: unit_hash(SEED, "cap", player, s["game_id"], s["side"])
                )[: self.games_per_player]
            for side in sides:
                side["player"] = player
                out.append(side)
        self.excluded["over the per-player game cap"] = capped
        out.sort(key=lambda s: (s["player"], s["game_id"], s["side"]))
        return out


def eligible_decisions(side_record: dict, base_seconds: int, increment: int, max_decisions: int):
    """Every ply the analysed player decided at, with the pre-move position, or an exclusion count.

    Returns `(decisions, counts)`. A decision carries only pre-move facts plus the move actually
    played -- which is needed to reach the next position and to score the outcome, and which no
    feature may read.
    """
    board = chess.Board()
    clocks = side_record["clocks"]
    want_white = side_record["side"] == "w"
    counts: collections.Counter = collections.Counter()
    decisions = []

    for ply, san in enumerate(side_record["moves"]):
        fen_before = board.fen()
        is_players_move = (board.turn == chess.WHITE) == want_white
        legal = board.legal_moves.count()
        try:
            move = board.parse_san(san)
        except ValueError:
            counts["illegal san -- game abandoned mid-parse"] += 1
            return [], counts
        if is_players_move:
            if ply + 1 >= len(side_record["moves"]):
                counts["last ply of the game"] += 1
            elif legal <= 1:
                counts["forced (one legal move)"] += 1
            else:
                seconds = think_time(clocks, ply, increment)
                if seconds is None:
                    counts["no derivable think time (player's first move)"] += 1
                elif not (0 <= seconds <= base_seconds):
                    counts["impossible think time"] += 1
                else:
                    opp_prev = opponent_previous_think(clocks, ply, increment)
                    own_prev = own_previous_think(clocks, ply, increment)
                    decisions.append(
                        {
                            "ply": ply,
                            "fen_before": fen_before,
                            "move_uci": move.uci(),
                            "legal_moves": legal,
                            "in_check": board.is_check(),
                            "seconds_taken": seconds,
                            "clock_ms_self": int(clocks[ply - 2] * 1000),
                            "clock_ms_opp": int(clocks[ply - 1] * 1000),
                            "opp_prev_think_s": opp_prev,
                            "own_prev_think_s": own_prev,
                        }
                    )
        board.push(move)

    if len(decisions) > max_decisions:
        # Evenly spaced by ply rather than truncated, so one long game contributes across its whole
        # shape instead of only its opening.
        step = len(decisions) / max_decisions
        decisions = [decisions[int(i * step)] for i in range(max_decisions)]
        counts["over the per-side decision cap"] += 1
    return decisions, counts
