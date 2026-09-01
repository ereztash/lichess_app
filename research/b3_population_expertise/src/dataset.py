"""Load a scored period and derive the columns the models need. Nothing here fits anything."""
from __future__ import annotations

import io
import json
import os

import numpy as np
import pandas as pd
import zstandard

DERIVED = ["log_time", "side_num", "nodes_to_depth10_missing"]


def load(path: str) -> pd.DataFrame:
    if os.path.isdir(path):
        path = os.path.join(path, "decisions.jsonl.zst")
    with open(path, "rb") as fh:
        text = io.TextIOWrapper(
            zstandard.ZstdDecompressor().stream_reader(fh), encoding="utf-8"
        )
        frame = pd.DataFrame([json.loads(line) for line in text if line.strip()])

    frame["log_time"] = np.log1p(frame["seconds_taken"].astype(float))
    frame["side_num"] = (frame["side"] == "w").astype(int)
    # A search that never reached depth 10 is a fact about the position, so it gets an indicator
    # rather than a silent zero, and the imputed value is a frozen DEVELOPMENT median supplied by
    # the caller through `apply_frozen_imputation`.
    frame["nodes_to_depth10_missing"] = frame["nodes_to_depth10"].isna().astype(int)
    return frame


def apply_frozen(frame: pd.DataFrame, constants: dict) -> pd.DataFrame:
    """Attach every DEVELOPMENT-derived constant. Applied identically to every period."""
    frame = frame.copy()
    frame["nodes_to_depth10"] = frame["nodes_to_depth10"].fillna(constants["nodes_to_depth10_median"])
    frame["voc_z"] = (frame["voc_regret"] - constants["voc_mean"]) / constants["voc_sd"]
    for name, edges in constants["cuts"].items():
        frame[f"{name}_cut"] = np.digitize(frame[name].astype(float), edges)
    return frame


def frozen_constants(dev: pd.DataFrame) -> dict:
    """Everything the rest of the study is allowed to standardise by, computed ONCE, on DEVELOPMENT.

    Recomputing any of these on the period a result is read from would let that period inform the
    scale its own effect is measured on -- the quiet version of looking at the answer.
    """
    def cuts(column, quantiles):
        return [float(q) for q in np.quantile(dev[column].astype(float), quantiles)]

    return {
        "nodes_to_depth10_median": float(dev["nodes_to_depth10"].median()),
        "voc_mean": float(dev["voc_regret"].mean()),
        "voc_sd": float(dev["voc_regret"].std() or 1.0),
        "cuts": {
            "ambiguity_entropy": cuts("ambiguity_entropy", [1 / 3, 2 / 3]),
            "gap12": cuts("gap12", [1 / 3, 2 / 3]),
            "wp1": cuts("wp1", [0.2, 0.4, 0.6, 0.8]),
            "voc_regret": cuts("voc_regret", [1 / 3, 2 / 3]),
            "clock_pressure": cuts("clock_pressure", [1 / 3, 2 / 3]),
            "ply": cuts("ply", [0.25, 0.5, 0.75]),
            "legal_moves": cuts("legal_moves", [1 / 3, 2 / 3]),
        },
    }
