"""Planted worlds (fixture). Only the declaration the self-test records is kept."""

PLANTS = [
    Plant("clean-middlegame", 0.18, _region_middlegame, "phase-middlegame"),
    Plant("one-game-only", 0.22, _region_one_game, None),
]
