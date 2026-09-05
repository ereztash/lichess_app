"""
Research-only scorer for the erez281 frozen 2,209-game window.

For every position of every standard-variant game (both sides' moves), run Stockfish 17.1 native at
fixed depth 12, MultiPV 3, Threads 1, Hash 16, hash cleared before every position (ucinewgame),
mirroring the product's own clear-hash-per-position discipline. Preserve every engine line so that
pre-move features (candidate gaps, ambiguity, best-move type) can be derived later without re-search.

This is R3 compute (raw account data) at the research authority level. It is NOT the product's
canonical engine (Stockfish 18 Lite WASM); the parity risk is recorded in the mission ledger and is
re-checked on the final candidate.

Usage: python score_games.py --in frozen_2209.ndjson --out parts/ --worker K --workers N
"""
import argparse, json, os, sys, time, hashlib, re
import chess, chess.engine

SF = os.environ.get("SF_BIN", "/tmp/claude-0/-home-user/ee69b5a4-c8fc-5a0f-a62b-0e04fcb5bda2/scratchpad/bin/stockfish/stockfish-ubuntu-x86-64-avx2")
DEPTH = 12
MULTIPV = 3

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--in", dest="inp", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--worker", type=int, default=0)
    p.add_argument("--workers", type=int, default=1)
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--engine", default="native", choices=["native", "wasm"],
                   help="native = Stockfish 17.1 MultiPV 3 (research regime); wasm = the shipped Stockfish 18 Lite WASM, MultiPV 1 (product regime)")
    return p.parse_args()

def header(pgn, name):
    m = re.search(r'\[' + name + r' "(.*?)"\]', pgn)
    return m.group(1) if m else None

def score_of(pov_score):
    """Return (cp, mate) from the side-to-move perspective; cp is None when mated."""
    s = pov_score.relative
    if s.is_mate():
        return None, s.mate()
    return s.score(), None

def main():
    a = parse_args()
    os.makedirs(a.out, exist_ok=True)
    out_path = os.path.join(a.out, f"part{a.worker:02d}.jsonl")
    done_ids = set()
    if os.path.exists(out_path):
        with open(out_path) as f:
            for line in f:
                try:
                    done_ids.add(json.loads(line)["id"])
                except Exception:
                    pass
    games = []
    with open(a.inp) as f:
        for i, line in enumerate(f):
            if not line.strip():
                continue
            g = json.loads(line)
            if g.get("variant") != "standard":
                continue
            games.append(g)
    mine = [g for i, g in enumerate(games) if i % a.workers == a.worker]
    if a.limit:
        mine = mine[: a.limit]
    todo = [g for g in mine if g["id"] not in done_ids]
    sys.stderr.write(f"worker {a.worker}: {len(mine)} games, {len(todo)} to do\n")

    global MULTIPV
    if a.engine == "wasm":
        engine = chess.engine.SimpleEngine.popen_uci(["sh", "/home/user/lichess_app/scripts/sf-wasm.sh"], cwd="/home/user/lichess_app", timeout=180)
        MULTIPV = 1
    else:
        engine = chess.engine.SimpleEngine.popen_uci(SF, timeout=180)
    engine.configure({"Threads": 1, "Hash": 16})  # MultiPV is passed per analyse() call
    limit = chess.engine.Limit(depth=DEPTH)
    out = open(out_path, "a")
    t0 = time.time(); npos = 0
    for gi, g in enumerate(todo):
        board = chess.Board()
        moves = g["moves"].split()
        clocks = g.get("clocks") or []
        init_cs = int(g["clock"]["initial"]) * 100 if "clock" in g else None
        inc_cs = int(g["clock"]["increment"]) * 100 if "clock" in g else 0
        pgn = g["pgn"]
        wb = header(pgn, "WhiteBerserk") == "true"
        bb = header(pgn, "BlackBerserk") == "true"
        # berserk halves the initial clock for that side and removes increment
        init_side = {chess.WHITE: init_cs // 2 if (wb and init_cs) else init_cs,
                     chess.BLACK: init_cs // 2 if (bb and init_cs) else init_cs}
        inc_side = {chess.WHITE: 0 if wb else inc_cs, chess.BLACK: 0 if bb else inc_cs}
        plies = []
        ok = True
        for ply, san in enumerate(moves):
            fen = board.fen()
            stm = board.turn
            try:
                mv = board.parse_san(san)
            except Exception as e:
                ok = False; sys.stderr.write(f"{g['id']} ply {ply} bad san {san}: {e}\n"); break
            # clocks: clocks[ply] = mover's clock AFTER this move (centiseconds)
            own_before = clocks[ply - 2] if ply >= 2 and ply - 2 < len(clocks) else init_side[stm]
            opp_before = clocks[ply - 1] if ply >= 1 and ply - 1 < len(clocks) else init_side[not stm]
            own_after = clocks[ply] if ply < len(clocks) else None
            spent_cs = None
            if own_after is not None and own_before is not None:
                spent_cs = own_before + inc_side[stm] - own_after
                if ply < 2:
                    spent_cs = 0  # Lichess does not run the clock on either side's first move
            legal = board.legal_moves.count()
            # engine analysis of the position BEFORE the move. A fresh `game` token makes
            # python-chess send `ucinewgame` before the search, which clears the hash.
            try:
                info = engine.analyse(board, limit, multipv=MULTIPV, game=object())
            except Exception as e:
                ok = False; sys.stderr.write(f"{g['id']} ply {ply} engine error: {e}\n"); break
            lines = []
            for li in info:
                cp, mate = score_of(li["score"])
                lines.append({"pv": [m.uci() for m in li.get("pv", [])[:6]], "cp": cp, "mate": mate,
                              "depth": li.get("depth"), "nodes": li.get("nodes")})
            plies.append({"ply": ply, "fen": fen, "san": san, "uci": mv.uci(), "stm": "w" if stm else "b",
                          "own_before_cs": own_before, "opp_before_cs": opp_before, "own_after_cs": own_after,
                          "spent_cs": spent_cs, "legal": legal, "lines": lines})
            board.push(mv)
            npos += 1
        if not ok:
            continue
        # terminal position: evaluate so the last move can be scored
        term = {"fen": board.fen(), "stm": "w" if board.turn else "b", "game_over": board.is_game_over(),
                "checkmate": board.is_checkmate(), "stalemate": board.is_stalemate(),
                "insufficient": board.is_insufficient_material(), "repetition": board.can_claim_threefold_repetition()}
        if not board.is_game_over():
            info = engine.analyse(board, limit, multipv=1, game=object())
            cp, mate = score_of(info[0]["score"]) if isinstance(info, list) else score_of(info["score"])
            term["cp"] = cp; term["mate"] = mate
            npos += 1
        rec = {"id": g["id"], "speed": g.get("speed"), "perf": g.get("perf"), "createdAt": g.get("createdAt"),
               "status": g.get("status"), "winner": g.get("winner"), "source": g.get("source"),
               "clock": g.get("clock"), "opening": g.get("opening"), "players": g.get("players"),
               "white_berserk": wb, "black_berserk": bb, "termination": header(pgn, "Termination"),
               "erez_color": "w" if g["players"]["white"].get("user", {}).get("id") == "erez281" else "b",
               "focal_colors": g.get("focal_colors"), "corpus": g.get("corpus", "erez281"),
               "plies": plies, "terminal": term}
        out.write(json.dumps(rec) + "\n"); out.flush()
        if (gi + 1) % 5 == 0:
            el = time.time() - t0
            sys.stderr.write(f"worker {a.worker}: {gi+1}/{len(todo)} games, {npos} pos, {npos/el:.1f} pos/s, {el/60:.1f} min\n")
    engine.quit()
    out.close()
    sys.stderr.write(f"worker {a.worker} done: {npos} positions in {(time.time()-t0)/60:.1f} min\n")

if __name__ == "__main__":
    main()
