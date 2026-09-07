"""
THE FROZEN REPLICATION CONTRACT.

Every rule in this file is a research-semantic rule taken from the erez281 mission
(`research/mechanism/MISSION_LEDGER.md`, `NETA_FINDING.json`, `analysis/vocab.py`). Nothing here is
new. What changed is only that a rule which was expressed as the constant `erez281` (or as a
constant derived from that one account: a colour, a rating band, a corpus label, a file name) is now
expressed as a function of the FOCAL PLAYER.

The distinction this file enforces:

  * INFRASTRUCTURE hard-code  -- may be generalised (a path, a column name, a corpus label).
  * RESEARCH-SEMANTIC rule    -- may NOT change without an explicit, dated research decision.

Anything the baseline never wrote down is marked AMBIGUOUS_BASELINE and is resolved here only by
the weakest rule the already-frozen design implies, never by looking at a new player's data.

Provenance for every value is in the `PROVENANCE` table at the bottom, and in
`HARDCODE_AUDIT.md` beside it.
"""
from __future__ import annotations

CONTRACT_VERSION = "replication-1.0.0"

# --------------------------------------------------------------------------------------------------
# PLATFORMS
# --------------------------------------------------------------------------------------------------
# The mission fetched the personal corpus from the Lichess API. `chesscom/` records a separate
# cross-platform disposition and is NOT part of this contract's frozen path.
SUPPORTED_PLATFORMS = ("lichess",)

# --------------------------------------------------------------------------------------------------
# INGESTION (Phase 4) -- what is asked of the platform, verbatim from the frozen manifest's `source`
# --------------------------------------------------------------------------------------------------
LICHESS_EXPORT_QUERY = {
    "rated": "true",
    "clocks": "true",
    "opening": "true",
    "pgnInJson": "true",
    "sort": "dateDesc",
}
# research/mechanism/data/frozen_window_manifest.json .source is exactly this query on
# https://lichess.org/api/games/user/<username>

# --------------------------------------------------------------------------------------------------
# GAME-LEVEL ELIGIBILITY (Phase 5) -- `admissible()` in scripts/build_import_corpus.ts, inherited by
# scripts/build_account_corpus.ts, which is the rule that produced the frozen 2,209-game window.
# --------------------------------------------------------------------------------------------------
GAME_ELIGIBILITY = {
    "termination": "Normal",          # excludes Abandoned (124) and Time forfeit (724) in the baseline
    "requires_clock_annotations": True,  # the PGN must contain %clk
    "min_plies_with_clock": 20,       # MIN_PLIES in build_import_corpus.ts; 134 rejected in the baseline
    "rated_only": True,               # the export query asks rated=true
    "variant": "standard",            # score_games.py skips every non-standard game (48 in the baseline)
}
# The exclusion reasons the manifest records, in the baseline's own vocabulary:
EXCLUSION_REASONS = (
    "no-pgn",
    "termination:Abandoned",
    "termination:Time forfeit",
    "termination:Unterminated",
    "termination:none",
    "termination:other",
    "no-clocks",
    "under-20-plies",
    "non-standard-variant",
    "unrated",
    "duplicate-game-id",
    "malformed-moves",
)
# Berserk is NOT an exclusion for the personal corpus: design v1.1 handles it inside the clock model
# (the berserking side's initial clock is halved and its increment removed). It IS an exclusion for
# the population corpus (see POPULATION_CONTRACT), which is the baseline's own asymmetry.
BERSERK_HANDLING = "clock-model"      # never a game exclusion on the focal corpus

# Window rule: "the N most recent admissible games, in the API's own dateDesc order".
# The baseline's N was 2,209 = every admissible game the account had. For a generic player the
# window is therefore "every admissible game", with an optional cap that must be declared before
# the fetch, never after.
WINDOW_RULE = "all-admissible-in-dateDesc-order"

# --------------------------------------------------------------------------------------------------
# DECISION-LEVEL ELIGIBILITY -- analysis/common.py `eligible()`, which is the product's own rule
# (shared/import-diagnostic.ts): forced and book positions are not decisions; a decision needs a
# think time and a clock reading.
# --------------------------------------------------------------------------------------------------
DECISION_ELIGIBILITY = "not forced AND not book AND seconds present AND clock present"

# --------------------------------------------------------------------------------------------------
# SPLITS (Phase 10) -- frozen design v1
# --------------------------------------------------------------------------------------------------
SPLIT = {
    "unit": "game",
    "order": "chronological by game createdAt, oldest first",
    "derive_frac": 0.60,
    "validate_frac": 0.20,
    "test_frac": 0.20,
    "test_opened": "once, for the frozen candidate only",
}

# --------------------------------------------------------------------------------------------------
# MINIMUM CORPUS (Phase 10) -- AMBIGUOUS_BASELINE, resolved by derivation, never by a new player.
#
# The baseline never declared a minimum game count: it had 2,209 games and never asked what the
# floor was. Inventing a floor now would be a new research rule. Instead the floor is the WEAKEST
# requirement the already-frozen judge can even be evaluated under:
#
#   * a region needs `min_size` (300) decisions of support on DERIVE, or the search cannot return it;
#   * the VALIDATE judge needs n_in >= 100 AND n_out >= 100 (`judge_region`), so >= 200 decisions;
#   * the TEST read needs the same;
#   * the within-game contrast needs >= 2 games carrying decisions on both sides of the region.
#
# Nothing below is a threshold on evidence. They are the points below which the frozen statistics
# are undefined. A corpus that fails one returns INSUFFICIENT_CORPUS, never a weaker verdict.
# --------------------------------------------------------------------------------------------------
MIN_CORPUS = {
    "basis": "DERIVED_FROM_FROZEN_DESIGN",
    "derive_decisions": 300,      # = DESIGN.min_size
    "validate_decisions": 200,    # = 2 * DESIGN.min_n_validate
    "test_decisions": 200,        # = 2 * DESIGN.min_n_validate
    "derive_games": 5,            # 5-fold game-grouped CV inside DERIVE (Node C depth rule)
    "validate_games": 2,          # within_game_contrast needs >= 2 paired games
    "test_games": 2,
}

# --------------------------------------------------------------------------------------------------
# ENGINE REGIME (Phase 8) -- unchanged. Ledger §Environment.
# --------------------------------------------------------------------------------------------------
ENGINE = {
    "research": {
        "name": "Stockfish 17.1",
        "build": "ubuntu-x86-64-avx2",
        "depth": 12,
        "multipv": 3,
        "threads": 1,
        "hash_mb": 16,
        "hash_cleared_per_position": True,
    },
    "shipped_parity": {
        "name": "Stockfish 18 Lite WASM (the product's engine)",
        "entrypoint": "scripts/sf-wasm.sh",
        "depth": 12,
        "multipv": 1,
        "hash_cleared_per_position": True,
        "role": "engine-artifact control only; never the primary label",
    },
    "hierarchy": "research engine labels every primary statistic; the shipped engine re-scores "
                 "VALIDATE as a control (Node G). Performance changes are admissible only if proven "
                 "output-equivalent.",
}

# --------------------------------------------------------------------------------------------------
# POPULATION CONTRACT (Phase 11) -- ledger §Environment (population reference) and Node G.
#
# The baseline's band was 1450-1850 for a player whose blitz median rating is 1654. The band is
# therefore not an absolute constant: it is the focal player's own band. The reconstruction below
# reproduces (1450, 1850) exactly for erez281 and is the ONLY parameterisation used.
# --------------------------------------------------------------------------------------------------
POPULATION_CONTRACT = {
    "band_centre": "median own_rating over the focal player's admissible BLITZ games, rounded to the nearest 50",
    "band_halfwidth": 200,
    "both_sides_in_band": True,
    "time_controls": ("180+0", "300+0"),
    "source": "database.lichess.org monthly standard rated dump",
    "prefix_bytes": 80_000_000,
    "n_games": 600,
    "one_game_per_player": True,
    "both_colours_focal": True,
    "termination": "Normal",
    "requires_clocks": True,
    "no_berserk": True,
    "min_plies": 20,
    "sample_hash_seed": "20260905:<gameId>",
    "leakage_rule": "the focal player's corpus label AND player_key are excluded from the population "
                    "frame before any model is fit",
    "model": "HistGradientBoostingClassifier(max_iter=400, learning_rate=0.05, max_leaf_nodes=31, "
             "min_samples_leaf=60, l2_regularization=1.0, random_state=DESIGN.seed), one per target",
    "frame": "blitz only (the population has no bullet or rapid)",
}


def population_band(blitz_median_rating: float) -> tuple[int, int]:
    """The focal player's same-rating band. erez281 (blitz median 1654) -> (1450, 1850)."""
    centre = int(round(float(blitz_median_rating) / 50.0) * 50)
    h = POPULATION_CONTRACT["band_halfwidth"]
    return centre - h, centre + h


# --------------------------------------------------------------------------------------------------
# TARGETS (design v1.7) -- the error classes and the union target. Frozen vocabulary.
# --------------------------------------------------------------------------------------------------
BROAD_TARGET = "cls_tactical"          # R*  : the union class, the final-candidate rule of 15:50 UTC
RESIDUAL_TARGETS = ("cls_hung_material", "cls_tactical")   # R** : design v1.8, in this order
RESIDUAL_PRIMARY = "cls_hung_material"

# --------------------------------------------------------------------------------------------------
# STAGES (Phase 12) -- the frozen order. No human tuning between them.
# --------------------------------------------------------------------------------------------------
STAGES = (
    "INGEST", "ELIGIBILITY", "FREEZE", "SCORE", "FEATURES", "SPLITS",
    "DISCOVERY", "HOLDOUT", "INVARIANCE", "STABILITY", "POPULATION", "RESIDUAL",
    "CLASSIFY", "REPORT",
)

# --------------------------------------------------------------------------------------------------
# OUTPUT CLASSES (Phase 13). A run ends in exactly one.
# --------------------------------------------------------------------------------------------------
OUTPUT_CLASSES = {
    "NO_STABLE_STRUCTURE": "the frozen OBS residual search returned no region that passes the "
                           "VALIDATE judge on the union tactical class",
    "LEVEL_TYPICAL_ONLY": "a region passes the judge, and the population-baseline search returns no "
                          "region that passes it: what was found is what a same-rating player shows",
    "PERSONAL_RESIDUAL_CANDIDATE": "a region survives the population baseline on held-out games. "
                                   "Not causal, not an intervention claim, not validated in the field",
    "INSUFFICIENT_EVIDENCE": "the frozen statistics are undefined on this corpus or no population "
                             "baseline covers this player's band",
}

# --------------------------------------------------------------------------------------------------
# FAILURE CODES (Phase 19). A run never returns a stack trace as a research conclusion.
# --------------------------------------------------------------------------------------------------
FAILURE_CODES = (
    "USER_NOT_FOUND",
    "NO_PUBLIC_GAMES",
    "INSUFFICIENT_ELIGIBLE_GAMES",
    "INSUFFICIENT_CORPUS",
    "POPULATION_BASELINE_INSUFFICIENT",
    "ENGINE_FAILURE",
    "PIPELINE_EQUIVALENCE_FAILED",
    "PLATFORM_UNSUPPORTED",
    "FETCH_FAILED",
)

TERMINAL_STATES = tuple(OUTPUT_CLASSES) + FAILURE_CODES

# --------------------------------------------------------------------------------------------------
# CLAIM LADDER (Phase 17). The rungs this pipeline can reach, and where it stops by construction.
# --------------------------------------------------------------------------------------------------
CLAIM_LADDER = (
    ("OBSERVATION", "REPO", "reachable: the region's contrast on games never used to find it"),
    ("PREDICTION", "REPO", "reachable: held-out log-loss/AUC gain over the frozen baselines on TEST"),
    ("SPECIFICITY", "RESEARCH", "reachable only through the population baseline; absent it, never"),
    ("CAUSALITY", "FIELD", "NOT reachable by this pipeline under any result"),
    ("INTERVENTION", "OWNER", "NOT reachable by this pipeline under any result"),
    ("OUTCOME", "FIELD", "NOT reachable by this pipeline under any result"),
)

# --------------------------------------------------------------------------------------------------
# REVERSAL CONDITIONS -- carried over verbatim in meaning from NETA_FINDING.json.
# --------------------------------------------------------------------------------------------------
REVERSAL = {
    "OBSERVATION": "the region's within-game contrast on new games falls below the baseline's "
                   "prediction, or changes sign under the shipped engine",
    "SPECIFICITY": "a second held-out window or a larger population sample puts the focal player's "
                   "residual inside the population's spread",
}

# --------------------------------------------------------------------------------------------------
# GOVERNANCE (Research governance section of the mission).
# --------------------------------------------------------------------------------------------------
GOVERNANCE = {
    "new_player_is_test_data": True,
    "one_run_per_player": "a player whose result caused a pipeline change becomes development data; "
                          "replication then requires a different player and a bumped contract version",
    "prereg_required": "REPLICATION_PREREG.json is written and hashed BEFORE the first outcome-bearing "
                       "stage of a run",
}

PROVENANCE = {
    "GAME_ELIGIBILITY": "scripts/build_import_corpus.ts admissible(); MISSION_LEDGER.md §Environment",
    "DECISION_ELIGIBILITY": "analysis/common.py eligible(); shared/import-diagnostic.ts",
    "SPLIT": "MISSION_LEDGER.md §Frozen design v1",
    "MIN_CORPUS": "AMBIGUOUS_BASELINE; derived from analysis/vocab.py DESIGN min_size / "
                  "min_n_validate and from within_game_contrast's own definition",
    "ENGINE": "MISSION_LEDGER.md §Environment; design v1.1 engine-artifact control",
    "POPULATION_CONTRACT": "MISSION_LEDGER.md §Environment (population reference), Node G, design v1.8",
    "BROAD_TARGET": "MISSION_LEDGER.md §Final-candidate rule for class targets (15:50 UTC)",
    "RESIDUAL_TARGETS": "MISSION_LEDGER.md §Design v1.8",
    "OUTPUT_CLASSES": "mission brief Phase 13; the baseline itself produced LEVEL_TYPICAL_ONLY at "
                      "Node G and PERSONAL_RESIDUAL_CANDIDATE at design v1.8",
    "CLAIM_LADDER": "NETA_FINDING.json claims C1-C6 and their permissions",
}
