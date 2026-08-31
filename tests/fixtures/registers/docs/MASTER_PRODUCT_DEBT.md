# Master product debt (control fixture)

### R-13 · The component that only ever grew

| | |
| --- | --- |
| type | ops |
| state | **open, and deliberately governed** |
| severity | P2 |
| basis | **verified** — the ceiling is `LINE_CEILING = 40` and `STATE_CEILING = 9` |

**Gate:** `the-file-that-only-ever-grew.test.ts`.

### R-16 · A row whose state cell does not parse

| | |
| --- | --- |
| type | UX |
| state | **mostly addressed** |
| severity | P2 |
| basis | **asserted** |

### R-19 · The think time that was a fraction of a millisecond

| | |
| --- | --- |
| type | correctness |
| state | **fixed** |
| severity | **P0** |
| basis | **verified in a real browser** |

**Closed by** `shared/measured-duration.ts`.
