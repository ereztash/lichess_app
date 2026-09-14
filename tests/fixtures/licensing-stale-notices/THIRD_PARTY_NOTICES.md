# Third-party notices (fixture)

| Component | Version | Licence |
| --- | --- | --- |
| Stockfish | 18.0.8 | GPL-3.0-or-later |

The lockfile beside this file resolves a NEWER patch of the engine than the one this table names.
That is the whole of the fixture: a dependency bump landed and the compliance record did not move
with it, so the distribution conveys an engine whose version, hashes and corresponding-source
pointer are all recorded for a different build — while every test is green.

The newer version string is deliberately absent from this file. Writing it here in prose, even to
explain the fixture, would satisfy the detector's `includes` check and turn this control green.
