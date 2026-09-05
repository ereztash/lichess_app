"""
Decision-level feature extraction for the erez281 research corpus.

INPUT: scored/*.jsonl produced by score_games.py (every position, MultiPV 3, depth 12, SF 17.1).
OUTPUT: one row per decision of the player (erez281), with

  * identifiers and game context,
  * CANONICAL fields defined exactly as the product defines them (phase, seconds, clock, standing,
    book, forced, cpLoss, accurate) -- definitions copied from shared/*.ts and cited inline,
  * PRE-MOVE feature families (board relations, engine situation of the position BEFORE the move,
    clock/tempo, in-game history up to the previous ply, session context),
  * POST-MOVE targets, all prefixed `y_`, which nothing in the pre-move families may read.

The leakage rule is structural: every pre-move column is computed from (a) the FEN before the move,
(b) the engine lines of that FEN, (c) plies strictly earlier in the game, (d) game headers, (e)
earlier games. The played move and every later ply appear only in `y_*` columns.

Provenance of ported code:
  * side_piece_metrics / attack_edges / system_state: verbatim from
    research/learning-v3/p3_system_invariant.py (the OwnExposure study's construct source).
  * phase rule: shared/phase.ts (endgame if non-pawn material <= 13 both sides; opening if ply<=20).
  * win probability: shared/win-probability.ts (k = 0.00368208, Lichess AccuracyPercent fit).
  * accurate: shared/detector.ts accurateDecision -> winProbabilityLoss(facing, cpLoss) <=
    winProbabilityLoss(15, 30).
  * cpLoss: shared/import-diagnostic.ts cpLossAt, white-relative eval curve, max(0, .) per mover.
  * mate -> cp: client/src/lib/engine-line.ts comparableCp, MATE_SCORE = 10000; mate 0 is -10000.
  * book: shared/opening-book.ts bookKey (FNV-1a over the four position fields) against the 833
    keys in research/b3_population_expertise/src/opening_book_keys.json.
  * standing: shared/import-diagnostic.ts standingFrom, CLEAR_EDGE_CP = 100.
  * ambiguity entropy / near band: research/b3_population_expertise/src/position_features.py,
    tau = NEAR_BAND = ACCURATE_WIN_PROBABILITY_LOSS.
"""
from __future__ import annotations
import glob, json, math, os, sys, collections
import chess

MATE_SCORE = 10000
WIN_PROBABILITY_K = 0.00368208
ACCURATE_CP_LOSS = 30
CLEAR_EDGE_CP = 100
ENDGAME_MATERIAL_THRESHOLD = 13
OPENING_MAX_PLY = 20
VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}
PHASE_VALUE = {chess.PAWN: 0, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}
BOOK_KEYS_PATH = "/home/user/lichess_app/research/b3_population_expertise/src/opening_book_keys.json"
PLAYER = "erez281"


def win_probability(cp: float) -> float:
    return 1.0 / (1.0 + math.exp(-WIN_PROBABILITY_K * cp))


def win_probability_loss(eval_cp: float, cp_loss: float) -> float:
    return max(0.0, win_probability(eval_cp) - win_probability(eval_cp - cp_loss))


ACCURATE_WIN_PROBABILITY_LOSS = win_probability_loss(ACCURATE_CP_LOSS / 2, ACCURATE_CP_LOSS)
AMBIGUITY_TAU = ACCURATE_WIN_PROBABILITY_LOSS
NEAR_BAND = ACCURATE_WIN_PROBABILITY_LOSS


def comparable_cp(cp, mate) -> int:
    """client/src/lib/engine-line.ts comparableCp: mate>0 -> +MATE, else (mate<=0) -> -MATE."""
    if mate is not None:
        return MATE_SCORE if mate > 0 else -MATE_SCORE
    return int(cp)


def position_key(fen: str) -> str:
    return " ".join(fen.strip().split()[:4])


def book_key(fen: str) -> int:
    key = position_key(fen)
    h = 0x811C9DC5
    for ch in key:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


BOOK_KEYS = set(json.load(open(BOOK_KEYS_PATH)))


def non_pawn_material(board: chess.Board) -> int:
    return sum(PHASE_VALUE[p.piece_type] for p in board.piece_map().values())


def classify_phase(board: chess.Board, ply: int) -> str:
    if non_pawn_material(board) <= ENDGAME_MATERIAL_THRESHOLD:
        return "endgame"
    if ply <= OPENING_MAX_PLY:
        return "opening"
    return "middlegame"


def standing_from(eval_before_cp: int) -> str:
    if eval_before_cp >= CLEAR_EDGE_CP:
        return "winning"
    if eval_before_cp <= -CLEAR_EDGE_CP:
        return "losing"
    return "level"


# ---- verbatim port from research/learning-v3/p3_system_invariant.py -------------------------------
def piece_squares(board, color, include_king=True):
    for sq, piece in board.piece_map().items():
        if piece.color == color and (include_king or piece.piece_type != chess.KING):
            yield sq, piece


def attack_edges(board, source_color, target_color) -> int:
    target_occ = board.occupied_co[target_color]
    total = 0
    for sq, _ in piece_squares(board, source_color):
        total += chess.popcount(board.attacks_mask(sq) & target_occ)
    return total


def side_piece_metrics(board, color):
    enemy = not color
    attacked_count = 0; hanging_count = 0; hanging_value = 0; overloaded_count = 0; redundant_count = 0
    attacked_defenders = []
    for sq, piece in piece_squares(board, color, include_king=False):
        attackers = len(board.attackers(enemy, sq))
        defenders = len(board.attackers(color, sq))
        if attackers > 0:
            attacked_count += 1
            attacked_defenders.append(defenders)
            if defenders == 0:
                hanging_count += 1
                hanging_value += VALUES[piece.piece_type]
            if attackers > defenders:
                overloaded_count += 1
        if defenders >= 2:
            redundant_count += 1
    own_occ = board.occupied_co[color]
    max_dependency = 0
    for sq, _ in piece_squares(board, color, include_king=False):
        defended = chess.popcount(board.attacks_mask(sq) & own_occ)
        max_dependency = max(max_dependency, defended)
    pinned_count = sum(1 for sq, _ in piece_squares(board, color, include_king=False) if board.is_pinned(color, sq))
    king_sq = board.king(color)
    if king_sq is None:
        ring_enemy_attacks = 0; ring_own_defenses = 0
    else:
        ring = chess.BB_KING_ATTACKS[king_sq]
        ring_enemy_attacks = 0; ring_own_defenses = 0
        for sq in chess.scan_reversed(ring):
            if board.is_attacked_by(enemy, sq):
                ring_enemy_attacks += 1
            ring_own_defenses += len(board.attackers(color, sq))
    return {
        "attacked_piece_count": attacked_count, "hanging_piece_count": hanging_count,
        "hanging_value": hanging_value, "overloaded_piece_count": overloaded_count,
        "redundantly_defended_count": redundant_count,
        "min_defenders_on_attacked": min(attacked_defenders) if attacked_defenders else 0,
        "max_defense_dependency": max_dependency, "pinned_count": pinned_count,
        "king_ring_enemy_attacks": ring_enemy_attacks, "king_ring_own_defenses": ring_own_defenses,
    }


def system_state(board, actor):
    opp = not actor
    own = side_piece_metrics(board, actor)
    other = side_piece_metrics(board, opp)
    out = {
        "own_attack_edges": attack_edges(board, actor, opp),
        "own_support_edges": attack_edges(board, actor, actor),
        "opp_attack_edges": attack_edges(board, opp, actor),
        "opp_support_edges": attack_edges(board, opp, opp),
    }
    for name in ("attacked_piece_count", "hanging_piece_count", "hanging_value", "overloaded_piece_count",
                 "redundantly_defended_count", "min_defenders_on_attacked", "max_defense_dependency",
                 "pinned_count", "king_ring_enemy_attacks", "king_ring_own_defenses"):
        out[f"own_{name}"] = own[name]
        out[f"opp_{name}"] = other[name]
    return out
# ---- end verbatim port ----------------------------------------------------------------------------


def softmax_entropy(values, tau):
    if not values:
        return 0.0
    m = max(values)
    ws = [math.exp((v - m) / tau) for v in values]
    z = sum(ws)
    ps = [w / z for w in ws]
    return -sum(p * math.log(p) for p in ps if p > 0)


def material_balance(board, color):
    return sum(VALUES[p.piece_type] if p.color == color else -VALUES[p.piece_type] for p in board.piece_map().values())


def pawn_structure(board, color):
    pawns = board.pieces(chess.PAWN, color)
    enemy_pawns = board.pieces(chess.PAWN, not color)
    files = collections.Counter(chess.square_file(s) for s in pawns)
    doubled = sum(c - 1 for c in files.values() if c > 1)
    isolated = sum(1 for f, c in files.items() if (f - 1 not in files) and (f + 1 not in files))
    passed = 0
    for s in pawns:
        f, r = chess.square_file(s), chess.square_rank(s)
        blocked = False
        for e in enemy_pawns:
            ef, er = chess.square_file(e), chess.square_rank(e)
            if abs(ef - f) <= 1 and ((color == chess.WHITE and er > r) or (color == chess.BLACK and er < r)):
                blocked = True; break
        if not blocked:
            passed += 1
    return {"pawns": len(pawns), "doubled": doubled, "isolated": isolated, "passed": passed}


def move_kind(board, move):
    """Type of a move on `board` (board is the position BEFORE the move)."""
    piece = board.piece_at(move.from_square)
    cap = board.is_capture(move)
    cap_val = 0
    if cap:
        cap_val = 1 if board.is_en_passant(move) else VALUES[board.piece_at(move.to_square).piece_type]
    return {
        "piece": piece.piece_type if piece else 0,
        "capture": int(cap),
        "captured_value": cap_val,
        "check": int(board.gives_check(move)),
        "promotion": int(move.promotion is not None),
        "castle": int(board.is_castling(move)),
        "pawn": int(piece is not None and piece.piece_type == chess.PAWN),
        "king": int(piece is not None and piece.piece_type == chess.KING),
    }


def attacked_set(board, color):
    """Squares of `color`'s non-king pieces currently attacked by the enemy."""
    out = set()
    for sq, p in board.piece_map().items():
        if p.color == color and p.piece_type != chess.KING and board.is_attacked_by(not color, sq):
            out.add(sq)
    return out


def see_capture_gain(board, move):
    """Static exchange evaluation of a capture (python-chess has none; simple iterative SEE)."""
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
        # least valuable attacker
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


def extract_game(rec, sessions, focal=None):
    """Yield one feature row per decision of the focal side in the game (default: erez281's side)."""
    focal = focal or rec["erez_color"]
    rec = dict(rec, erez_color=focal)
    color = chess.WHITE if focal == "w" else chess.BLACK
    plies = rec["plies"]
    n = len(plies)
    # white-relative eval curve per position index 0..n (n = terminal)
    eval_w = []
    for p in plies:
        cp = comparable_cp(p["lines"][0]["cp"], p["lines"][0]["mate"]) if p["lines"] else 0
        eval_w.append(cp if p["stm"] == "w" else -cp)
    t = rec["terminal"]
    if t["checkmate"]:
        cp = -MATE_SCORE  # side to move is mated
    elif t["stalemate"] or t["insufficient"] or t.get("repetition"):
        cp = 0
    elif t.get("cp") is not None or t.get("mate") is not None:
        cp = comparable_cp(t.get("cp"), t.get("mate"))
    else:
        cp = 0
    eval_w.append(cp if t["stm"] == "w" else -cp)

    def mover_rel(idx, stm_white):
        return eval_w[idx] if stm_white else -eval_w[idx]

    # per-ply cp loss (both sides) for history features
    cp_loss = []
    wp_loss = []
    for i, p in enumerate(plies):
        w = p["stm"] == "w"
        before = mover_rel(i, w); after = mover_rel(i + 1, w)
        cl = max(0, before - after)
        cp_loss.append(cl)
        wp_loss.append(win_probability_loss(before, cl))

    tc = rec.get("clock") or {}
    base_s = tc.get("initial"); inc_s = tc.get("increment", 0)
    wb, bb = rec["white_berserk"], rec["black_berserk"]
    own_berserk = wb if color == chess.WHITE else bb
    opp_berserk = bb if color == chess.WHITE else wb
    own_base_cs = (base_s * 100 // 2 if own_berserk else base_s * 100) if base_s else None
    players = rec["players"]
    me = players["white"] if color == chess.WHITE else players["black"]
    them = players["black"] if color == chess.WHITE else players["white"]
    opening = rec.get("opening") or {}
    sess = sessions.get(rec["id"], {})

    board = chess.Board()
    own_errors_so_far = 0; own_decisions_so_far = 0; last_own_error_ply = None
    own_wp_loss_prev = None; own_prev_spent = None
    prev_attacked_own = None  # attacked own pieces before the opponent's last move
    rows = []
    for i, p in enumerate(plies):
        stm_white = p["stm"] == "w"
        stm = chess.WHITE if stm_white else chess.BLACK
        mv = chess.Move.from_uci(p["uci"])
        if stm == color:
            fen = p["fen"]
            lines = p["lines"]
            facing = mover_rel(i, stm_white)
            row = {
                # identifiers / context
                "game_id": rec["id"], "ply": i, "move_number": board.fullmove_number, "color": rec["erez_color"],
                "speed": rec.get("speed"), "base_s": base_s, "inc_s": inc_s, "own_berserk": int(own_berserk),
                "opp_berserk": int(opp_berserk), "arena": int(rec.get("source") == "arena"),
                "createdAt": rec.get("createdAt"), "own_rating": me.get("rating"), "opp_rating": them.get("rating"),
                "rating_diff": (me.get("rating") or 0) - (them.get("rating") or 0),
                "eco": opening.get("eco"), "opening_name": opening.get("name"), "opening_ply": opening.get("ply"),
                "eco_family": (opening.get("eco") or "?")[0],
                "session_id": sess.get("session_id"), "game_in_session": sess.get("game_in_session"),
                "prev_game_result": sess.get("prev_game_result"), "games_today": sess.get("games_today"),
                "fen": fen,
                # canonical
                "phase": classify_phase(board, i), "seconds": (p["spent_cs"] / 100.0) if p["spent_cs"] is not None else None,
                "clock_own_ms": p["own_before_cs"] * 10 if p["own_before_cs"] is not None else None,
                "clock_opp_ms": p["opp_before_cs"] * 10 if p["opp_before_cs"] is not None else None,
                "clock_frac": (p["own_before_cs"] / own_base_cs) if (own_base_cs and p["own_before_cs"] is not None) else None,
                "clock_diff_s": ((p["own_before_cs"] - p["opp_before_cs"]) / 100.0) if (p["own_before_cs"] is not None and p["opp_before_cs"] is not None) else None,
                "eval_before_cp": facing, "standing": standing_from(facing), "book": int(book_key(fen) in BOOK_KEYS),
                "forced": int(p["legal"] == 1), "legal_moves": p["legal"], "in_check": int(board.is_check()),
                "non_pawn_material": non_pawn_material(board), "material_balance": material_balance(board, color),
                "piece_count": len(board.piece_map()),
                "own_castling": int(board.has_castling_rights(color)), "opp_castling": int(board.has_castling_rights(not color)),
                "own_queen": int(bool(board.pieces(chess.QUEEN, color))), "opp_queen": int(bool(board.pieces(chess.QUEEN, not color))),
            }
            # board relations (verbatim construct)
            row.update(system_state(board, color))
            ps_own = pawn_structure(board, color); ps_opp = pawn_structure(board, not color)
            row.update({f"own_{k}": v for k, v in ps_own.items()})
            row.update({f"opp_{k}": v for k, v in ps_opp.items()})
            # available-move structure (engine-free)
            legal = list(board.legal_moves)
            caps = [m for m in legal if board.is_capture(m)]
            checks = [m for m in legal if board.gives_check(m)]
            good_caps = [m for m in caps if see_capture_gain(board, m) > 0]
            row.update({
                "n_captures": len(caps), "n_checks": len(checks), "n_good_captures": len(good_caps),
                "max_capture_value": max([1 if board.is_en_passant(m) else VALUES[board.piece_at(m.to_square).piece_type] for m in caps], default=0),
                "opp_mobility": None,
            })
            probe = board.copy(stack=False); probe.turn = not color
            row["opp_mobility"] = probe.legal_moves.count() if probe.is_valid() else None
            # opponent's last move (pre-move information: it has already happened)
            if i >= 1:
                prev = plies[i - 1]
                pb = chess.Board(prev["fen"]); pm = chess.Move.from_uci(prev["uci"])
                mk = move_kind(pb, pm)
                row.update({f"opp_last_{k}": v for k, v in mk.items()})
                row["opp_last_to_sq"] = pm.to_square
                row["opp_last_cp_loss"] = cp_loss[i - 1]
                row["opp_last_wp_loss"] = wp_loss[i - 1]
                row["opp_last_blunder"] = int(wp_loss[i - 1] > ACCURATE_WIN_PROBABILITY_LOSS)
                row["opp_last_spent_s"] = prev["spent_cs"] / 100.0 if prev["spent_cs"] is not None else None
                # new threats created by the opponent's last move
                att_now = attacked_set(board, color)
                att_before = prev_attacked_own if prev_attacked_own is not None else set()
                row["new_attacks_on_own"] = len(att_now - att_before)
                row["recapture_available"] = int(mk["capture"] == 1 and any(m.to_square == pm.to_square for m in caps))
                row["eval_swing_last_move"] = mover_rel(i, stm_white) - mover_rel(i - 1, not stm_white) * -1 if False else (eval_w[i] - eval_w[i - 1]) * (1 if stm_white else -1)
            else:
                for k in ("piece", "capture", "captured_value", "check", "promotion", "castle", "pawn", "king"):
                    row[f"opp_last_{k}"] = None
                row.update({"opp_last_to_sq": None, "opp_last_cp_loss": None, "opp_last_wp_loss": None, "opp_last_blunder": None,
                            "opp_last_spent_s": None, "new_attacks_on_own": None, "recapture_available": None, "eval_swing_last_move": None})
            # own last move
            if i >= 2:
                prev2 = plies[i - 2]
                pb2 = chess.Board(prev2["fen"]); pm2 = chess.Move.from_uci(prev2["uci"])
                mk2 = move_kind(pb2, pm2)
                row.update({f"own_last_{k}": v for k, v in mk2.items()})
                row["eval_trend_2ply"] = mover_rel(i, stm_white) - mover_rel(i - 2, stm_white)
            else:
                for k in ("piece", "capture", "captured_value", "check", "promotion", "castle", "pawn", "king"):
                    row[f"own_last_{k}"] = None
                row["eval_trend_2ply"] = None
            # eval volatility over the last 4 plies (positions i-4..i), mover-relative
            if i >= 4:
                seq = [mover_rel(j, stm_white) for j in range(i - 4, i + 1)]
                row["eval_volatility_4"] = max(abs(seq[k + 1] - seq[k]) for k in range(4))
            else:
                row["eval_volatility_4"] = None
            # engine situation of the position BEFORE the move
            cps = [comparable_cp(l["cp"], l["mate"]) for l in lines]
            wps = [win_probability(c) for c in cps]
            wp1 = wps[0] if wps else None
            best = chess.Move.from_uci(lines[0]["pv"][0]) if lines and lines[0]["pv"] else None
            row.update({
                "wp1": wp1, "edge": abs(wp1 - 0.5) if wp1 is not None else None,
                "gap12": (wps[0] - wps[1]) if len(wps) > 1 else None,
                "gap13": (wps[0] - wps[2]) if len(wps) > 2 else None,
                "n_near": sum(1 for w in wps if wp1 - w <= NEAR_BAND) if wps else None,
                "ambiguity_entropy": softmax_entropy(wps, AMBIGUITY_TAU) if wps else None,
                "is_mate_line": int(lines[0]["mate"] is not None) if lines else None,
                "n_lines": len(lines),
            })
            if best is not None:
                bk = move_kind(board, best)
                row.update({f"best_{k}": v for k, v in bk.items()})
                row["best_is_recapture"] = int(i >= 1 and best.to_square == chess.Move.from_uci(plies[i - 1]["uci"]).to_square and bk["capture"] == 1)
                row["best_see"] = see_capture_gain(board, best) if bk["capture"] else 0
                moving = board.piece_at(best.from_square)
                row["best_sacrifice"] = int(bk["capture"] == 1 and bk["captured_value"] < VALUES[moving.piece_type] and board.is_attacked_by(not color, best.to_square)) if moving else 0
                # do the top-3 candidates share a kind?
                kinds = [move_kind(board, chess.Move.from_uci(l["pv"][0])) for l in lines if l["pv"]]
                row["top_all_captures"] = int(len(kinds) >= 2 and all(k["capture"] for k in kinds))
                row["top_any_check"] = int(any(k["check"] for k in kinds))
                row["top_all_quiet"] = int(len(kinds) >= 2 and all((not k["capture"] and not k["check"]) for k in kinds))
            # own in-game history (strictly earlier own decisions)
            row.update({
                "own_decisions_so_far": own_decisions_so_far, "own_errors_so_far": own_errors_so_far,
                "own_error_rate_so_far": (own_errors_so_far / own_decisions_so_far) if own_decisions_so_far else None,
                "plies_since_own_error": (i - last_own_error_ply) if last_own_error_ply is not None else None,
                "own_prev_wp_loss": own_wp_loss_prev, "own_prev_spent_s": own_prev_spent,
                "game_elapsed_s": ((own_base_cs - p["own_before_cs"]) / 100.0) if (own_base_cs and p["own_before_cs"] is not None) else None,
            })
            # ---- POST-MOVE targets ----
            cl = cp_loss[i]; wl = wp_loss[i]
            mk_played = move_kind(board, mv)
            row.update({
                "y_cp_loss": cl, "y_wp_loss": wl, "y_accurate": int(wl <= ACCURATE_WIN_PROBABILITY_LOSS),
                "y_played_uci": p["uci"], "y_played_is_best": int(best is not None and mv == best),
                "y_played_in_top3": int(any(l["pv"] and l["pv"][0] == p["uci"] for l in lines)),
                "y_played_capture": mk_played["capture"], "y_played_check": mk_played["check"],
                "y_played_piece": mk_played["piece"], "y_eval_after_cp": mover_rel(i + 1, stm_white),
                "y_game_result": (1 if rec.get("winner") == rec["erez_color"].replace("w", "white").replace("b", "black") else (0 if rec.get("winner") else 0.5)),
            })
            rows.append(row)
            # update own history AFTER recording (so the row never sees its own outcome)
            own_decisions_so_far += 1
            if wl > ACCURATE_WIN_PROBABILITY_LOSS:
                own_errors_so_far += 1; last_own_error_ply = i
            own_wp_loss_prev = wl
            own_prev_spent = p["spent_cs"] / 100.0 if p["spent_cs"] is not None else None
        else:
            # opponent to move: remember which own pieces were attacked before their move
            prev_attacked_own = attacked_set(board, color)
        board.push(mv)
    return rows


def build_sessions(recs):
    """Session context per game from chronological order of the player's games (earlier games only)."""
    recs_sorted = sorted(recs, key=lambda r: r["createdAt"])
    out = {}
    session_id = 0; last_end = None; game_in_session = 0; prev_result = None; day = None; games_today = 0
    for r in recs_sorted:
        start = r["createdAt"]
        d = start // 86400000
        if day != d:
            day = d; games_today = 0
        if last_end is None or start - last_end > 30 * 60 * 1000:
            session_id += 1; game_in_session = 0
        game_in_session += 1; games_today += 1
        out[r["id"]] = {"session_id": session_id, "game_in_session": game_in_session, "prev_game_result": prev_result, "games_today": games_today}
        # result from erez's perspective
        w = r.get("winner")
        prev_result = 0.5 if not w else (1 if (w == "white") == (r["erez_color"] == "w") else 0)
        # end time: createdAt + sum of both clocks used is unknown here; use last ply clock as approximation
        last_end = r.get("lastMoveAt") or start
    return out


def main():
    import pandas as pd
    src = sys.argv[1] if len(sys.argv) > 1 else "scored"
    out = sys.argv[2] if len(sys.argv) > 2 else "decisions.parquet"
    recs = []
    for f in sorted(glob.glob(os.path.join(src, "*.jsonl"))):
        for line in open(f):
            if line.strip():
                recs.append(json.loads(line))
    # lastMoveAt is not in the scored record; approximate with createdAt (sessions still coherent)
    sessions = build_sessions(recs)
    rows = []
    for k, r in enumerate(recs):
        for focal in (r.get("focal_colors") or [r["erez_color"]]):
            for row in extract_game(r, sessions, focal):
                row["corpus"] = r.get("corpus", "erez281")
                row["player_key"] = (r["players"]["white" if focal == "w" else "black"].get("user", {}).get("id")) or f"{r['id']}:{focal}"
                rows.append(row)
        if (k + 1) % 200 == 0:
            sys.stderr.write(f"{k+1}/{len(recs)} games, {len(rows)} rows\n")
    df = pd.DataFrame(rows)
    df.to_parquet(out, index=False)
    sys.stderr.write(f"wrote {out}: {len(df)} rows, {len(df.columns)} cols\n")


if __name__ == "__main__":
    main()
