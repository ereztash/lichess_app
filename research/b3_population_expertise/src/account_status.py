"""Exclude accounts Lichess has since closed, and count the exclusion.

R10 FROM GATE 1, and it is aimed at the primary metric. Time that tracks engine-measured difficulty,
paired with low quality loss, is close to what engine-assistance detection looks for -- and it is
exactly what Metric B rewards. Assisted accounts concentrate in the upper bands of a fast time
control, the strongest verdict is a contrast between the top and bottom adequately powered bands,
and the two-games-per-player cap bounds one account rather than a class of them. A few percent of
assisted sides in the top band inflates `TAE(highest)` directly.

The dumps do not mark them. The public account status does: `disabled` for a closed account,
`tosViolation` for one closed for a terms violation. One batch lookup per period, on a date recorded
in the manifest, applied identically to every period, reading no game content.

The lookup is a snapshot: an account closed AFTER the lookup date is still in the corpus, and one
closed for a reason unrelated to engine use is excluded. Both directions are stated in the report
rather than corrected for.
"""
from __future__ import annotations

import sys
import time

import requests

ENDPOINT = "https://lichess.org/api/users"
BATCH = 300
HEADERS = {"User-Agent": "b3-research (repo ereztash/lichess_app)"}


def lookup(usernames: list[str], retries: int = 5, pause: float = 1.2) -> dict[str, dict]:
    """`{lowercased username: {"disabled": bool, "tosViolation": bool}}` for everyone found."""
    out: dict[str, dict] = {}
    unique = sorted({u.strip().lower() for u in usernames if u and u.strip()})
    for start in range(0, len(unique), BATCH):
        chunk = unique[start : start + BATCH]
        for attempt in range(retries):
            response = requests.post(ENDPOINT, data=",".join(chunk), headers=HEADERS, timeout=120)
            if response.status_code == 200:
                for user in response.json():
                    out[user["id"].lower()] = {
                        "disabled": bool(user.get("disabled", False)),
                        "tosViolation": bool(user.get("tosViolation", False)),
                    }
                break
            if response.status_code == 429:
                time.sleep(65)
                continue
            time.sleep(pause * (2**attempt))
        else:
            raise RuntimeError(f"account status lookup failed for a batch of {len(chunk)}")
        time.sleep(pause)
        sys.stderr.write(f"  account status: {min(start + BATCH, len(unique)):,}/{len(unique):,}\n")
    return out


def excluded(status: dict[str, dict], username: str) -> bool:
    """Missing from the response counts as NOT excluded.

    A username the endpoint does not return is a username we know nothing about, and inventing a
    closure for it would silently thin the sample in whichever band the endpoint happened to miss.
    The count of unknown accounts is reported instead.
    """
    entry = status.get(username.strip().lower())
    if entry is None:
        return False
    return entry["disabled"] or entry["tosViolation"]
