from __future__ import annotations

import argparse
import json
import math
from collections import Counter
from pathlib import Path

import chess
import chess.engine
import chess.pgn
import numpy as np

PLAYER = "ereztal-shir"
DEPTH = 12
MULTIPV = 3
MATE_SCORE = 10000
WIN_PROBABILITY_K = 0.00368208
VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}
BLITZ_TCS = {"180", "300"}
BOOTSTRAPS = 5000
SEED = 20260906


def win_probability(cp: float) -> float:
    return 1.0 / (1.0 + math.exp(-WIN_PROBABILITY_K * cp))


def win_probability_loss(eval_cp: float, cp_loss: float) -> float:
    return max(0.0, win_probability(eval_cp) - win_probability(eval_cp - cp_loss))


ACCURATE_WP_LOSS = win_probability_loss(15, 30)


def comparable_pov(score: chess.engine.PovScore, color: chess.Color) -> int:
    s = score.pov(color)
    if s.is_mate():
        m = s.mate()
        return MATE_SCORE if m is not None and m > 0 else -MATE_SCORE
    cp = s.score()
    return int(cp or 0)


def position_key(fen: str) -> str:
    return " ".join(fen.strip().split()[:4])


def book_key(fen: str) -> int:
    h = 0x811C9DC5
    for ch in position_key(fen):
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def material_balance(board: chess.Board, color: chess.Color) -> int:
    return sum(VALUES[p.piece_type] if p.color == color else -VALUES[p.piece_type] for p in board.piece_map().values())


def is_overloaded(board: chess.Board, sq: chess.Square, color: chess.Color) -> bool:
    piece = board.piece_at(sq)
    if piece is None or piece.color != color or piece.piece_type == chess.KING:
        return False
    attackers = len(board.attackers(not color, sq))
    defenders = len(board.attackers(color, sq))
    return attackers > 0 and attackers > defenders


def overloaded_squares(board: chess.Board, color: chess.Color) -> list[chess.Square]:
    return [sq for sq, p in board.piece_map().items()
            if p.color == color and p.piece_type != chess.KING and is_overloaded(board, sq, color)]


def see_capture_gain(board: chess.Board, move: chess.Move) -> int:
    if not board.is_capture(move):
        return 0
    b = board.copy(stack=False)
    gain = []
    target = move.to_square
    captured = 1 if b.is_en_passant(move) else VALUES[b.piece_at(target).piece_type]
    gain.append(captured)
    mover_val = VALUES[b.piece_at(move.from_square).piece_type]
    b.push(move)
    side = b.turn
    while True:
        attackers = [s for s in b.attackers(side, target) if not b.is_pinned(side, s)]
        if not attackers:
            break
        s = min(attackers, key=lambda x: VALUES[b.piece_at(x).piece_type])
        gain.append(mover_val - gain[-1])
        mover_val = VALUES[b.piece_at(s).piece_type]
        mv = chess.Move(s, target)
        if b.piece_at(s).piece_type == chess.PAWN and chess.square_rank(target) in (0, 7):
            mv = chess.Move(s, target, promotion=chess.QUEEN)
        if mv not in b.legal_moves:
            break
        b.push(mv)
        side = b.turn
        if len(gain) > 12:
            break
    while len(gain) > 1:
        gain[-2] = -max(-gain[-2], gain[-1])
        gain.pop()
    return gain[0]


def tracked_square_before_own_move(current_sq: chess.Square, before_prev_own: chess.Board,
                                    prev_own: chess.Move | None, color: chess.Color) -> chess.Square | None:
    if prev_own is None:
        p = before_prev_own.piece_at(current_sq)
        return current_sq if p is not None and p.color == color else None
    if prev_own.to_square == current_sq:
        p = before_prev_own.piece_at(prev_own.from_square)
        if p is not None and p.color == color:
            return prev_own.from_square
    p = before_prev_own.piece_at(current_sq)
    if p is not None and p.color == color:
        return current_sq
    return None


def piece_provenance(history: list[dict], i: int, sq: chess.Square, color: chess.Color) -> str:
    ply = history[i]["ply_index"]
    all_plies = history[i]["all_plies"]
    if ply < 1:
        return "UNKNOWN"
    before_opp = all_plies[ply - 1]["board_before"]
    same = before_opp.piece_at(sq)
    if same is None or same.color != color:
        return "UNKNOWN"
    if not is_overloaded(before_opp, sq, color):
        return "OPPONENT_CREATED"
    if ply < 2:
        return "UNKNOWN"
    before_prev_own = all_plies[ply - 2]["board_before"]
    prev_own = all_plies[ply - 2]["move"]
    prev_sq = tracked_square_before_own_move(sq, before_prev_own, prev_own, color)
    if prev_sq is None:
        return "UNKNOWN"
    return "PERSISTENT" if is_overloaded(before_prev_own, prev_sq, color) else "SELF_CREATED_PREVIOUS"


def profile(provs: list[str], current: list[chess.Square]) -> str:
    if not current:
        return "NONE"
    non_unknown = sorted(set(x for x in provs if x != "UNKNOWN"))
    if not non_unknown:
        return "UNKNOWN"
    if len(non_unknown) == 1 and all(x in (non_unknown[0], "UNKNOWN") for x in provs):
        return non_unknown[0]
    return "MIXED"


def analyse_score(engine, board: chess.Board, color: chess.Color, multipv: int) -> tuple[int, list[dict]]:
    info = engine.analyse(board, chess.engine.Limit(depth=DEPTH), multipv=multipv, game=object())
    if isinstance(info, dict):
        info = [info]
    lines = []
    for x in info:
        pv = x.get("pv", [])
        lines.append({"score": comparable_pov(x["score"], color), "pv": pv})
    return lines[0]["score"], lines


def terminal_score(board: chess.Board, color: chess.Color) -> int:
    if board.is_checkmate():
        return -MATE_SCORE if board.turn == color else MATE_SCORE
    return 0


def weighted_within_game(rows: list[dict], predicate, outcome: str) -> dict:
    by_game: dict[str, list[dict]] = {}
    for r in rows:
        by_game.setdefault(r["game_id"], []).append(r)
    ds, ws = [], []
    n_in = n_out = 0
    for rs in by_game.values():
        inside = [float(r[outcome]) for r in rs if predicate(r)]
        outside = [float(r[outcome]) for r in rs if not predicate(r)]
        n_in += len(inside); n_out += len(outside)
        if inside and outside:
            ni, no = len(inside), len(outside)
            ds.append(float(np.mean(inside) - np.mean(outside)))
            ws.append(ni * no / (ni + no))
    if len(ds) < 2:
        return {"n_games": len(ds), "n_in": n_in, "n_out": n_out, "est": None, "se": None, "z": None}
    ds = np.asarray(ds); ws = np.asarray(ws)
    est = float((ws * ds).sum() / ws.sum())
    var = float((ws**2 * (ds-est)**2).sum() / (ws.sum()**2)) * len(ds)/(len(ds)-1)
    se = math.sqrt(var)
    return {"n_games": len(ds), "n_in": n_in, "n_out": n_out, "est": est, "se": se, "z": est/se if se else None}


def game_bootstrap_contrast(rows: list[dict], pred_a, pred_b, outcome: str) -> dict:
    by_game: dict[str, list[dict]] = {}
    for r in rows:
        by_game.setdefault(r["game_id"], []).append(r)
    games = list(by_game)
    def rate(rs, pred):
        ys = [r[outcome] for r in rs if pred(r)]
        return float(np.mean(ys)) if ys else None
    all_a = [r[outcome] for r in rows if pred_a(r)]
    all_b = [r[outcome] for r in rows if pred_b(r)]
    point = (float(np.mean(all_a)) - float(np.mean(all_b))) if all_a and all_b else None
    rng = np.random.default_rng(SEED)
    vals = []
    if point is not None and games:
        for _ in range(BOOTSTRAPS):
            picked = rng.choice(games, size=len(games), replace=True)
            sample = [r for g in picked for r in by_game[g]]
            a = rate(sample, pred_a); b = rate(sample, pred_b)
            if a is not None and b is not None:
                vals.append(a-b)
    return {
        "n_a": len(all_a), "rate_a": float(np.mean(all_a)) if all_a else None,
        "n_b": len(all_b), "rate_b": float(np.mean(all_b)) if all_b else None,
        "diff": point,
        "bootstrap_ci95": [float(np.quantile(vals, .025)), float(np.quantile(vals, .975))] if vals else None,
        "bootstrap_positive_share": float(np.mean(np.asarray(vals) > 0)) if vals else None,
    }


def load_games(path: Path) -> list[chess.pgn.Game]:
    games = []
    with path.open(encoding="utf-8") as f:
        while True:
            g = chess.pgn.read_game(f)
            if g is None:
                break
            games.append(g)
    return games


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pgn", required=True)
    ap.add_argument("--engine", required=True)
    ap.add_argument("--book-keys", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    book_keys = set(json.loads(Path(args.book_keys).read_text()))
    games = load_games(Path(args.pgn))
    selected = []
    corpus = {
        "games_total": len(games), "player": PLAYER,
        "time_controls": Counter(g.headers.get("TimeControl") for g in games),
        "date_min": min(g.headers.get("Date", "") for g in games),
        "date_max": max(g.headers.get("Date", "") for g in games),
        "has_clk_annotations": False,
        "selection_rule": "TimeControl in {180,300}; board-only eligibility excludes forced and opening-book decisions; clock eligibility unavailable",
    }
    for ix, g in enumerate(games):
        w, b = g.headers.get("White", "").lower(), g.headers.get("Black", "").lower()
        if PLAYER not in (w, b):
            continue
        if g.headers.get("TimeControl") not in BLITZ_TCS:
            continue
        selected.append((ix, g))

    engine = chess.engine.SimpleEngine.popen_uci(args.engine, timeout=180)
    engine.configure({"Threads": 1, "Hash": 16})
    rows = []
    scored_positions = 0
    errors = []

    for gi, (source_ix, game) in enumerate(selected):
        board = game.board()
        focal = chess.WHITE if game.headers.get("White", "").lower() == PLAYER else chess.BLACK
        game_id = f"chesscom-{game.headers.get('Date','?')}-{source_ix:03d}"
        all_plies = []
        node = game
        ply = 0
        while node.variations:
            child = node.variation(0)
            mv = child.move
            all_plies.append({"ply_index": ply, "board_before": board.copy(stack=False), "move": mv})
            board.push(mv)
            node = child
            ply += 1

        focal_hist = []
        for p in all_plies:
            if p["board_before"].turn == focal:
                focal_hist.append({"ply_index": p["ply_index"], "all_plies": all_plies})

        for fi, h in enumerate(focal_hist):
            ply_i = h["ply_index"]
            p = all_plies[ply_i]
            before = p["board_before"].copy(stack=False)
            mv = p["move"]
            if mv not in before.legal_moves:
                errors.append(f"illegal focal move {game_id} ply {ply_i}")
                continue
            forced = before.legal_moves.count() <= 1
            book = book_key(before.fen()) in book_keys
            if forced or book:
                continue

            current = overloaded_squares(before, focal)
            provs = [piece_provenance(focal_hist, fi, sq, focal) for sq in current]
            prov_profile = profile(provs, current)
            mat = material_balance(before, focal)
            rstarstar = (0 <= mat < 3 and len(current) >= 1)

            after = before.copy(stack=False)
            after.push(mv)
            unresolved_n = 0
            for sq in current:
                after_sq = mv.to_square if mv.from_square == sq else sq
                if is_overloaded(after, after_sq, focal):
                    unresolved_n += 1
            unresolved = unresolved_n > 0

            before_score, _before_lines = analyse_score(engine, before, focal, MULTIPV)
            scored_positions += 1
            if after.is_game_over():
                after_score = terminal_score(after, focal)
                reply = None
            else:
                after_score, after_lines = analyse_score(engine, after, focal, 1)
                scored_positions += 1
                reply = after_lines[0]["pv"][0] if after_lines and after_lines[0]["pv"] else None
            cp_loss = max(0, before_score - after_score)
            wp_loss = win_probability_loss(before_score, cp_loss)
            is_error = wp_loss > ACCURATE_WP_LOSS
            reply_capture = bool(reply is not None and reply in after.legal_moves and after.is_capture(reply))
            reply_see = see_capture_gain(after, reply) if reply_capture and reply is not None else 0
            hung = bool(is_error and reply_capture and reply_see >= 1)

            rows.append({
                "game_id": game_id, "date": game.headers.get("Date"), "time_control": game.headers.get("TimeControl"),
                "ply": ply_i, "material_balance": mat, "overloaded_n": len(current), "rstarstar": rstarstar,
                "provenance": prov_profile, "persistent": prov_profile == "PERSISTENT",
                "current_move_unresolved": unresolved, "hung_material": hung,
                "wp_loss": wp_loss, "cp_loss": cp_loss,
            })

    engine.quit()

    rr = [r for r in rows if r["rstarstar"]]
    persistent_unresolved = lambda r: r["rstarstar"] and r["persistent"] and r["current_move_unresolved"]
    persistent_resolved = lambda r: r["rstarstar"] and r["persistent"] and not r["current_move_unresolved"]
    nonpersistent_unresolved = lambda r: r["rstarstar"] and not r["persistent"] and r["current_move_unresolved"]

    out = {
        "status": "BOARD_ONLY_CROSS_PLATFORM_REPLICATION__CLOCK_NOT_OBSERVED",
        "protocol_frozen_before_outcomes": True,
        "corpus": {**corpus, "time_controls": dict(corpus["time_controls"]), "games_selected_blitz": len(selected)},
        "engine": {"name": "Stockfish 17.1", "depth": DEPTH, "multipv_pre_move": MULTIPV, "hash_reset_per_position": True},
        "eligibility_deviation": "Original Lichess product eligibility requires think time and clock. Chess.com PGN contains neither. This run preserves not-forced and not-book only; therefore it is an external board-mechanism replication, not an exact R** validation frame.",
        "counts": {"board_eligible_focal_decisions": len(rows), "rstarstar": len(rr), "scored_positions": scored_positions, "parse_errors": errors},
        "rstarstar_hung_within_game": weighted_within_game(rows, lambda r: r["rstarstar"], "hung_material"),
        "provenance_counts_rstarstar": dict(Counter(r["provenance"] for r in rr)),
        "mechanism": {
            "persistent_unresolved_vs_persistent_resolved": game_bootstrap_contrast(rows, persistent_unresolved, persistent_resolved, "hung_material"),
            "persistent_unresolved_vs_nonpersistent_unresolved": game_bootstrap_contrast(rows, persistent_unresolved, nonpersistent_unresolved, "hung_material"),
        },
        "strata": {},
        "boundary": "This can replicate or fail to replicate the board-level repeated-non-resolution pattern across platform/history. It cannot test time allocation, cognitive cause, or intervention effect because move clocks/exposure are absent.",
    }
    for tc in sorted(BLITZ_TCS):
        sub = [r for r in rows if r["time_control"] == tc]
        out["strata"][tc] = {
            "games": len(set(r["game_id"] for r in sub)),
            "decisions": len(sub),
            "rstarstar": sum(r["rstarstar"] for r in sub),
            "rstarstar_hung_within_game": weighted_within_game(sub, lambda r: r["rstarstar"], "hung_material"),
            "persistent_unresolved_vs_persistent_resolved": game_bootstrap_contrast(sub, persistent_unresolved, persistent_resolved, "hung_material"),
        }

    Path(args.out).write_text(json.dumps(out, indent=2, default=float) + "\n", encoding="utf-8")
    print(json.dumps(out, indent=2, default=float))


if __name__ == "__main__":
    main()
