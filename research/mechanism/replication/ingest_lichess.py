"""
PHASE 4 -- INGEST PUBLIC GAME HISTORY.

    platform + username  ->  RAW IMMUTABLE CORPUS + fetch manifest

Extraction only. Not one game is dropped here: eligibility is a separate stage
(`eligibility.py`) so that every exclusion is a recorded, reproducible decision rather than a
silent absence. The raw bytes the platform returned are kept verbatim and hashed.

Two supported modes, both writing the same raw record shape:

  api-user-export   GET /api/games/user/<id> with the frozen query (the `source` recorded in
                    research/mechanism/data/frozen_window_manifest.json). Needs LICHESS_API_TOKEN,
                    exactly as scripts/build_account_corpus.ts documents ("Rated games are public,
                    so the token only lifts the rate limit").

  api-ids           POST /api/games/export/_ids for an explicit id list. This is the mode the
                    erez281 mission itself had to use ("the by-username export returns 404 for
                    every user today", MISSION_LEDGER.md §Environment), and it is how a frozen
                    window is replayed byte-for-byte.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import contract

LICHESS = "https://lichess.org"
USER_AGENT = "lichess_app-research-replication/1.0 (research/mechanism/replication)"
IDS_PER_REQUEST = 300
REQUEST_PAUSE_S = 1.0
# Lichess answers 429 when a client goes too fast and asks for a full minute of silence
# (https://lichess.org/api#section/Introduction/Rate-limiting). Honour it rather than hammering.
RATE_LIMIT_WAIT_S = 65
RATE_LIMIT_RETRIES = 6


class IngestError(RuntimeError):
    """Carries one of contract.FAILURE_CODES, never a stack trace."""

    def __init__(self, code: str, detail: str):
        super().__init__(f"{code}: {detail}")
        self.code = code
        self.detail = detail


def _request_once(url: str, *, data: bytes | None, accept: str, token: str | None,
                  content_type: str | None, timeout: int) -> tuple[int, bytes]:
    req = urllib.request.Request(url, data=data, method="POST" if data is not None else "GET")
    req.add_header("Accept", accept)
    req.add_header("User-Agent", USER_AGENT)
    if content_type:
        req.add_header("Content-Type", content_type)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:  # network, TLS, timeout
        raise IngestError("FETCH_FAILED", f"{type(e).__name__} on {url}: {e}") from e


def _request(url: str, *, data: bytes | None = None, accept: str, token: str | None,
             content_type: str | None = None, timeout: int = 900) -> tuple[int, bytes]:
    """One request, waiting out 429s. A rate limit is a pause, not a research outcome."""
    for attempt in range(RATE_LIMIT_RETRIES + 1):
        status, body = _request_once(url, data=data, accept=accept, token=token,
                                     content_type=content_type, timeout=timeout)
        if status != 429 or attempt == RATE_LIMIT_RETRIES:
            return status, body
        sys.stderr.write(f"lichess 429; waiting {RATE_LIMIT_WAIT_S}s "
                         f"(attempt {attempt + 1}/{RATE_LIMIT_RETRIES})\n")
        sys.stderr.flush()
        time.sleep(RATE_LIMIT_WAIT_S)
    return status, body


def verify_account(username: str, token: str | None = None) -> dict:
    """Phase 4.1: the account exists and is public. Returns the platform's own profile record."""
    url = f"{LICHESS}/api/user/{urllib.parse.quote(username)}"
    status, body = _request(url, accept="application/json", token=token)
    if status == 404:
        raise IngestError("USER_NOT_FOUND", f"lichess has no public account {username!r}")
    if status != 200:
        raise IngestError("FETCH_FAILED", f"lichess answered {status} for {url}")
    profile = json.loads(body)
    if profile.get("disabled") or profile.get("closed"):
        raise IngestError("USER_NOT_FOUND", f"account {username!r} is closed")
    return profile


@dataclass
class RawFetch:
    mode: str
    url: str
    query: dict
    fetched_at: str          # ISO-8601 UTC, the retrieval timestamp
    http_status: int
    bytes: int
    sha256: str
    records: int
    path: str
    notes: list


def _write_raw(out_dir: str, chunks: list[bytes]) -> tuple[str, int, str, int]:
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "history.ndjson")
    h = hashlib.sha256()
    n = 0
    with open(path, "wb") as f:
        for c in chunks:
            f.write(c)
            h.update(c)
    with open(path, "rb") as f:
        for line in f:
            if line.strip().startswith(b"{"):
                n += 1
    return path, os.path.getsize(path), h.hexdigest(), n


def fetch_by_username(username: str, out_dir: str, token: str | None,
                      since_ms: int | None = None, until_ms: int | None = None,
                      max_games: int | None = None) -> RawFetch:
    """The canonical path: the frozen export query, verbatim.

    RETRIEVAL BOUND. `REPLICATION_FETCH_MAX_GAMES` caps how many of the player's most recent games
    are downloaded. This file is deliberately OUTSIDE the seventeen the pipeline hash is taken over,
    because it decides how bytes arrive and not what the corpus is, and a bound here is legitimate
    only while that stays true. It stays true under one invariant:

        the export returns games newest-first, and `--window N` keeps the newest N ADMISSIBLE games.
        So whenever the window FILLS, its games are the newest N admissible either way: an
        unbounded fetch adds only OLDER games, which the window discards. A bound can only change a
        corpus whose window did NOT fill.

    `cohort_select.py` therefore accepts a candidate only when their window filled, which is the
    condition under which this bound provably changed nothing, and records that it did.

    Without the bound the cohort walk would download a median of 5,355 blitz games per candidate to
    keep 450 of them, which is tens of hours of transfer discarded on arrival.
    """
    if max_games is None:
        env = os.environ.get("REPLICATION_FETCH_MAX_GAMES")
        max_games = int(env) if env and env.isdigit() else None
    query = dict(contract.LICHESS_EXPORT_QUERY)
    if since_ms is not None:
        query["since"] = str(since_ms)
    if until_ms is not None:
        query["until"] = str(until_ms)
    if max_games is not None:
        query["max"] = str(max_games)
    url = f"{LICHESS}/api/games/user/{urllib.parse.quote(username)}?{urllib.parse.urlencode(query)}"
    fetched_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    status, body = _request(url, accept="application/x-ndjson", token=token)
    if status == 404:
        raise IngestError(
            "FETCH_FAILED",
            "lichess answered 404 for the by-username export. It answers 404 for every account "
            "when the request is unauthenticated (MISSION_LEDGER.md recorded the same thing). Set "
            "LICHESS_API_TOKEN, or supply an explicit id list and use mode=api-ids.",
        )
    if status == 429:
        raise IngestError("FETCH_FAILED", "lichess rate-limited the export (429); retry later")
    if status != 200:
        raise IngestError("FETCH_FAILED", f"lichess answered {status} for the by-username export")
    path, size, sha, n = _write_raw(out_dir, [body])
    if n == 0:
        raise IngestError("NO_PUBLIC_GAMES", f"{username!r} has no public rated games under the frozen query")
    return RawFetch("api-user-export", url, query, fetched_at, status, size, sha, n, path, [])


def fetch_by_ids(game_ids: list[str], out_dir: str, token: str | None) -> RawFetch:
    """The replay path: re-fetch an explicit window by game id, in the order given."""
    query = {k: v for k, v in contract.LICHESS_EXPORT_QUERY.items() if k not in ("rated", "sort")}
    url = f"{LICHESS}/api/games/export/_ids?{urllib.parse.urlencode(query)}"
    fetched_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    chunks, notes, status = [], [], 200
    for i in range(0, len(game_ids), IDS_PER_REQUEST):
        block = game_ids[i:i + IDS_PER_REQUEST]
        status, body = _request(url, data=",".join(block).encode(), accept="application/x-ndjson",
                                token=token, content_type="text/plain")
        if status != 200:
            raise IngestError("FETCH_FAILED", f"lichess answered {status} for _ids block {i // IDS_PER_REQUEST}")
        chunks.append(body if body.endswith(b"\n") else body + b"\n")
        notes.append({"block": i // IDS_PER_REQUEST, "requested": len(block),
                      "returned": sum(1 for ln in body.split(b"\n") if ln.strip().startswith(b"{"))})
        time.sleep(REQUEST_PAUSE_S)
    path, size, sha, n = _write_raw(out_dir, chunks)
    if n == 0:
        raise IngestError("NO_PUBLIC_GAMES", "the id list returned no games")
    return RawFetch("api-ids", url, query, fetched_at, status, size, sha, n, path, notes)


def ingest(username: str, out_dir: str, *, mode: str = "auto", game_ids: list[str] | None = None,
           token: str | None = None, max_games: int | None = None) -> dict:
    """Phase 4 end to end. Returns the fetch manifest; writes raw/history.ndjson beside it."""
    token = token if token is not None else os.environ.get("LICHESS_API_TOKEN")
    profile = verify_account(username, token)
    player_id = profile["id"]
    if mode == "auto":
        mode = "api-ids" if game_ids else "api-user-export"
    if mode == "api-ids":
        if not game_ids:
            raise IngestError("FETCH_FAILED", "mode=api-ids needs a game id list")
        raw = fetch_by_ids(game_ids, out_dir, token)
    elif mode == "api-user-export":
        raw = fetch_by_username(player_id, out_dir, token, max_games=max_games)
    else:
        raise IngestError("PLATFORM_UNSUPPORTED", f"unknown ingest mode {mode!r}")
    manifest = {
        "platform": "lichess",
        "username": username,
        "player_id": player_id,
        "profile": {"perfs": {k: {"games": v.get("games"), "rating": v.get("rating")}
                              for k, v in (profile.get("perfs") or {}).items()},
                    "createdAt": profile.get("createdAt"), "seenAt": profile.get("seenAt")},
        "fetch": raw.__dict__,
        "token_used": bool(token),
        "contract_version": contract.CONTRACT_VERSION,
    }
    with open(os.path.join(out_dir, "fetch.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    return manifest


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser(description="fetch a player's public game history (raw, no filtering)")
    ap.add_argument("--username", required=True)
    ap.add_argument("--out", required=True, help="raw/ directory of a run")
    ap.add_argument("--mode", default="auto", choices=["auto", "api-user-export", "api-ids"])
    ap.add_argument("--ids-file", default=None, help="newline- or JSON-separated game ids for api-ids")
    ap.add_argument("--max-games", type=int, default=None)
    a = ap.parse_args()
    ids = None
    if a.ids_file:
        text = open(a.ids_file).read().strip()
        ids = json.loads(text) if text.startswith("[") else [x for x in text.split() if x]
    try:
        m = ingest(a.username, a.out, mode=a.mode, game_ids=ids, max_games=a.max_games)
    except IngestError as e:
        print(json.dumps({"status": e.code, "detail": e.detail}), file=sys.stderr)
        return 2
    print(json.dumps({"status": "OK", "records": m["fetch"]["records"], "sha256": m["fetch"]["sha256"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
