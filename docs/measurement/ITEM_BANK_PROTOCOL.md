# Item bank protocol

**Status: SPECIFIED, NOT BUILT.** [`CONSTRUCT_DECISION.md`](CONSTRUCT_DECISION.md) does not
authorise a scored bank for the construct as stated. This file exists because Phase 5's conditions
are what a bank would have to meet, and writing them *after* a bank exists is how retrospective
relabelling happens. It is the specification a future bank is graded against, and the reason the
current one may not be built yet is recorded in it.

---

## The hard requirements, and what each is defending against

| # | requirement | the failure it prevents |
| --- | --- | --- |
| 1 | **T is assigned before any participant behaviour is seen.** | T drifting toward whatever the participants did |
| 2 | **B is assigned without post-reveal information.** No engine, no result, no opponent reply. | scoring "was it a good move" and calling it "did they apply the rule" |
| 3 | **Source and adjudication are reproducible.** Every item carries game id, ply, FEN, predicate version, oracle build and budget. | a number nobody can recompute |
| 4 | **`UNKNOWN` items never enter scored analysis.** | a denominator that quietly changes with the data |
| 5 | **Exclusion rules are frozen before participant data.** | excluding the items that came out wrong |
| 6 | **Human or manual overrides are logged**, with who, when, why. | an invisible second labeller |
| 7 | **No retrospective relabelling.** A definition change is a new `board_predicate_version` and a new bank. | one bank with two meanings |
| 8 | **No oracle that interprets an item may define it.** | [F4](FALSIFICATION_REGISTER.md#f4) |

Requirement 8 has a concrete, measured instance. The Lichess `hangingPiece` theme is computed in
`lichess-puzzler/tagger/cook.py` from `puzzle.mainline[1].move` — **the solution's first move** —
and from the material balance two plies later. It is a property of (position + solution +
continuation), not of a position. **Using it to assign T puts B inside T.** It may be used as an
independent label to *disagree* with, and that is all.

---

## What is frozen, and its hash

The predicate was written and hashed **before** any label was read; that ordering is what makes
[F1](FALSIFICATION_REGISTER.md#f1) a test rather than a demonstration.

| artifact | sha256 | role |
| --- | --- | --- |
| `research/measurement/predicates.py` | `91f6549d3e6f763757559644f800eab97628b897a4b488d7df6405fd4370de48` | **the trigger definition.** Board geometry and legality only |
| `research/measurement/oracles.py` | `ff82265c8c08b96a40ddacc26e570e55dfedf845febd8c26d16e837a2a7ce0b5` | SEE and Stockfish, each in its own field |
| `research/measurement/sdt.py` | `13eaa5c1761222a5483811d4390ed2dfd1fd9ce5cb6090231abf90a972cfef47` | scoring arithmetic |
| `research/measurement/sdt.ts` | `4f03ab6c1b80d59f51a0b53d2e3357c7e12b82c1bc85eb9ef50db8d1be37e14c` | the port, differenced against the above |
| `research/measurement/scan_games.py` | `61ba057538ab12150a397312e4b612e2eaafe30ba016e85d46afb4b2800f4747` | the unlabelled corpus walk |
| `research/measurement/scan_puzzles.py` | `1cf8926b725fcb0a83420777c91767721f944b0fdecd01f9d756d5ce0056b08d` | the label join, written after the above |

`board_predicate_version` is **`1.0.0`**. A change to `predicates.py` requires a version bump;
items carrying different versions are different populations and are never pooled.

---

## The schema

Extends the schema Phase 5 proposes. Every added field is a defence against something measured, and
the note says which.

```ts
interface Item {
  item_id: string;
  source: "lichess_db_standard_rated_YYYY-MM" | "lichess_db_puzzle" | "constructed";
  source_game_id: string;
  source_ply: number;
  original_fen: string;

  matched_pair_id: string | null;

  trigger_state: "positive" | "negative" | "unknown";

  target_square: string;
  target_piece: string;
  target_value: number;
  observable_action: 0 | 1 | null;

  board_predicate_version: "1.0.0";

  geometric_defenders: number;
  defender_types: string[];
  attacker_count: number;
  legal_captures: number;

  // ADDED. The definition of "unprotected" is not unique, and which one was used is a fact
  // about the item. Lichess counts ray defence; predicates.py counts direct attacks. Measured
  // divergence: 0.64% of T+ items flip. Small -- and recorded, because "small" is a
  // measurement and not a property of the word.
  defence_definition: "direct-attackers-only" | "lichess-ray-defence";
  defended_under_ray_rule: boolean;

  see_result: number | null;
  see_version: "swap-algorithm-1.0.0" | null;

  engine_result: { best_move: string; best_cp: number | null; best_mate: number | null } | null;
  engine_capture_cp: number | null;
  engine_capture_cp_loss: number | null;
  engine_build: string | null;
  engine_depth_or_nodes: number | null;

  lichess_themes: string[];
  // ADDED, and it is a warning label rather than a field: this theme is computed from the
  // SOLUTION MOVE. It may never be read by anything that assigns trigger_state.
  lichess_theme_is_solution_conditioned: true;

  competing_motifs: {
    mate_in_1_available: boolean;
    capture_gives_check: boolean;
    larger_capture_elsewhere: boolean;
    target_capture_is_also_fork: boolean | null;   // null = not adjudicated
    target_capture_is_also_discovery: boolean | null;
  };

  // ADDED. The F2 covariates, on the item, so balance is checkable without recomputing.
  covariates: {
    n_legal_moves: number; n_legal_captures: number; n_checks_available: number;
    n_mate_in_1: number; n_forcing_moves: number; piece_count: number;
    material_balance: number; total_material: number; phase: "opening"|"middlegame"|"endgame";
    fullmove_number: number;
  };

  human_adjudication: {
    verdict: "rule-applies" | "rule-does-not-apply" | "ambiguous" | "UNKNOWN";
    adjudicator_id: string | null;
    at: string | null;
    reason: string | null;
  };

  exclusion_reasons: string[];
  preregistered_before_behavior: true;
}
```

**`observable_action` is nullable and `null` is not zero.** An item with no designated target has
no B. Recording `0` would count "there was nothing to do" as "they did not do it".

---

## Sampling frame

**Representative, in Brunswik's sense (Dhami, Hertwig & Hoffrage 2004), or explicitly not.**

- **Frame A — representative.** Uniform random (game, ply) from an unfiltered month of rated games.
  This is what `scan_games.py` does. It is the only frame from which a statement about *ordinary
  play* can be made.
- **Frame B — curated.** Lichess puzzles. **Range-restricted by construction:**
  `generator.py::is_valid_attack` keeps a candidate only when the best move beats the second-best
  by more than 0.7 in win-chance, or is the unique winning move, or is a valid mate-in-1. A bank
  drawn here contains only positions with one overwhelming answer, which ordinary chess does not.
- **Frame C — constructed.** Minimal transformations of Frame A positions, in the spirit of
  Sheridan & Reingold. **Not built.** [F2](FALSIFICATION_REGISTER.md#f2) records why: a legal
  transformation is not automatically chess-plausible, and each edit has to be shown not to have
  introduced a new tactical explanation — which needs the adjudication the bank does not have.

A bank may not mix frames. A frame is a property of a study, not of an item.

---

## Exclusion rules, frozen

Applied in this order, each recorded on the item rather than dropping it silently:

1. Side to move is in check → excluded. A forced reply is not a free choice.
2. Two or more loose targets → `UNKNOWN`. `capture(target)` is not well defined.
3. No capturable non-pawn opponent piece → `UNKNOWN`. Nothing to discriminate.
4. Ply < 2 → excluded. Book by construction.
5. Either player unrated → excluded from any rating-conditioned analysis; retained otherwise.
6. `human_adjudication.verdict == "ambiguous"` → excluded from scoring, retained in the bank.

**Rules 1–4 were frozen in `scan_games.py` before the first scan and have not moved.** Rules 5–6
apply to a human study that has not run.

---

## Verification and regeneration

```bash
# the corpora (network + ~40 min; nothing in this repository depends on them existing)
curl -O https://database.lichess.org/standard/lichess_db_standard_rated_2013-01.pgn.zst
curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst

python research/measurement/scan_games.py   --pgn lichess_db_standard_rated_2013-01.pgn.zst \
    --max-games 60000 --per-game 3 --seed 20260831 --out games.jsonl --manifest games_manifest.json
python research/measurement/scan_puzzles.py --csv lichess_db_puzzle.csv.zst \
    --sample-every 40 --out puzzles.jsonl --manifest puzzles_manifest.json

python research/measurement/enrich.py --in games.jsonl --out games_enriched.jsonl \
    --engine ./stockfish --engine-sample 600 --engine-nodes 200000 --seed 20260831
python research/measurement/enrich.py --in puzzles.jsonl --out puzzles_enriched.jsonl \
    --fen-field puzzle_fen

python research/measurement/analyse.py --games games_enriched.jsonl \
    --puzzles puzzles_enriched.jsonl --out results.json --sample 4000 --seed 20260831
python research/measurement/narrow.py  --games games_enriched.jsonl \
    --puzzles puzzles_enriched.jsonl --out narrow.json --seed 20260831
python research/measurement/definition_variance.py --games games.jsonl --out definition_variance.json
```

Regenerating the cross-language equivalence fixture that `tests/research/measurement-sdt.test.ts`
asserts against:

```python
import sys, json; sys.path.insert(0, "research/measurement")
from sdt import Counts, compute, wilson_interval
# cases as listed in equivalence/sdt_grid.json; write hit_rate, false_alarm_rate,
# d_prime, criterion_c, beta, a_prime, b_double_prime_d and the Wilson bounds for each.
```

The fixture is generated **by the Python**, never edited by hand. Editing it to match a broken port
is the one move that would make having two implementations worse than having one.

---

## Reproducibility of the runs behind the register

| | value |
| --- | --- |
| games corpus | `lichess_db_standard_rated_2013-01.pgn.zst`, 17,761,302 bytes |
| games read / used | 60,834 / 60,000 |
| positions sampled | 167,881 (3 per game, uniform over plies ≥ 2, seed `20260831`) |
| records written | 57,504 (T+ 11,752 / T− 45,752) |
| puzzle corpus | `lichess_db_puzzle.csv.zst`, 304,384,407 bytes, last-modified 2026-08-02 |
| puzzle rows / sampled | 6,100,960 / 152,524 (every 40th, systematic) |
| puzzle records written | 77,978 |
| engine | Stockfish 17.1 (ubuntu-x86-64-avx2), 200,000 nodes, Threads 1, Hash 64 MB |
| engine-scored subsample | 600 T+ and 600 T−, seed `20260831` |

**The 2013 dump is old, and that is a limitation with a direction:** the rating distribution of
Lichess in 2013 is not today's, so every rate here describes 2013 players. It was chosen because it
is the smallest published month and this analysis needs a *population*, not a large one. Recorded
as an open threat in the register rather than as a footnote.
