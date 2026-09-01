"""
THE SAME SEVENTEEN RULE CLASSES, SCORED AS A DECISION PROBLEM INSTEAD OF A COIN FLIP.

WHAT THIS REPLACES, AND WHY IT IS NOT A SECOND OPINION ON THE SAME NUMBER.

`screen_rule_classes.py` asks one question of each item:

    IS THE ENGINE'S SINGLE BEST MOVE A MEMBER OF B?

That is `b_valid`, and every finding in `RULE_CLASS_SEARCH.md` rests on it. It is a top-1
agreement test, and top-1 agreement collapses two failures that are not the same failure:

  A  the rule prescribes an act that COSTS something. Following it is an error.
  B  the rule prescribes an act that is FINE, and the engine simply preferred another act that
     is also fine. Following it costs nothing.

`b_valid` scores both as 0. `RC-21 push-the-unstoppable-passer` is the case that makes this
impossible to ignore: the rule of the square is exactly true chess knowledge, pushing the passer
is never a blunder when the square says it queens, and `b_valid | T+` = .164. A player with an
unstoppable passer is usually winning several ways at once. The instrument called that a failed
rule class. It is not obvious that it is one.

SO THIS FILE MEASURES THE DECISION, NOT THE AGREEMENT. For every item:

    V*        = the value of the best legal move                    (what the position is worth)
    V_B       = the value of the best move that SATISFIES the rule  (what obeying is worth)
    V_notB    = the value of the best move that VIOLATES the rule   (what disobeying is worth)

and from those three, three quantities that answer three DIFFERENT questions:

    EFFICACY      regret_B = V* - V_B         Does obeying the rule cost anything?
    NECESSITY     advantage = V_B - V_notB    Does disobeying it cost anything?
    ROBUSTNESS    the distribution of V* - V(a) over EVERY a in B
                                              Is the whole permitted set safe, or only its best
                                              member?

WHY ALL THREE ARE NEEDED, AND WHY NONE OF THEM IS `b_valid`.

`b_valid` is recoverable from these: it is `regret_B == 0` measured by argmax rather than by
value. What it cannot express is the SIZE of the miss. A rule class with regret_B = 0 on every
item and advantage = 0 on every item is perfectly safe and teaches nothing -- it permits the best
move and so does everything else. A rule class with a large advantage and a large regret is
worth knowing and expensive to obey. Those are opposite objects and `b_valid` gives them the
same score whenever the argmax happens to land outside B.

    NOTE THAT EFFICACY AND NECESSITY ARE NOT INDEPENDENT EVIDENCE. Because
    V* = max(V_B, V_notB), exactly one of them is ever non-trivial on a given item:
    if the best move is in B then regret_B = 0 and advantage = V* - V_notB >= 0;
    if it is not, then advantage = -(regret_B) <= 0. They are one signed quantity read
    from two ends, and this file reports them as such rather than as two tests passed.
    What is genuinely independent is ROBUSTNESS, which is about the members of B that the
    player might pick and the other two never look at.

THE UTILITY SCALE, AND WHY CENTIPAWNS ARE KEPT BUT NOT TRUSTED ALONE.

Centipawns are not linear in anything a player cares about. +100 cp in a bare-king endgame is a
won game; +100 cp in a sharp middlegame is a small pull. `screen_rule_classes.py` encodes mate as
`MATE_SCORE = 100_000`, which is a ceiling chosen so a subtraction is defined at all -- and which
makes any mean containing a mate meaningless. Stockfish's own normalisation moved to win
probability for this reason.

So every quantity here is computed TWICE:

  cp    the published scale, kept so this run can be laid beside the published one
  xs    EXPECTED SCORE in [0, 1] -- (wins + draws/2) / 1000 from Stockfish's WDL model at the
        position's ply. A forced mate is 1.0 or 0.0 exactly, which is correct and which the cp
        scale cannot represent.

`xs` is the primary scale for every claim. `cp` is reported beside it and never averaged across
items containing a mate.

WHAT IS DELIBERATELY UNCHANGED FROM THE PUBLISHED SCREEN, so that a difference in the result is
a difference in the INSTRUMENT and not in the protocol:

  * the same corpus file, the same seed, the same sampler, the same 250 items per cell
  * the same per-candidate in-check exclusion
  * `b_valid` recomputed here BY THE PUBLISHED METHOD -- a single-PV search, its best move asked
    for membership in B -- so the reordering claim is a within-run comparison and not a
    comparison against numbers produced by another engine
  * `V_B` computed the way the published screen computed `best_satisfying_cp`: one root-restricted
    search at the full node budget

WHAT IS NEW: `V_notB` (one root-restricted search over the complement), the within-B value
distribution (one MultiPV search over B), a SIZE-MATCHED RANDOM PRESCRIPTION as a per-item chance
control (two more searches), and the expected-score scale. UP TO six searches per item against
the published screen's two -- the exact count is recorded per item, because an empty B or a
prescription covering every legal move skips one.

THE CHANCE CONTROL IS NOT OPTIONAL, AND THE FIRST SMOKE TEST IS WHY. B is small and its complement
is large, so V_B is searched deeper than V_notB at an equal node budget and `advantage` is biased
upward for every rule class. A random subset R of the legal moves with |R| = |B| carries no chess
knowledge at all, so whatever advantage R earns on that item is what the asymmetry plus luck is
worth. Every advantage below is reported raw AND minus its own chance control, paired item by
item. This is the value-scale counterpart of `prescription_size`, which is how the published
screen derives a chance rate for `b_valid` per item instead of inventing one.

NO THRESHOLD IS INVENTED HERE EITHER. The two anchors do the same work they do in the published
screen -- `RC-00 mate-in-one` as the ceiling and `RC-01 loose-piece`, the refuted incumbent, as
the floor -- and every candidate is placed between them on each of the three quantities. The one
absolute number used anywhere is 100 cp, and it is not new: it is the convention the published
screen already reports (`following_the_rule_loses_100cp_or_more`), reused so the two documents
speak the same units.

    python action_set.py --items rc.jsonl --manifest rc_manifest.json \\
        --engine /usr/games/stockfish --sample 250 --nodes 200000 --workers 4 \\
        --seed 20260831 --out action_set.json
"""

from __future__ import annotations

import argparse
import atexit
import collections
import json
import multiprocessing as mp
import random
import sys
import time
from pathlib import Path

import chess
import chess.engine

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rule_classes import BY_ID, RULE_CLASSES, Context  # noqa: E402
from sdt import wilson_interval  # noqa: E402

#: Same encoding as the published screen, and the same warning: this is a ceiling that makes a
#: subtraction defined, not a material quantity. Every cp aggregate below is a MEDIAN or a
#: quantile for this reason; no mean of a cp column is reported anywhere in this file.
MATE_SCORE = 100_000

#: Stockfish's own win-probability model, selected to match the engine actually running. If the
#: engine build changes, this must change with it, and the run manifest records both.
WDL_MODEL = "sf16"

#: The one absolute cp number in this file, and it is not new -- `screen_rule_classes.py` already
#: reports `following_the_rule_loses_100cp_or_more`. Reused so both documents mean the same thing
#: by "a real error".
BLUNDER_CP = 100


def rate(k: int, n: int) -> dict:
    lo, hi = wilson_interval(k, n)
    return {"k": k, "n": n, "p": (k / n) if n else None, "ci95": [lo, hi]}


def _ctx_of(rec: dict) -> Context:
    prev = rec.get("prev_move")
    return Context(
        prev_move=chess.Move.from_uci(prev) if prev else None,
        prev_was_capture=bool(rec.get("prev_was_capture", 0)),
    )


def _expected_score(pov_score, ply: int) -> float:
    """
    THE DECISION UTILITY, in [0, 1], from the side to move's point of view.

    A forced mate is 1.0 and a forced loss is 0.0 EXACTLY. That is the property the cp scale
    cannot have, and it is why this is the primary scale: on a rule class about mate threats,
    every interesting item contains a mate score, and the cp encoding of those items is an
    arbitrary constant.
    """
    if pov_score.is_mate():
        mate = pov_score.mate()
        if mate is None:
            return None
        return 1.0 if mate > 0 else 0.0
    wdl = pov_score.wdl(model=WDL_MODEL, ply=ply)
    return (wdl.wins + wdl.draws / 2) / (wdl.wins + wdl.draws + wdl.losses)


def _value(pov_score, ply: int) -> tuple:
    """(cp, expected_score) for one score, both from the mover's point of view."""
    return pov_score.score(mate_score=MATE_SCORE), _expected_score(pov_score, ply)


def _best_over(engine, board, limit, moves, ply):
    """Value of the best move in `moves`, at the FULL node budget. `moves` empty -> (None, None)."""
    if not moves:
        return None, None
    info = engine.analyse(board, limit, root_moves=list(moves))
    return _value(info["score"].pov(board.turn), ply)


def _count(n: int, moves) -> int:
    """
    A search is only spent when the root set is non-empty, so SEARCHES ARE COUNTED PER ITEM AND
    NEVER MULTIPLIED. The number varies -- an empty B, an empty complement, or a prescription
    covering every legal move each skip one -- and a fixed multiplier in the manifest would be a
    wrong number stated with confidence, which is the one kind of number this program does not
    publish.
    """
    return n + (1 if moves else 0)


def _max_defined(*vals):
    vals = [v for v in vals if v is not None]
    return max(vals) if vals else None


#: One engine per WORKER PROCESS, opened once and reused across every chunk that worker is handed.
#: The first version opened and quit an engine per chunk, which forced chunks to be enormous --
#: one quarter of the run each -- and an enormous chunk is why the first hour-long run had NO
#: PROGRESS SIGNAL AT ALL: `Pool.map` returns when everything is finished, so a run that died at
#: minute fifty would have had nothing to show for fifty minutes. A persistent engine makes small
#: chunks cheap, and small chunks are what make progress reportable and partial results writable.
_ENGINE = None


def _init_engine(engine_path: str) -> None:
    """Pool initializer: open this process's engine once and leave it open."""
    global _ENGINE
    # The 600s timeout is inherited from the published screen and for the same reason: four
    # single-threaded engines on four cores make a 200,000-node search take longer in wall time
    # than it takes in work, and python-chess reads a slow reply as a dead engine.
    _ENGINE = chess.engine.SimpleEngine.popen_uci(engine_path, timeout=600.0)
    _ENGINE.configure({"Threads": 1, "Hash": 64})
    atexit.register(_close_engine)


def _close_engine() -> None:
    global _ENGINE
    if _ENGINE is not None:
        try:
            _ENGINE.quit()
        except Exception:  # noqa: BLE001 - a dead engine at shutdown is not a result
            pass
        _ENGINE = None


def _adjudicate_chunk(args) -> list[dict]:
    """
    One worker: its own engine, its own slice, no shared state. Up to six searches per item.

    THE PARTITION IS THE BASIS, NOT THE FULL-WIDTH SEARCH, and the first smoke test is why.
    A root-restricted search at the same node budget spends the whole budget on fewer root moves
    and so goes deeper on each; asking a full-width search for V* and a restricted search for V_B
    produced V_B > V* on real items -- a NEGATIVE regret, which is not a quantity. Every legal
    move is in exactly one of B and its complement, so

        V* := max(V_B, V_notB)

    is definitionally correct AND puts both terms on one search basis. regret_B >= 0 then holds by
    construction rather than by hope. The full-width search is still run, because `b_valid` is
    defined by the published screen as "the engine's own best move, from its own search, is a
    member of B" and this run must reproduce that method exactly; its value is kept as
    `v_full_cp` so the size of the basis discrepancy is visible rather than hidden.

    AND THE DEPTH ASYMMETRY IS MEASURED, NOT ASSUMED AWAY. B is usually small and its complement
    is usually large, so V_B is searched deeper than V_notB and `advantage` is biased UPWARD for
    every rule class by an amount nobody has measured. The control is a SIZE-MATCHED RANDOM
    PARTITION: draw R uniformly from the legal moves with |R| = |B|, deterministically seeded from
    the position, and compute the same advantage for it. R encodes no chess knowledge whatsoever,
    so whatever advantage R earns is what the asymmetry plus chance is worth on this item. It is
    the value-scale counterpart of `prescription_size`, which is how the published screen derives
    a chance rate for `b_valid` per item instead of inventing one.
    """
    engine_path, nodes, chunk = args
    # Under the pool the initializer has already opened this process's engine. Called directly --
    # which the smoke tests do -- there is no initializer, so one is opened here and closed on
    # exit by the same atexit hook.
    if _ENGINE is None:
        _init_engine(engine_path)
    engine = _ENGINE
    limit = chess.engine.Limit(nodes=nodes)
    out = []
    build = engine.id.get("name", "unknown")
    for rec in chunk:
        rc = BY_ID[rec["rule_class"]]
        board = chess.Board(rec["fen"])
        ply = board.ply()
        ctx = _ctx_of(rec)
        satisfying = list(rc.satisfying_moves(board, ctx))
        legal = list(board.legal_moves)
        sat_set = set(satisfying)
        violating = [m for m in legal if m not in sat_set]

        row = {
            "rule_class": rec["rule_class"],
            "trigger_state": rec["trigger_state"],
            "fen": rec["fen"],
            "engine_build": build,
            "engine_nodes": nodes,
            "n_legal": len(legal),
            "n_satisfying": len(satisfying),
            "n_violating": len(violating),
            "prescription_size": (len(satisfying) / len(legal)) if legal else None,
            "observable_action": rec["observable_action"],
            "actor_elo": rec["actor_elo"],
        }

        try:
            # 1. `b_valid`, BY THE PUBLISHED METHOD. Single PV, full width, full budget, the
            #    engine's own best move asked for membership. Nothing here differs from
            #    `screen_rule_classes.py`; this row is what makes the reordering a comparison
            #    between instruments rather than between protocols.
            searches = 1
            info = engine.analyse(board, limit)
            pv = info.get("pv") or []
            best = pv[0] if pv else None
            v_full_cp, v_full_xs = _value(info["score"].pov(board.turn), ply)
            row["engine_best_move"] = best.uci() if best else None
            row["v_full_cp"], row["v_full_xs"] = v_full_cp, v_full_xs
            row["b_valid"] = int(bool(satisfying) and best is not None and best in sat_set)
            row["no_satisfying_move"] = int(not satisfying)
            row["no_violating_move"] = int(not violating)

            # 2-3. THE PARTITION. Two root-restricted searches at the full budget.
            v_b_cp, v_b_xs = _best_over(engine, board, limit, satisfying, ply)
            v_nb_cp, v_nb_xs = _best_over(engine, board, limit, violating, ply)
            searches = _count(_count(searches, satisfying), violating)
            v_star_cp = _max_defined(v_b_cp, v_nb_cp)
            v_star_xs = _max_defined(v_b_xs, v_nb_xs)

            row["v_b_cp"], row["v_b_xs"] = v_b_cp, v_b_xs
            row["v_nb_cp"], row["v_nb_xs"] = v_nb_cp, v_nb_xs
            row["v_star_cp"], row["v_star_xs"] = v_star_cp, v_star_xs
            # How far the full-width search disagrees with the partition it is supposed to
            # cover. Reported per item so a reader can see the search noise rather than
            # discover it in a negative regret.
            row["basis_gap_cp"] = (
                None if None in (v_full_cp, v_star_cp) else v_full_cp - v_star_cp)

            # EFFICACY: what obeying costs. >= 0 by construction now.
            row["regret_b_cp"] = None if None in (v_star_cp, v_b_cp) else v_star_cp - v_b_cp
            row["regret_b_xs"] = None if None in (v_star_xs, v_b_xs) else v_star_xs - v_b_xs
            # What disobeying costs, the same subtraction from the other end.
            row["regret_nb_cp"] = None if None in (v_star_cp, v_nb_cp) else v_star_cp - v_nb_cp
            row["regret_nb_xs"] = None if None in (v_star_xs, v_nb_xs) else v_star_xs - v_nb_xs
            # NECESSITY, signed: regret_nb - regret_b, i.e. V_B - V_notB.
            row["advantage_cp"] = None if None in (v_b_cp, v_nb_cp) else v_b_cp - v_nb_cp
            row["advantage_xs"] = None if None in (v_b_xs, v_nb_xs) else v_b_xs - v_nb_xs

            # 4-5. THE CHANCE CONTROL. A size-matched random prescription, seeded from the
            #      FEN so the draw is reproducible and independent of worker scheduling.
            if satisfying and violating and len(satisfying) < len(legal):
                rng = random.Random(f"{rec['fen']}|{len(satisfying)}")
                r_set = set(rng.sample(range(len(legal)), len(satisfying)))
                rand_b = [m for i, m in enumerate(legal) if i in r_set]
                rand_nb = [m for i, m in enumerate(legal) if i not in r_set]
                v_r_cp, v_r_xs = _best_over(engine, board, limit, rand_b, ply)
                v_rn_cp, v_rn_xs = _best_over(engine, board, limit, rand_nb, ply)
                searches += 2
                row["chance_advantage_cp"] = (
                    None if None in (v_r_cp, v_rn_cp) else v_r_cp - v_rn_cp)
                row["chance_advantage_xs"] = (
                    None if None in (v_r_xs, v_rn_xs) else v_r_xs - v_rn_xs)
                row["chance_regret_cp"] = (
                    None if None in (v_r_cp, v_rn_cp) else max(v_r_cp, v_rn_cp) - v_r_cp)
                row["chance_regret_xs"] = (
                    None if None in (v_r_xs, v_rn_xs) else max(v_r_xs, v_rn_xs) - v_r_xs)
            else:
                row["chance_advantage_cp"] = row["chance_advantage_xs"] = None
                row["chance_regret_cp"] = row["chance_regret_xs"] = None

            # 6. ROBUSTNESS. MultiPV over B ONLY -- a handful of moves, so each line still
            #    gets a real share of the budget. This is the only search of the six that
            #    looks at a member of B other than its best one, and it asks the question
            #    `b_valid` cannot be made to answer: is the PERMITTED SET safe to teach, or
            #    does it merely contain a good move somewhere inside it?
            if satisfying:
                lines = engine.analyse(
                    board, limit, root_moves=satisfying, multipv=len(satisfying))
                searches += 1
                per_move = []
                for ln in lines:
                    lpv = ln.get("pv") or []
                    if not lpv:
                        continue
                    c, x = _value(ln["score"].pov(board.turn), ply)
                    per_move.append({"move": lpv[0].uci(), "cp": c, "xs": x})
                row["within_b"] = per_move
                cps = [p["cp"] for p in per_move if p["cp"] is not None]
                xss = [p["xs"] for p in per_move if p["xs"] is not None]
                row["worst_in_b_cp"] = min(cps) if cps else None
                row["worst_in_b_xs"] = min(xss) if xss else None
                row["max_regret_in_b_cp"] = (
                    None if row["worst_in_b_cp"] is None or v_star_cp is None
                    else v_star_cp - row["worst_in_b_cp"])
                row["max_regret_in_b_xs"] = (
                    None if row["worst_in_b_xs"] is None or v_star_xs is None
                    else v_star_xs - row["worst_in_b_xs"])
            else:
                row["within_b"] = []
                row["worst_in_b_cp"] = row["worst_in_b_xs"] = None
                row["max_regret_in_b_cp"] = row["max_regret_in_b_xs"] = None
            row["searches"] = searches

        except chess.engine.EngineError as exc:
            # ONE BAD POSITION MAY NOT DESTROY THE RUN. Recorded with its reason and excluded
            # from the rates, where a reader can count them rather than wonder why a
            # denominator moved.
            row = {
                "rule_class": rec["rule_class"], "trigger_state": rec["trigger_state"],
                "fen": rec["fen"], "engine_failed": str(exc),
            }
        out.append(row)
    return out


# ---------------------------------------------------------------- aggregation
# EVERY cp AGGREGATE IS A QUANTILE. A mean over a column that encodes mate as 100,000 is not a
# quantity; it is a count of mates wearing a decimal point. The `xs` columns are bounded in
# [0, 1] and are meaned freely.

def _quantiles(xs, with_mean: bool = False) -> dict:
    """
    Quantiles always; a mean ONLY when the caller says the scale is bounded. `with_mean=True` is
    passed for `xs` columns, which live in [0, 1], and never for `cp` columns, where a mean would
    be a count of mates wearing a decimal point.
    """
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return {"n": 0, "median": None, "q1": None, "q3": None, "p90": None}
    def q(f):
        return xs[min(len(xs) - 1, int(f * len(xs)))]
    out = {"n": len(xs), "median": q(0.5), "q1": q(0.25), "q3": q(0.75), "p90": q(0.90)}
    if with_mean:
        out["mean"] = sum(xs) / len(xs)
        # THE xs SCALE SATURATES, AND THAT IS THE POINT. In a position already won or already
        # lost every legal move scores the same expected score, so advantage and regret are
        # exactly 0 and the median can be 0 while a minority of items carry the whole signal.
        # The share of items where the quantity is not identically zero is reported so a median
        # of 0.000 cannot be read as "no effect" when it means "no effect on most items".
        out["share_nonzero"] = sum(1 for v in xs if v != 0) / len(xs)
    return out


def _share(rows, pred) -> dict:
    """A rate over the items where the quantity is defined, with the denominator shown."""
    usable = [r for r in rows if pred(r) is not None]
    return rate(sum(1 for r in usable if pred(r)), len(usable))


def _cell(rows: list[dict]) -> dict:
    n = len(rows)

    def defined(key):
        return lambda r: (None if r.get(key) is None else True)

    return {
        "n": n,
        # Recomputed by the published method so the two runs can be laid side by side.
        "b_valid": rate(sum(r["b_valid"] for r in rows), n),
        "no_satisfying_move": rate(sum(r["no_satisfying_move"] for r in rows), n),
        "no_violating_move": rate(sum(r.get("no_violating_move", 0) for r in rows), n),

        # EFFICACY -- what obeying costs.
        "regret_b_cp": _quantiles([r.get("regret_b_cp") for r in rows]),
        "regret_b_xs": _quantiles([r.get("regret_b_xs") for r in rows], with_mean=True),
        # The VALUE-based counterpart of b_valid: obeying is not merely the argmax, it loses
        # nothing. These differ exactly where two moves tie.
        "obeying_is_optimal": _share(
            rows, lambda r: None if r.get("regret_b_cp") is None else r["regret_b_cp"] <= 0),
        "obeying_loses_100cp_or_more": _share(
            rows, lambda r: None if r.get("regret_b_cp") is None
            else r["regret_b_cp"] >= BLUNDER_CP),

        # NECESSITY -- what disobeying costs. `advantage` is signed; `regret_nb` is its
        # non-negative twin read from the other end.
        "advantage_cp": _quantiles([r.get("advantage_cp") for r in rows]),
        "advantage_xs": _quantiles([r.get("advantage_xs") for r in rows], with_mean=True),
        "regret_nb_cp": _quantiles([r.get("regret_nb_cp") for r in rows]),
        "regret_nb_xs": _quantiles([r.get("regret_nb_xs") for r in rows], with_mean=True),
        "disobeying_loses_100cp_or_more": _share(
            rows, lambda r: None if r.get("regret_nb_cp") is None
            else r["regret_nb_cp"] >= BLUNDER_CP),

        # ROBUSTNESS -- what the WORST permitted move costs. Nothing else in this file or in the
        # published screen looks at a member of B other than its best one.
        "max_regret_in_b_cp": _quantiles([r.get("max_regret_in_b_cp") for r in rows]),
        "max_regret_in_b_xs": _quantiles(
            [r.get("max_regret_in_b_xs") for r in rows], with_mean=True),
        "worst_permitted_move_loses_100cp_or_more": _share(
            rows, lambda r: None if r.get("max_regret_in_b_cp") is None
            else r["max_regret_in_b_cp"] >= BLUNDER_CP),
        # Pooled over (item, permitted move) pairs rather than over items: the share of the
        # prescription that is safe, which is what a player picking inside B faces.
        "permitted_moves_safe": _pooled_within_b(rows),

        # THE CHANCE CONTROL, paired item by item. A size-matched random prescription carries no
        # chess knowledge, so its advantage is what the depth asymmetry between a small root set
        # and a large one is worth, plus luck. A rule class whose advantage does not exceed its
        # own chance advantage has not been shown to encode anything.
        "chance_advantage_xs": _quantiles(
            [r.get("chance_advantage_xs") for r in rows], with_mean=True),
        "chance_advantage_cp": _quantiles([r.get("chance_advantage_cp") for r in rows]),
        "chance_regret_xs": _quantiles(
            [r.get("chance_regret_xs") for r in rows], with_mean=True),
        "advantage_over_chance_xs": _paired_mean(rows, "advantage_xs", "chance_advantage_xs"),
        "regret_under_chance_xs": _paired_mean(rows, "chance_regret_xs", "regret_b_xs"),
        "basis_gap_cp": _quantiles([r.get("basis_gap_cp") for r in rows]),

        "prescription_size_median": _quantiles(
            [r.get("prescription_size") for r in rows])["median"],
    }


def _paired_mean(rows, a_key: str, b_key: str) -> dict:
    """
    Mean of (a - b) over the items where BOTH are defined, with its paired 95% interval.

    Paired rather than a difference of two marginal means, because the chance control is drawn on
    the same position as the rule and the two share every property of that position. n is the
    number of items that contributed, and it is smaller than the cell wherever B was empty or
    covered every legal move.
    """
    d = [r[a_key] - r[b_key] for r in rows
         if r.get(a_key) is not None and r.get(b_key) is not None]
    if not d:
        return {"n": 0, "mean": None, "ci95": [None, None]}
    n = len(d)
    mu = sum(d) / n
    if n < 2:
        return {"n": n, "mean": mu, "ci95": [None, None]}
    var = sum((x - mu) ** 2 for x in d) / (n - 1)
    se = (var / n) ** 0.5
    return {"n": n, "mean": mu, "ci95": [mu - 1.96 * se, mu + 1.96 * se]}


def _pooled_within_b(rows: list[dict]) -> dict:
    ok = tot = 0
    for r in rows:
        v = r.get("v_star_cp")
        if v is None:
            continue
        for p in r.get("within_b") or []:
            if p["cp"] is None:
                continue
            tot += 1
            ok += int(v - p["cp"] < BLUNDER_CP)
    return rate(ok, tot)


def _median(xs):
    return _quantiles(xs)["median"]


def _spearman(xs, ys):
    """Reported with its n and p, because a rho over seventeen chosen candidates is not a law --
    round 3 retracted round 2's headline for exactly that reason."""
    pairs = [(a, b) for a, b in zip(xs, ys) if a is not None and b is not None]
    if len(pairs) < 3:
        return {"rho": None, "p": None, "n": len(pairs)}
    from scipy import stats
    r = stats.spearmanr([p[0] for p in pairs], [p[1] for p in pairs])
    return {"rho": float(r.statistic), "p": float(r.pvalue), "n": len(pairs)}


# ---------------------------------------------------------------- the run
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--items", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--engine", required=True)
    ap.add_argument("--sample", type=int, default=250)
    ap.add_argument("--nodes", type=int, default=200_000)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--chunk", type=int, default=25,
                    help="items per unit of work; smaller means finer progress, not more engines")
    ap.add_argument("--seed", type=int, default=20260831)
    ap.add_argument("--out", required=True)
    ap.add_argument("--raw", help="optional JSONL of every adjudicated item, one row per line")
    ap.add_argument("--only", help="comma-separated rule class ids, for a control re-run")
    ap.add_argument("--head", type=int,
                    help="keep only the first N items of each (class, cell) AFTER sampling")
    a = ap.parse_args()

    items = [json.loads(l) for l in open(a.items, encoding="utf-8")]
    manifest = json.load(open(a.manifest, encoding="utf-8"))
    sampled_positions = manifest["positions_sampled"]
    in_check_positions = manifest["positions_in_check"]

    # THE SAMPLER IS COPIED FROM `screen_rule_classes.py` CALL FOR CALL, including the order of
    # the rng draws, because the claim this run makes is "the same items, scored differently".
    # A different draw would make every comparison below a comparison between two samples.
    rng = random.Random(a.seed)
    by_class = collections.defaultdict(list)
    for r in items:
        by_class[r["rule_class"]].append(r)

    to_adjudicate: list[dict] = []
    populations: dict[str, dict] = {}
    for rc in RULE_CLASSES:
        wants_check = rc.id == "RC-03"
        pool = [r for r in by_class[rc.id] if bool(r["in_check"]) == wants_check]
        denom = in_check_positions if wants_check else sampled_positions - in_check_positions
        pos = [r for r in pool if r["trigger_state"] == "positive"]
        neg = [r for r in pool if r["trigger_state"] == "negative"]
        populations[rc.id] = {
            "denominator_positions": denom,
            "base_rate_t_plus": rate(len(pos), denom),
            "base_rate_t_minus": rate(len(neg), denom),
        }
        for cell in (pos, neg):
            # THE FULL DRAW ALWAYS HAPPENS, FOR EVERY CLASS, IN THE PUBLISHED ORDER. `--only` and
            # `--head` filter AFTERWARDS and never touch the rng, so a control re-run at a larger
            # node budget lands on a SUBSET of the same items rather than on a different sample.
            # Filtering before the draw would change the sequence of rng calls and quietly make
            # the control a comparison between two samples instead of between two node budgets.
            to_adjudicate.extend(rng.sample(cell, min(a.sample, len(cell))))

    if a.only:
        keep = {x.strip() for x in a.only.split(",")}
        to_adjudicate = [r for r in to_adjudicate if r["rule_class"] in keep]
    if a.head:
        seen: dict = collections.defaultdict(int)
        kept = []
        for r in to_adjudicate:
            k = (r["rule_class"], r["trigger_state"])
            if seen[k] < a.head:
                seen[k] += 1
                kept.append(r)
        to_adjudicate = kept

    total = len(to_adjudicate)
    print(f"adjudicating {total} positions on {a.workers} engines (up to 6 searches each)",
          file=sys.stderr, flush=True)

    # SMALL CHUNKS, STREAMED. Interleaved so every chunk carries a mix of rule classes and no
    # worker is handed all of the expensive ones -- the MultiPV search runs over B, so a class
    # with a large prescription costs several times what a narrow one does, and a contiguous
    # split would leave one worker running long after the others had finished.
    chunks = [to_adjudicate[i::(max(1, total // a.chunk))] for i in
              range(max(1, total // a.chunk))]
    chunks = [c for c in chunks if c]

    adjudicated: list[dict] = []
    raw_fh = open(a.raw, "w", encoding="utf-8") if a.raw else None
    started = time.time()
    done = 0
    try:
        with mp.Pool(a.workers, initializer=_init_engine, initargs=(a.engine,)) as pool_:
            for part in pool_.imap_unordered(
                    _adjudicate_chunk, [(a.engine, a.nodes, c) for c in chunks]):
                adjudicated.extend(part)
                # THE PARTIAL RESULT IS ON DISK BEFORE THE RUN ENDS. An hour-long run that can
                # only be inspected once it succeeds is an hour that cannot be diagnosed.
                if raw_fh is not None:
                    for r in part:
                        raw_fh.write(json.dumps(r) + "\n")
                    raw_fh.flush()
                done += len(part)
                # NOT `rate`: that name belongs to the module-level Wilson-interval helper this
                # function calls a few lines later, and shadowing it raised UnboundLocalError on
                # the first validation run.
                throughput = done / max(1e-9, time.time() - started)
                print(f"  {done}/{total} items  {throughput:.2f}/s  "
                      f"eta {int((total - done) / max(1e-9, throughput))}s",
                      file=sys.stderr, flush=True)
    finally:
        if raw_fh is not None:
            raw_fh.close()

    engine_failures = [r for r in adjudicated if "engine_failed" in r]
    adjudicated = [r for r in adjudicated if "engine_failed" not in r]
    by_rc = collections.defaultdict(list)
    for row in adjudicated:
        by_rc[row["rule_class"]].append(row)

    report = {}
    for rc in RULE_CLASSES:
        rows = by_rc[rc.id]
        pos = [r for r in rows if r["trigger_state"] == "positive"]
        neg = [r for r in rows if r["trigger_state"] == "negative"]
        if not pos or not neg:
            report[rc.id] = {"name": rc.name, "family": rc.family, "verdict": "UNTESTED"}
            continue
        p, m = _cell(pos), _cell(neg)

        def sep(getter):
            x, y = getter(p), getter(m)
            return None if x is None or y is None else x - y

        report[rc.id] = {
            "name": rc.name,
            "family": rc.family,
            "role": rc.role,
            "prescription": rc.prescription,
            "t_plus": p,
            "t_minus": m,
            # THE PUBLISHED SEPARATION, recomputed here. Everything else in this block is new;
            # this row exists so the reordering is measured against a number from THIS run.
            "separation_b_valid": sep(lambda c: c["b_valid"]["p"]),
            # NECESSITY SEPARATION -- the direct replacement. The rule should buy something when
            # the trigger is present and nothing when it is absent.
            "separation_advantage_xs": sep(lambda c: c["advantage_xs"]["mean"]),
            "separation_advantage_cp": sep(lambda c: c["advantage_cp"]["median"]),
            # EFFICACY SEPARATION -- obeying should be cheap under T+ and expensive under T-.
            # Signed so that positive means "the rule costs more when it should not fire", which
            # is the direction a usable rule class needs. The mean is used on the xs scale rather
            # than the median because the scale saturates: in a decided position every move
            # scores the same and the item contributes an exact 0, so a median of 0 is common and
            # says nothing about the items that carry the signal.
            "separation_regret_xs": sep(lambda c: -c["regret_b_xs"]["mean"]),
            "separation_regret_cp": sep(lambda c: -c["regret_b_cp"]["median"]),
            # THE SAME TWO SEPARATIONS AGAIN, WITH CHANCE SUBTRACTED ITEM BY ITEM. This is the
            # column a candidate has to win on: a rule class that beats a size-matched random
            # prescription by nothing has not been shown to carry chess knowledge, whatever its
            # raw advantage.
            "separation_advantage_over_chance_xs": sep(
                lambda c: c["advantage_over_chance_xs"]["mean"]),
            "t_plus_advantage_over_chance_xs": p["advantage_over_chance_xs"],
            "t_minus_advantage_over_chance_xs": m["advantage_over_chance_xs"],
        }

    # ---- placement between the two anchors, on every quantity rather than only on b_valid.
    for key in ("separation_b_valid", "separation_advantage_xs", "separation_regret_xs",
                "separation_advantage_over_chance_xs"):
        ceil_ = report.get("RC-00", {}).get(key)
        floor_ = report.get("RC-01", {}).get(key)
        for r in report.values():
            v = r.get(key)
            r[f"anchor_{key}"] = (
                None if None in (v, ceil_, floor_) or ceil_ == floor_
                else (v - floor_) / (ceil_ - floor_)
            )

    # ---- DOES THE INSTRUMENT REORDER THE TABLE? This is the question the run exists to answer,
    # and it is a rank correlation between two columns of the SAME run, not between two studies.
    ids = [rc.id for rc in RULE_CLASSES if "t_plus" in report.get(rc.id, {})]
    col = lambda k: [report[i][k] for i in ids]  # noqa: E731
    reordering = {
        "n_rule_classes": len(ids),
        "b_valid_vs_advantage": _spearman(col("separation_b_valid"), col("separation_advantage_xs")),
        "b_valid_vs_efficacy": _spearman(col("separation_b_valid"), col("separation_regret_xs")),
        "advantage_vs_efficacy": _spearman(
            col("separation_advantage_xs"), col("separation_regret_xs")),
        "b_valid_vs_advantage_over_chance": _spearman(
            col("separation_b_valid"), col("separation_advantage_over_chance_xs")),
        "rank_by_b_valid": [i for i in sorted(
            ids, key=lambda i: (report[i]["separation_b_valid"] is None,
                                -(report[i]["separation_b_valid"] or 0)))],
        "rank_by_advantage": [i for i in sorted(
            ids, key=lambda i: (report[i]["separation_advantage_xs"] is None,
                                -(report[i]["separation_advantage_xs"] or 0)))],
        "rank_by_advantage_over_chance": [i for i in sorted(
            ids, key=lambda i: (report[i]["separation_advantage_over_chance_xs"] is None,
                                -(report[i]["separation_advantage_over_chance_xs"] or 0)))],
        "rank_by_efficacy": [i for i in sorted(
            ids, key=lambda i: (report[i]["separation_regret_xs"] is None,
                                -(report[i]["separation_regret_xs"] or 0)))],
        "reading": (
            "A high rho means the decision model AGREES with the top-1 screen and the published "
            "ordering stands. A low rho means the published ordering is an artefact of measuring "
            "argmax agreement instead of value, and every design rule inferred from that ordering "
            "was inferred from the wrong column."
        ),
    }

    # The per-item records were written as each chunk landed, above. Every aggregate below is a
    # summary of those rows, and a summary nobody can go behind is an assertion.

    out = {
        "action_set_version": "1.0.0",
        "what_this_is": (
            "The same seventeen rule classes and the same sampled items as the published screen, "
            "scored as a decision problem: efficacy (what obeying costs), necessity (what "
            "disobeying costs) and robustness (what the worst permitted move costs), in expected "
            "score as well as centipawns."
        ),
        "engine": {"nodes": a.nodes, "workers": a.workers, "wdl_model": WDL_MODEL,
                   "build": next((r["engine_build"] for r in adjudicated
                                  if "engine_build" in r), None)},
        "provenance_warning": (
            "THIS IS NOT THE PUBLISHED ENGINE. The published screen ran Stockfish 17.1 at 200,000 "
            "nodes; this run's build is recorded above. Every comparison in this file is therefore "
            "WITHIN this run -- b_valid is recomputed here by the published method so that the "
            "reordering is measured against a column produced by the same engine. No number here "
            "may be subtracted from a number in RULE_CLASS_SEARCH.md."
        ),
        "sample_per_cell": a.sample,
        "seed": a.seed,
        "items_adjudicated": len(adjudicated),
        "searches": sum(r.get("searches", 0) for r in adjudicated),
        "searches_per_item_median": _quantiles(
            [r.get("searches") for r in adjudicated])["median"],
        "engine_failures": len(engine_failures),
        "corpus": manifest,
        "rule_classes": report,
        "reordering": reordering,
    }
    Path(a.out).write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"wrote {a.out}: {len(adjudicated)} items, {len(engine_failures)} engine failures",
          file=sys.stderr)


if __name__ == "__main__":
    main()
