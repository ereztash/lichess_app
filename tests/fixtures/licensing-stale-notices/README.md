# The compliance record left behind by a dependency bump

`GATE-LICENSE-BOUNDARY`'s second positive-control fixture, and it exists because the failure it
proves is mutually exclusive with the one `tests/fixtures/licensing` proves: check 5 needs
`THIRD_PARTY_NOTICES.md` to be **missing**, and check 7 needs it to be **present and stale**. One
fixture cannot be both, and a detector proven only by inference from another fixture's red count is
not proven.

Everything else here is deliberately clean — the manifest declares `UNLICENSED`, the component map
and its weak-copyleft classification are present and current, the Stockfish licence text is there —
so the single finding this tree produces is the version disagreement itself.
