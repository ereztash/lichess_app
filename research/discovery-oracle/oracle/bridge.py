"""Running the SHIPPED detector over generated worlds, and nothing else.

`scripts/run_discovery_oracle.ts` is the other half. It exists so that no rule this audit judges
-- what a bucket is, what clears a threshold, which candidate becomes the claim -- has a second
definition in Python. What crosses the pipe is data in both directions.

ONE PROCESS FOR A WHOLE EXPERIMENT. `npx tsx` costs about a second to start, which is nothing next
to a run and everything next to a record; a process per record would put the audit's cost in
process spawning and make the harness something nobody re-runs.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from collections.abc import Iterable, Iterator
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
BRIDGE = REPO / "scripts" / "run_discovery_oracle.ts"


def run_detector(records: Iterable[dict], quiet: bool = True) -> Iterator[dict]:
    """Feed records to the product's detector; yield one result per record, in order."""
    if not BRIDGE.exists():
        raise FileNotFoundError(f"the TypeScript bridge is missing: {BRIDGE}")
    env = dict(os.environ, NODE_NO_WARNINGS="1")
    process = subprocess.Popen(
        ["npx", "--yes", "tsx", str(BRIDGE)],
        cwd=REPO,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=None if not quiet else subprocess.PIPE,
        text=True,
        bufsize=1 << 20,
        env=env,
    )
    assert process.stdin is not None and process.stdout is not None

    # Writing and reading from one thread would deadlock the moment either pipe filled, so the
    # writer runs on its own thread and this one drains stdout.
    import threading

    error: list[BaseException] = []

    def write() -> None:
        try:
            for record in records:
                process.stdin.write(json.dumps(record, separators=(",", ":")) + "\n")
        except BaseException as exc:  # noqa: BLE001 - re-raised on the main thread below
            error.append(exc)
        finally:
            try:
                process.stdin.close()
            except BrokenPipeError:
                pass

    writer = threading.Thread(target=write, daemon=True)
    writer.start()

    for line in process.stdout:
        if line.strip():
            yield json.loads(line)

    writer.join()
    code = process.wait()
    if error:
        raise error[0]
    if code != 0:
        message = process.stderr.read() if process.stderr else ""
        raise RuntimeError(f"the detector bridge exited {code}\n{message}", file=sys.stderr)


def to_line(
    record: dict,
    record_id: str,
    world: str,
    split: int,
    masks: bool = False,
    sides: bool = False,
) -> dict:
    """The columnar shape the bridge reads. `truth_gap` never crosses: the detector may not see it."""
    line = {
        "id": record_id,
        "world": world,
        "g": record["g"],
        "ph": record["ph"],
        "st": record["st"],
        "cl": record["cl"],
        "cf": record["cf"],
        "ac": record["ac"],
        "split": split,
    }
    if masks:
        line["masks"] = True
    if sides:
        # Twelve integers per record: each bucket's two split sizes on the derivation half. A table
        # of `cleared` zeroes cannot tell "never separated" from "never had two sides".
        line["sides"] = True
    return line
