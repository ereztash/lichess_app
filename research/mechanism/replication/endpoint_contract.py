"""
The by-username export contract, and the regression that made it necessary.

WHAT WENT WRONG. `scripts/build_import_corpus.ts` once carried a comment saying the games-export
endpoint answers 404 through this environment's proxy. That comment was corrected IN THE REPOSITORY
before this package existed: `docs/research/ACCOUNT_BRIDGE_PREREG.md` records a measured HTTP 200
and 5,987,271 bytes for `GET /api/games/user/{username}`, and the corrected comment now says so.
The replication package nevertheless reasserted the stale claim, in PROTOCOL.md, README.md,
READINESS.md and PLAYER_B_READINESS.md, and built on it: Player B was ingested as
`PROVIDED_GAME_IDS` through the 480-game HTML enumeration cap, and the 100-player cohort was
stopped at `PENDING_RESOURCE` for want of a token it never needed.

The endpoint was never the problem. Measured across three accounts and twelve unauthenticated
requests: HTTP 200 every time, including 2,000 games in one response, which is four times the cap
the stale claim forced the package to work under.

WHAT THIS SCRIPT HOLDS.

  text   -- no document in this package may reassert that the endpoint requires authentication.
            Deterministic, runs offline, and is the check that would have caught the regression.
  live   -- the endpoint answers 200 unauthenticated with the frozen query, and returns more than
            the HTML enumeration cap in a single response.

    python endpoint_contract.py [--offline] [--out ENDPOINT_CONTRACT.json]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import contract          # noqa: E402
import ingest_lichess    # noqa: E402

LICHESS = "https://lichess.org"
HTML_CAP = 480                     # 40 pages x 12 ids, the ceiling the stale claim forced
PROBE_ACCOUNT = "erez281"          # the frozen corpus's own account: known-valid, public
VOLUME_ACCOUNT = "livio68"         # 13,539 blitz games: enough to exceed the cap in one response

# The sentence that must never come back. Matches a claim that the export REQUIRES auth, not a
# mention of 404 (the account-verification endpoint answers 404 for a real reason).
STALE = re.compile(
    r"(by-username export[^.]{0,80}404"
    r"|404[^.]{0,80}unauthenticated request"
    r"|needs? `?LICHESS_API_TOKEN`?)",
    re.I)
# A line that WITHDRAWS the claim necessarily quotes it. Naming the retraction markers is what lets
# the guard survive its own correction; without this it would fire forever on the fix.
WITHDRAWN = re.compile(r"(~~|WITHDRAWN|never true|it does not|answers \*\*200|\*\*optional\*\*"
                       r"|That was inherited|was wrong|is wrong)", re.I)
DOCS = ["PROTOCOL.md", "README.md", "READINESS.md", "PLAYER_B_READINESS.md"]


def check_text() -> dict:
    findings = []
    for name in DOCS:
        p = os.path.join(HERE, name)
        if not os.path.exists(p):
            continue
        for i, line in enumerate(open(p, encoding="utf-8"), 1):
            if STALE.search(line) and not WITHDRAWN.search(line):
                findings.append({"file": "research/mechanism/replication/" + name,
                                 "line": i, "text": line.strip()[:160]})
    return {"check": "no document reasserts that the by-username export requires a token",
            "result": "PASS" if not findings else "FAIL", "findings": findings}


def check_live() -> dict:
    q = dict(contract.LICHESS_EXPORT_QUERY)
    rows = []
    for account, mx in ((PROBE_ACCOUNT, 3), (VOLUME_ACCOUNT, HTML_CAP + 20)):
        query = dict(q); query["max"] = str(mx)
        url = f"{LICHESS}/api/games/user/{urllib.parse.quote(account)}?{urllib.parse.urlencode(query)}"
        req = urllib.request.Request(url)
        req.add_header("User-Agent", ingest_lichess.USER_AGENT)
        req.add_header("Accept", "application/x-ndjson")
        row = {"account": account, "max": mx, "authorization": False}
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                body = r.read()
                row.update(status=r.status, content_type=r.headers.get("Content-Type"),
                           records=sum(1 for ln in body.splitlines() if ln.strip()),
                           bytes=len(body))
        except urllib.error.HTTPError as e:
            row.update(status=e.code, error=e.reason)
        except Exception as e:  # noqa: BLE001
            row.update(status=None, error=repr(e))
        rows.append(row)
        time.sleep(2)

    probe, volume = rows
    checks = [
        {"check": "the by-username export answers 200 without an Authorization header",
         "result": "PASS" if probe.get("status") == 200 else "FAIL", "evidence": probe},
        {"check": "one unauthenticated response exceeds the %d-game HTML enumeration cap" % HTML_CAP,
         "result": "PASS" if (volume.get("records") or 0) > HTML_CAP else "FAIL",
         "evidence": volume},
    ]
    return {"check": "live endpoint contract", "rows": checks,
            "result": "PASS" if all(c["result"] == "PASS" for c in checks) else "FAIL"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true",
                    help="run the text check only; the live check records SKIPPED")
    ap.add_argument("--out", default=os.path.join(HERE, "ENDPOINT_CONTRACT.json"))
    a = ap.parse_args()

    text = check_text()
    live = ({"check": "live endpoint contract", "result": "SKIPPED", "rows": []}
            if a.offline else check_live())
    results = [r for r in (text["result"], live["result"]) if r != "SKIPPED"]
    doc = {
        "_what": "The by-username export contract. The text check is the regression guard; the live "
                 "check is the measurement that voided the stale claim.",
        "_history": "The package inherited a stale comment saying the endpoint answers 404 "
                    "unauthenticated, after the repository had already recorded the correction in "
                    "docs/research/ACCOUNT_BRIDGE_PREREG.md. Player B was ingested through the "
                    "480-game HTML cap because of it, and the cohort was stopped at "
                    "PENDING_RESOURCE for a token it never needed.",
        "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "user_agent": ingest_lichess.USER_AGENT,
        "export_query": contract.LICHESS_EXPORT_QUERY,
        "html_enumeration_cap": HTML_CAP,
        "text_check": text,
        "live_check": live,
        "result": "FAIL" if "FAIL" in results else "PASS",
    }
    json.dump(doc, open(a.out, "w"), indent=1)
    print(json.dumps({"out": a.out, "result": doc["result"],
                      "text": text["result"], "live": live["result"],
                      "findings": text["findings"],
                      "live_rows": [{k: r[k] for k in ("check", "result")} for r in live["rows"]]},
                     indent=1))
    return 0 if doc["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
