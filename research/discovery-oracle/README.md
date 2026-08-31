# The discovery research oracle

Everything here exists to answer the four questions in [`docs/discovery-v2/M0_AUDIT.md`](../../docs/discovery-v2/M0_AUDIT.md).
Nothing here ships, and nothing here is imported by product code.

## Why it is outside the product, and in Python

The questions M0 asks are about **rates**: how often a chain of steps emits a claim that is not
true, and how often it finds one that is. A rate cannot be read off a record, because a real record
does not come with a label saying whether the player really is worse in the endgame. It can only be
measured where the answer is fixed in advance.

The reference implementations for the statistics involved — cluster-robust covariance, subgroup
search — exist already, in Python, and are better than anything that would be written here.
Rewriting one in TypeScript before knowing whether it helps is how a repository acquires a
component nobody can justify. So the split is:

| | |
| --- | --- |
| **Python** | generates worlds whose truth is known, and does inference |
| **TypeScript** (`scripts/run_discovery_oracle.ts`) | runs the **shipped** detector on them |

`research/blitz/dataset.py` already states the rule this follows: *"the semantics belong to the
modules the product itself uses. Python's job here is statistics, not definitions."*

**No rule this audit judges has a second definition here.** What a bucket is, what clears a
threshold, which candidate becomes the claim — all of it runs through `shared/detector.ts` and
`shared/bucket-variable.ts` via the bridge. The one formula reproduced in Python is the shipped
standard error, and it exists only so that the difference between it and the clustered one can be
attributed; `oracle/inference.parity_check` differences it against the real thing on every bucket
of every record, and the worst disagreement measured is **9.7e-17**.

## Running it

```bash
python3 -m pip install -r environment.lock
cd research/discovery-oracle

python3 selftest.py        # is the harness measuring the harness?   ~30s
python3 q1_units.py        # Q1: is a decision an observation?       ~8min
python3 q4_end_to_end.py   # Q4: does the shipped chain survive?     ~6min
```

Each writes to `results/`. Every result file carries its seed, its record counts and its world
parameters, so a number in the audit can be traced to the run that produced it.

`npm ci` first: the bridge runs through `npx tsx` against the working tree.

## The pieces

| file | what it is |
| --- | --- |
| `oracle/worlds.py` | the generative model: null worlds, planted worlds, and the construction that makes a null exactly null |
| `oracle/bridge.py` | streams records to the shipped detector and reads its verdicts back |
| `oracle/inference.py` | the shipped standard error, statsmodels' clustered one, and the ICC |
| `selftest.py` | whether the null worlds are null and the planted ones contain what they claim |
| `q1_units.py` | the standard error against the **true** sampling error, over 6,000 records |
| `q4_end_to_end.py` | the whole chain — search, select, freeze, test — over 8,000 null records and 3,600 planted ones |

## The self-test is not a formality

The first version of `oracle/worlds.py` derived the accuracy probability from the features and then
rounded a confidence onto the product's grid, clipping the result into `(0.02, 0.98)`. `selftest.py`
reported a leak of up to **1.1 points of calibration gap** in every phase bucket of NULL-1 — the
world with no correlation of any kind. The clip was biting hardest where confidence was extreme;
confidence is a function of phase; so the clip *was* a phase effect. Every "null" world carried a
real effect a sixth the size of the weakest planted one.

`oracle/worlds.py` was rebuilt around the order that makes the null exact — `stated` first, then
`p = stated - gap - tilt`, never the reverse — and `oracle/worlds.feasibility` now refuses
parameters that would need a clip rather than quietly applying one.

**Run `selftest.py` before believing any other number in this directory.**

## What is deliberately not here

- **No candidate search.** `pysubgroup` is in the lock file and nothing imports it. M0 gates
  Phase B, and M0 has not passed.
- **No sequential boundaries, no online FDR, no MDL.** Each is a branch conditional on a
  measurement that has not been made.
- **No real records.** There is no committed corpus of live decisions with stated confidence, so
  every number here is from a simulated world. What that costs is stated in the audit's §"What
  these numbers do not cover".
