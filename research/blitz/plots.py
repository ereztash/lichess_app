"""Two figures, drawn as SVG by hand.

No plotting library: the repository has no Python runtime dependency today and a chart is not worth
acquiring one. Both figures exist to make a NEGATIVE result legible -- a stability curve that never
reaches its bar, and a distribution that shows whether the construct is degenerate.
"""

from __future__ import annotations

import math
from pathlib import Path

W, H, PAD = 640, 320, 52


def _axes(title: str, x_label: str, y_label: str) -> list[str]:
    return [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
        'font-family="ui-sans-serif,system-ui,sans-serif" font-size="11">',
        f'<title>{title}</title>',
        f'<rect width="{W}" height="{H}" fill="#fbfbfa"/>',
        f'<text x="{PAD}" y="22" font-size="13" font-weight="600" fill="#1a1a19">{title}</text>',
        f'<line x1="{PAD}" y1="{H-PAD}" x2="{W-16}" y2="{H-PAD}" stroke="#8a8a85"/>',
        f'<line x1="{PAD}" y1="34" x2="{PAD}" y2="{H-PAD}" stroke="#8a8a85"/>',
        f'<text x="{W-16}" y="{H-PAD+30}" text-anchor="end" fill="#57564f">{x_label}</text>',
        f'<text x="{PAD}" y="{H-PAD+30}" fill="#57564f">{y_label}</text>',
    ]


def saturation_curve(checks: list[dict], target: float, out: Path) -> Path:
    """Stability against budget, with the preregistered bar drawn where it actually is."""
    xs = [math.log10(c["budget"]) for c in checks]
    lo, hi = min(xs), max(xs)
    span = (hi - lo) or 1.0

    def px(x: float) -> float:
        return PAD + (x - lo) / span * (W - PAD - 24)

    def py(y: float) -> float:
        return (H - PAD) - (y - 0.5) / 0.5 * (H - PAD - 40)

    parts = _axes(
        "Deep-reference stability against node budget", "node budget (log scale)", "stable share"
    )
    bar = py(target)
    parts.append(
        f'<line x1="{PAD}" y1="{bar:.1f}" x2="{W-16}" y2="{bar:.1f}" stroke="#b3261e" '
        'stroke-dasharray="5 4"/>'
    )
    parts.append(
        f'<text x="{W-20}" y="{bar-6:.1f}" text-anchor="end" fill="#b3261e">preregistered bar '
        f'{target:.0%}</text>'
    )
    for key, colour, label in (
        ("tolerantRate", "#3a6ea5", "tolerant epsilon"),
        ("strictRate", "#1a1a19", "strict epsilon (primary)"),
    ):
        points = " ".join(f"{px(math.log10(c['budget'])):.1f},{py(c[key]):.1f}" for c in checks)
        parts.append(f'<polyline points="{points}" fill="none" stroke="{colour}" stroke-width="2"/>')
        for c in checks:
            parts.append(
                f'<circle cx="{px(math.log10(c["budget"])):.1f}" cy="{py(c[key]):.1f}" r="3" '
                f'fill="{colour}"/>'
            )
        last = checks[-1]
        parts.append(
            f'<text x="{px(math.log10(last["budget"]))-6:.1f}" y="{py(last[key])-8:.1f}" '
            f'text-anchor="end" fill="{colour}">{label}</text>'
        )
    for c in checks:
        parts.append(
            f'<text x="{px(math.log10(c["budget"])):.1f}" y="{H-PAD+14}" text-anchor="middle" '
            f'fill="#57564f">{c["budget"]//1000}k</text>'
        )
    for tick in (0.5, 0.6, 0.7, 0.8, 0.9, 1.0):
        parts.append(
            f'<text x="{PAD-8}" y="{py(tick)+4:.1f}" text-anchor="end" fill="#57564f">{tick:.1f}</text>'
        )
    parts.append("</svg>")
    out.write_text("\n".join(parts))
    return out


def distribution(values: list[float], title: str, x_label: str, out: Path, bins: int = 30) -> Path:
    """A histogram, to answer whether a construct varies at all across positions."""
    values = [v for v in values if v is not None and math.isfinite(v)]
    top = max(values) if values else 1.0
    top = top or 1.0
    counts = [0] * bins
    for v in values:
        counts[min(bins - 1, int(v / top * bins))] += 1
    peak = max(counts) or 1
    parts = _axes(title, x_label, "decisions")
    width = (W - PAD - 24) / bins
    for i, count in enumerate(counts):
        height = count / peak * (H - PAD - 40)
        parts.append(
            f'<rect x="{PAD + i * width:.1f}" y="{H - PAD - height:.1f}" width="{width - 1:.1f}" '
            f'height="{height:.1f}" fill="#3a6ea5" opacity="0.85"/>'
        )
    parts.append(
        f'<text x="{W-16}" y="{H-PAD+14}" text-anchor="end" fill="#57564f">{top:.3f}</text>'
    )
    parts.append(f'<text x="{PAD}" y="{H-PAD+14}" fill="#57564f">0</text>')
    parts.append(f'<text x="{PAD-8}" y="44" text-anchor="end" fill="#57564f">{peak}</text>')
    parts.append("</svg>")
    out.write_text("\n".join(parts))
    return out
