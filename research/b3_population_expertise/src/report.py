"""Figures and tables. Every figure shows uncertainty; no smoothed curve appears without the bins
it was drawn through.

The rule that shapes this file: a reader must be able to see the support. A rating-band curve drawn
through nine shrunk points looks the same whether each point rests on 300 players or on 12, so every
band figure carries its interval, and every band table carries its `n` and its player count.
"""
from __future__ import annotations

import json
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from common import BAND_LABELS  # noqa: E402

PERIOD_COLOUR = {"development": "#7f8c9b", "validation": "#c58a3a", "final": "#2f6f8f"}
BAND_X = np.arange(len(BAND_LABELS))


def _band_series(table, key="point"):
    values, lo, hi, n = [], [], [], []
    for band in BAND_LABELS:
        cell = table.get(band, {})
        values.append(cell.get(key, np.nan))
        lo.append(cell.get("lo", np.nan))
        hi.append(cell.get("hi", np.nan))
        n.append(cell.get("n", 0))
    return np.array(values, float), np.array(lo, float), np.array(hi, float), np.array(n)


def _band_axis(ax, powered=None):
    ax.set_xticks(BAND_X)
    ax.set_xticklabels(BAND_LABELS, rotation=45, ha="right", fontsize=7)
    ax.set_xlabel("rating at game time")
    ax.grid(alpha=0.25, linewidth=0.5)
    if powered is not None:
        for i, band in enumerate(BAND_LABELS):
            if band not in powered:
                ax.axvspan(i - 0.5, i + 0.5, color="#000000", alpha=0.05, zorder=0)


def band_figure(path, tables, title, ylabel, note=None, powered=None, zero_line=True):
    """One metric, one curve per period, intervals drawn, underpowered bands shaded."""
    fig, ax = plt.subplots(figsize=(7.2, 4.2))
    for period, table in tables.items():
        values, lo, hi, n = _band_series(table)
        colour = PERIOD_COLOUR.get(period, "#444444")
        ax.errorbar(BAND_X, values, yerr=[values - lo, hi - values], fmt="o-", color=colour,
                    capsize=3, markersize=4, linewidth=1.4, label=f"{period}", alpha=0.9)
    if zero_line:
        ax.axhline(0, color="#000000", linewidth=0.8, alpha=0.4)
    _band_axis(ax, powered)
    ax.set_ylabel(ylabel)
    ax.set_title(title, fontsize=10)
    if note:
        ax.text(0.01, -0.32, note, transform=ax.transAxes, fontsize=7, color="#555555",
                va="top", wrap=True)
    ax.legend(fontsize=8, frameon=False)
    fig.tight_layout()
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)


def binned_figure(path, frames, x, y, title, xlabel, ylabel, bins=12, by_band=True):
    """A binned mean with intervals -- the raw support behind any smooth claim."""
    fig, ax = plt.subplots(figsize=(7.2, 4.2))
    frame = frames["final"] if "final" in frames else list(frames.values())[0]
    if by_band:
        groups = [("800-1199", frame["rating"] < 1200),
                  ("1200-1599", (frame["rating"] >= 1200) & (frame["rating"] < 1600)),
                  ("1600-1999", (frame["rating"] >= 1600) & (frame["rating"] < 2000)),
                  ("2000-2599", frame["rating"] >= 2000)]
        colours = ["#b5651d", "#7f8c9b", "#2f6f8f", "#1b4b2f"]
    else:
        groups = [("all", np.ones(len(frame), bool))]
        colours = ["#2f6f8f"]
    edges = np.quantile(frame[x].to_numpy(float), np.linspace(0.02, 0.98, bins + 1))
    edges = np.unique(edges)
    for (label, mask), colour in zip(groups, colours):
        block = frame[np.asarray(mask)]
        if len(block) < 200:
            continue
        idx = np.digitize(block[x].to_numpy(float), edges)
        centres, means, errs = [], [], []
        for b in range(1, len(edges)):
            cell = block[idx == b]
            if len(cell) < 30:
                continue
            centres.append(float(cell[x].mean()))
            means.append(float(cell[y].mean()))
            errs.append(float(cell[y].std() / np.sqrt(len(cell))))
        ax.errorbar(centres, means, yerr=errs, fmt="o-", color=colour, capsize=2,
                    markersize=3.5, linewidth=1.3, label=label, alpha=0.9)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.set_title(title, fontsize=10)
    ax.grid(alpha=0.25, linewidth=0.5)
    ax.legend(fontsize=8, frameon=False, title="rating", title_fontsize=8)
    fig.tight_layout()
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)


def frontier_figure(path, rows):
    """Mean quality loss against mean thinking time inside matched cells, one curve per band.

    Not collapsed into a score. The shape is the object.
    """
    frame = pd.DataFrame(rows)
    if frame.empty:
        return
    fig, ax = plt.subplots(figsize=(7.2, 4.6))
    palette = plt.cm.viridis(np.linspace(0, 0.92, len(BAND_LABELS)))
    for band, colour in zip(BAND_LABELS, palette):
        block = frame[frame["rating_band"] == band].sort_values("mean_seconds")
        if len(block) < 4:
            continue
        ax.errorbar(block["mean_seconds"], block["mean_quality_loss"],
                    yerr=block["sem_quality_loss"], fmt="o-", color=colour, capsize=2,
                    markersize=3.5, linewidth=1.2, alpha=0.85, label=band)
    ax.set_xlabel("mean seconds spent in the cell")
    ax.set_ylabel("mean quality loss (win probability)")
    ax.set_title("Decision efficiency frontier: matched difficulty x VoC x clock cells", fontsize=10)
    ax.grid(alpha=0.25, linewidth=0.5)
    ax.legend(fontsize=7, frameon=False, ncol=2, title="rating band", title_fontsize=7)
    fig.tight_layout()
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)


def control_figure(path, real, shuffled, title, ylabel):
    fig, ax = plt.subplots(figsize=(5.4, 4.0))
    labels, points, los, his, colours = [], [], [], [], []
    for label, cell, colour in (("as measured", real, "#2f6f8f"), ("control", shuffled, "#b5651d")):
        labels.append(label)
        points.append(cell.get("point", np.nan))
        los.append(cell.get("lo", np.nan))
        his.append(cell.get("hi", np.nan))
        colours.append(colour)
    points, los, his = np.array(points), np.array(los), np.array(his)
    ax.errorbar(range(len(labels)), points, yerr=[points - los, his - points], fmt="o",
                capsize=5, markersize=7, linewidth=1.6, ecolor="#555555")
    for i, colour in enumerate(colours):
        ax.plot(i, points[i], "o", color=colour, markersize=8)
    ax.axhline(0, color="#000000", linewidth=0.8, alpha=0.4)
    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels)
    ax.set_xlim(-0.5, len(labels) - 0.5)
    ax.set_ylabel(ylabel)
    ax.set_title(title, fontsize=10)
    ax.grid(alpha=0.25, linewidth=0.5, axis="y")
    fig.tight_layout()
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)


def player_figure(path, table):
    fig, ax = plt.subplots(figsize=(7.2, 4.2))
    frame = pd.DataFrame(table)
    if frame.empty:
        return
    ax.scatter(frame["rating"], frame["tae_shrunk"], s=6, alpha=0.25, color="#2f6f8f",
               edgecolors="none")
    bins = np.arange(800, 2601, 200)
    idx = np.digitize(frame["rating"], bins)
    centres, means, errs = [], [], []
    for b in range(1, len(bins)):
        cell = frame[idx == b]
        if len(cell) < 20:
            continue
        centres.append(float(cell["rating"].mean()))
        means.append(float(cell["tae_shrunk"].mean()))
        errs.append(float(cell["tae_shrunk"].std() / np.sqrt(len(cell))))
    ax.errorbar(centres, means, yerr=errs, fmt="o-", color="#b5651d", capsize=3, markersize=5,
                linewidth=1.6, label="band mean of shrunk player estimates")
    ax.axhline(0, color="#000000", linewidth=0.8, alpha=0.4)
    ax.set_xlabel("player rating")
    ax.set_ylabel("player time-allocation efficiency (shrunk)")
    ax.set_title("Per-player time allocation efficiency against rating", fontsize=10)
    ax.grid(alpha=0.25, linewidth=0.5)
    ax.legend(fontsize=8, frameon=False)
    fig.tight_layout()
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)


def write_table(path, rows, columns=None):
    frame = pd.DataFrame(rows)
    if columns:
        frame = frame[columns]
    frame.to_csv(path, index=False)
    return frame


def band_table(tables, name):
    rows = []
    for band in BAND_LABELS:
        row = {"rating_band": band}
        for period, table in tables.items():
            cell = table.get(band, {})
            row[f"{period}_{name}"] = cell.get("point")
            row[f"{period}_lo"] = cell.get("lo")
            row[f"{period}_hi"] = cell.get("hi")
            row[f"{period}_n"] = cell.get("n")
        rows.append(row)
    return rows
