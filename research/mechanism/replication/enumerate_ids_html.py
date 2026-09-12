"""
NOT PART OF THE FROZEN INGESTION CONTRACT.

The canonical way to learn which games an account has played is the export the frozen manifest
names, `GET /api/games/user/<name>`. In this environment lichess answers 404 to that endpoint for
every account unless the request carries a token, which the mission ledger already recorded a year
ago. Without a token there is no API that enumerates an account's games.

This helper walks the account's public game list (`/@/<name>/all?page=N`) and collects game ids in
the order lichess shows them, which is newest first. Its output is a FROZEN ID LIST, and the list is
then fetched through the canonical `POST /api/games/export/_ids` endpoint, so the game records that
enter the corpus come from the API exactly as they would have.

What this does and does not buy:

  * the corpus is still built from canonical API records, hashed and frozen;
  * the window is still "the most recent admissible games, in the platform's own order";
  * but `INPUT MODE = PROVIDED_GAME_IDS`, and a run that uses it does NOT exercise the
    username-only ingestion contract. A replication run that uses it is a replication of the
    METHODOLOGY, not proof of username-only ingestion. The two claims must not be mixed.

Usage: python enumerate_ids_html.py --username NAME --pages N --out ids.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request

UA = "lichess_app-research-replication/1.0 (research/mechanism/replication)"
GAME_ID = re.compile(r'href="/([a-zA-Z0-9]{8})(?:/(?:white|black))?"')
NOT_A_GAME = {"analysis", "practice", "training", "streamer", "features", "patron", "settings"}
PAUSE_S = 0.7


def page_ids(username: str, page: int) -> list[str]:
    url = f"https://lichess.org/@/{urllib.parse.quote(username)}/all?page={page}"
    req = urllib.request.Request(url)
    req.add_header("User-Agent", UA)
    req.add_header("X-Requested-With", "XMLHttpRequest")
    req.add_header("Accept", "text/html, application/xhtml+xml")
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read().decode("utf-8", "replace")
    out, seen = [], set()
    for gid in GAME_ID.findall(body):
        if gid in NOT_A_GAME or gid in seen:
            continue
        seen.add(gid)
        out.append(gid)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--username", required=True)
    ap.add_argument("--pages", type=int, default=100)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    ids, seen, empty = [], set(), 0
    for p in range(1, a.pages + 1):
        try:
            got = page_ids(a.username, p)
        except Exception as e:
            sys.stderr.write(f"page {p}: {type(e).__name__}: {e}\n")
            break
        new = [g for g in got if g not in seen]
        for g in new:
            seen.add(g)
            ids.append(g)
        if not new:
            empty += 1
            if empty >= 3:
                break
        else:
            empty = 0
        if p % 20 == 0:
            sys.stderr.write(f"page {p}: {len(ids)} ids\n")
        time.sleep(PAUSE_S)
    json.dump(ids, open(a.out, "w"))
    print(json.dumps({"username": a.username, "pages_walked": p, "ids": len(ids),
                      "order": "newest first, as the platform listed them",
                      "input_mode": "PROVIDED_GAME_IDS"}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
