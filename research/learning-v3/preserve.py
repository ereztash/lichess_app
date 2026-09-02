"""
TURN AN HOUR OF STOCKFISH INTO AN ASSET INSTEAD OF A NUMBER.

WHAT THIS IS NOT. It performs no search, changes no predicate, and reads no protocol. Every value it
writes was already computed by `research/measurement/action_set.py` and is being copied, joined or
hashed. `RNL-11` -- do not change the intervention and the instrument together -- is the reason this
is a separate program run afterwards rather than an edit to the instrument: both engine runs in this
cycle were produced by ONE version of `action_set.py`, and enriching its output in place would have
made the second run's provenance differ from the first's for no measurement gain.

WHAT THE RUN ACTUALLY BOUGHT, stated precisely, because the difference between this and what a
reader might assume is the whole point of preserving it:

  PER (position, move), FOR EVERY MEMBER OF B          a real evaluation. `within_b` is a MultiPV
                                                       over the permitted set, so each permitted
                                                       move has its own cp and expected score.
  PER position                                         the full-width search: the engine's own best
                                                       move and the position's value.
  PER (position, move SET)                             root-restricted maxima: V_B over B, V_notB
                                                       over its complement, and the two halves of
                                                       the size-matched chance partition.

  NOT BOUGHT: a value for each individual move OUTSIDE B. The complement was searched as a set and
  only its maximum was kept. Recovering per-move values there is new engine work, and this file
  says so rather than leaving a reader to infer it from an absent column.

THE CACHE IDENTITY IS CONTENT-ADDRESSED, so a later run can ask "has this already been evaluated?"
without trusting a filename or a run order:

    move_eval  sha256("move|" + fen + "|" + uci + "|" + build + "|" + nodes + "|" + policy)
    set_eval   sha256("set|"  + fen + "|" + ",".join(sorted(uci)) + "|" + build + "|" + nodes + "|" + policy)

`policy` names HOW the number was obtained -- `multipv-over-B`, `full-width`, `root-restricted-max`
-- because the same position and the same move under a different search policy is a different
measurement and merging them would be the silent instrument change this repository keeps catching.

PROVENANCE IS RESTORED BY A JOIN, NOT BY A RE-SCAN. The raw rows carry the FEN but not the game they
came from; `rc.jsonl` carries both, keyed by (fen, rule_class), which the corpus manifest states is
unique -- "one record per (position, rule class that fired)". So the join is exact and free.

    python preserve.py --raw <action_set_raw.jsonl> --items rc.jsonl --run <action_set.json> \
        --corpus-manifest <corpus_manifest.json> --run-id <name> --out-dir <dir>
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import random
import time
from pathlib import Path

import chess

#: What `action_set.py` does with each kind of search. Recorded per evaluation so that two numbers
#: for the same (position, move) under different policies never collide in the cache.
POLICY_MULTIPV = "multipv-over-B"
POLICY_FULL = "full-width"
POLICY_SET_MAX = "root-restricted-max"


def h(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode()).hexdigest()


def position_id(fen: str) -> str:
    """A stable id for the position, from the parts of the FEN that define it."""
    return hashlib.sha256(fen.encode()).hexdigest()[:16]


def chance_partition(fen: str, n_satisfying: int, legal: list[chess.Move]) -> tuple[list, list]:
    """
    THE CHANCE DRAW, RECONSTRUCTED RATHER THAN STORED.

    `action_set.py` seeds it from the FEN and the size of B -- `random.Random(f"{fen}|{len(B)}")` --
    precisely so the draw is reproducible and independent of worker scheduling. So the two halves of
    the partition are recoverable here with no engine and no stored column. Their VALUES are not:
    the raw row keeps `chance_advantage` and `chance_regret`, which pin the difference and not the
    levels. That asymmetry is recorded in the manifest rather than papered over.
    """
    rng = random.Random(f"{fen}|{n_satisfying}")
    idx = set(rng.sample(range(len(legal)), n_satisfying))
    return ([m for i, m in enumerate(legal) if i in idx],
            [m for i, m in enumerate(legal) if i not in idx])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True, action="append",
                    help="action_set.py --raw JSONL; repeatable")
    ap.add_argument("--items", required=True, action="append",
                    help="the items file each raw was drawn from; repeatable, same order")
    ap.add_argument("--run", required=True, action="append", help="the aggregate JSON; repeatable")
    ap.add_argument("--run-id", required=True, action="append", help="a name per run; repeatable")
    ap.add_argument("--corpus-manifest", required=True)
    ap.add_argument("--log", action="append", default=[], help="the run log, for wall time")
    ap.add_argument("--out-dir", required=True)
    a = ap.parse_args()

    out = Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    corpus = json.load(open(a.corpus_manifest, encoding="utf-8"))

    evals_path = out / "engine_evaluations.jsonl"
    items_path = out / "item_bank.jsonl"
    evals = open(evals_path, "w", encoding="utf-8")
    bank = open(items_path, "w", encoding="utf-8")

    counts: collections.Counter = collections.Counter()
    per_class: dict = collections.defaultdict(lambda: collections.Counter())
    seen_keys: set[str] = set()
    collisions = 0
    started = time.time()

    for raw_path, items_path_in, run_path, run_id in zip(a.raw, a.items, a.run, a.run_id):
        run = json.load(open(run_path, encoding="utf-8"))
        build = (run.get("engine") or {}).get("build", "unknown")
        nodes = str((run.get("engine") or {}).get("nodes", ""))

        # THE JOIN, AND THE ASSUMPTION IT BROKE.
        #
        # The first version keyed on (fen, rule_class) because the corpus manifest says "one record
        # per (position, rule class that fired)". That is true of the SCAN and false of the SAMPLE:
        # two games that TRANSPOSE reach the same position, and the scan writes one record per game,
        # so 52 (class, position) pairs appear more than once among the 8,307 sampled items -- one
        # of them eleven times, all from the 1.e4 e5 2.Nf3 position, at Elos from 1204 to 1902.
        #
        # Keying on the position alone therefore stamped ONE game's id onto every row that shared a
        # FEN, which is a wrong provenance record rather than a missing one. `actor_elo` and
        # `observable_action` differ between those rows and are carried on the raw row, so the key
        # includes them; where even that leaves a tie the row is marked `provenance_ambiguous` and
        # every candidate game is listed, because naming one of eleven games would be a guess
        # wearing a field name.
        provenance: dict[tuple, list[dict]] = collections.defaultdict(list)
        for line in open(items_path_in, encoding="utf-8"):
            r = json.loads(line)
            provenance[(r["fen"], r["rule_class"], r.get("actor_elo"),
                        r.get("observable_action"))].append(r)

        for line in open(raw_path, encoding="utf-8"):
            row = json.loads(line)
            fen = row["fen"]
            cands = provenance.get(
                (fen, row["rule_class"], row.get("actor_elo"), row.get("observable_action")), [])
            src = cands[0] if cands else {}
            ambiguous = len(cands) > 1
            board = chess.Board(fen)
            legal = list(board.legal_moves)
            pid = position_id(fen)

            if row.get("engine_failed"):
                counts["items_engine_failed"] += 1
                continue
            counts["items"] += 1
            per_class[row["rule_class"]][row["trigger_state"]] += 1

            # B is recoverable from `within_b`, which lists every permitted move by name. Where B
            # was empty the row says so and there is nothing to list.
            within = row.get("within_b") or []
            satisfying = [p["move"] for p in within]

            def emit(kind: str, moves: list[str], policy: str, cp, xs, extra: dict | None = None):
                nonlocal collisions
                key = (h("move", fen, moves[0], build, nodes, policy) if kind == "move"
                       else h("set", fen, ",".join(sorted(moves)), build, nodes, policy))
                if key in seen_keys:
                    collisions += 1
                    counts["cache_hits"] += 1
                    return
                seen_keys.add(key)
                counts[f"eval_{kind}"] += 1
                evals.write(json.dumps({
                    "key": key,
                    "kind": kind,
                    "position_id": pid,
                    "fen": fen,
                    "moves": moves,
                    "policy": policy,
                    "engine_build": build,
                    "engine_nodes": int(nodes) if nodes else None,
                    "cp": cp,
                    "xs": xs,
                    "run_id": run_id,
                    **(extra or {}),
                }) + "\n")

            # 1. every member of B, with its own value and its rank inside B
            ranked = sorted(
                [p for p in within if p.get("xs") is not None],
                key=lambda p: p["xs"], reverse=True)
            rank_of = {p["move"]: i + 1 for i, p in enumerate(ranked)}
            for p in within:
                emit("move", [p["move"]], POLICY_MULTIPV, p.get("cp"), p.get("xs"),
                     {"satisfies_b": True, "rank_within_b": rank_of.get(p["move"]),
                      "n_in_b": len(within)})

            # 2. the full-width search: the engine's own best move and the position's value
            if row.get("engine_best_move"):
                emit("move", [row["engine_best_move"]], POLICY_FULL,
                     row.get("v_full_cp"), row.get("v_full_xs"),
                     {"satisfies_b": bool(row.get("b_valid")), "rank_within_b": None,
                      "is_engine_best": True})

            # 3. the set maxima. V_B and V_notB are levels and are kept as such; the two chance
            #    halves are reconstructed for identity but carry no level, and say so.
            violating = [m.uci() for m in legal if m.uci() not in set(satisfying)]
            if satisfying and row.get("v_b_xs") is not None:
                emit("set", satisfying, POLICY_SET_MAX, row.get("v_b_cp"), row.get("v_b_xs"),
                     {"role": "V_B"})
            if violating and row.get("v_nb_xs") is not None:
                emit("set", violating, POLICY_SET_MAX, row.get("v_nb_cp"), row.get("v_nb_xs"),
                     {"role": "V_notB"})
            if row.get("chance_advantage_xs") is not None and satisfying and violating:
                rb, rnb = chance_partition(fen, len(satisfying), legal)
                for role, ms in (("V_R", rb), ("V_notR", rnb)):
                    emit("set", [m.uci() for m in ms], POLICY_SET_MAX, None, None,
                         {"role": role,
                          "level_not_preserved": (
                              "action_set.py stored the chance ADVANTAGE and REGRET, which pin the "
                              "difference between the two halves and not their levels. The set "
                              "identity is reconstructible from the seeded draw; the value is not")})

            # 4. the item, with its provenance and its classification
            bank.write(json.dumps({
                "position_id": pid,
                "fen": fen,
                "rule_class": row["rule_class"],
                "trigger_state": row["trigger_state"],
                "source_game_id": src.get("source_game_id"),
                "source_ply": src.get("source_ply"),
                "provenance_ambiguous": ambiguous,
                "provenance_candidates": (
                    [{"game": c["source_game_id"], "ply": c["source_ply"]} for c in cands]
                    if ambiguous else None),
                "twin_of": src.get("twin_of"),
                "sham_of": src.get("sham_of"),
                "observable_action": row.get("observable_action"),
                "move_played": src.get("move_played"),
                "actor_elo": row.get("actor_elo"),
                "opponent_elo": src.get("opponent_elo"),
                "time_control": src.get("time_control"),
                "phase": src.get("phase"),
                "n_legal": row.get("n_legal"),
                "n_satisfying": row.get("n_satisfying"),
                "n_violating": row.get("n_violating"),
                "prescription_size": row.get("prescription_size"),
                "b_valid": row.get("b_valid"),
                "no_satisfying_move": row.get("no_satisfying_move"),
                "no_violating_move": row.get("no_violating_move"),
                "v_star_xs": row.get("v_star_xs"),
                "regret_b_xs": row.get("regret_b_xs"),
                "advantage_xs": row.get("advantage_xs"),
                "max_regret_in_b_xs": row.get("max_regret_in_b_xs"),
                "material_balance": src.get("material_balance"),
                "piece_count": src.get("piece_count"),
                "in_check": src.get("in_check"),
                "searches": row.get("searches"),
                "run_id": run_id,
            }) + "\n")

    evals.close()
    bank.close()

    wall = {}
    for log in a.log:
        try:
            text = Path(log).read_text()
        except OSError:
            continue
        last = [l for l in text.splitlines() if "items" in l and "/s" in l]
        wall[Path(log).name] = last[-1] if last else None

    manifest = {
        "version": "1.0.0",
        "what": "every engine evaluation this cycle bought, addressed by content so no future run repeats one",
        "built_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "build_seconds": round(time.time() - started, 1),
        "corpus": {k: corpus[k] for k in
                   ("games_seen", "games_used", "positions_sampled", "positions_in_check",
                    "records_written", "seed", "per_game", "rule_class_version") if k in corpus},
        "runs": [{"run_id": r, "aggregate": p} for r, p in zip(a.run_id, a.run)],
        "counts": dict(counts),
        "per_class": {k: dict(v) for k, v in per_class.items()},
        "cache_identity": {
            "move_eval": 'sha256("move|"+fen+"|"+uci+"|"+build+"|"+nodes+"|"+policy)',
            "set_eval": 'sha256("set|"+fen+"|"+",".join(sorted(uci))+"|"+build+"|"+nodes+"|"+policy)',
            "policies": [POLICY_MULTIPV, POLICY_FULL, POLICY_SET_MAX],
            "rule": ("no future research step may rerun an identical engine evaluation if the same "
                     "key already exists here"),
        },
        "what_was_not_preserved": [
            "a value for each individual move OUTSIDE B. The complement was searched as a SET and "
            "only its maximum kept, so per-move regret outside B is new engine work",
            "the levels of the two chance-partition halves. Their difference is preserved; their "
            "values are not, because action_set.py stored the derived quantities",
            "search depth. The search policy is a fixed node budget, which is preserved; the depth "
            "each search reached was not recorded by the instrument",
            "any evaluation under a WDL model other than sf16. The cp column is preserved, so a "
            "different mapping is a pure post-processing step and needs no engine",
        ],
        "wall_time_last_line": wall,
        "files": {},
    }
    for p in (evals_path, items_path):
        b = p.read_bytes()
        manifest["files"][p.name] = {"bytes": len(b), "sha256": hashlib.sha256(b).hexdigest(),
                                     "lines": b.count(b"\n")}
    json.dump(manifest, open(out / "MANIFEST.json", "w", encoding="utf-8"), indent=1)
    print(json.dumps({"counts": dict(counts), "collisions": collisions,
                      "files": manifest["files"]}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
