# Preregistration — the whole account, and the prediction the 1,240 makes about it

**Status: FROZEN.** Written and committed before a single position of this window was scored.
Third and last window in the series that began with `ACCOUNT_BRIDGE_PREREG.md`.

**Frozen at commit:** see `git log -1 --format=%H -- docs/research/ACCOUNT_BRIDGE_FULL_PREREG.md`.

---

## 1. Why this needs its own registration

`ACCOUNT_BRIDGE_PREREG.md` §8 permitted **one** expansion, to a size its own reading computed:
1,240 games. That run happened and returned `registered`. **This window is not in that document**, and
running it under the old one would be the exact move §8 exists to prevent: taking a registration and
adding games to it with no stated expectation, then reporting whatever comes out as if it had been
planned.

So the same discipline applies again, and the same thing makes it worth doing: a number written
down first.

## 2. The one thing this cannot be, and it must be said before the numbers

**This is not a replication of the 1,240-game run. It contains it.** The window is the 2,209 most
recent admissible games; the 1,240 are the most recent 1,240 of exactly those. Roughly **56% of the
decisions are the same decisions**, scored by the same engine at the same depth.

What the extra 969 games add is **older** play — a different stretch of this account's history, at
whatever rating and in whatever time controls it held then. So a result that agrees with the 1,240 is
**not** independent confirmation, and must never be quoted as if it were. What it can do is tell
whether the registration is a property of the whole record or only of its recent half.

## 3. The prediction, computed before the corpus was scored

At 1,240 games: separation **1.1583 pp**, bar **1.1450 pp**.

The bar is two standard errors of a difference, so it falls as 1/sqrt(n). Both bucket counts scale by
2209/1240 = **1.7815**, so:

|                                         |                                         |
| --------------------------------------- | --------------------------------------- |
| predicted bar at 2,209                  | **0.8579 pp**                           |
| predicted separation, if the rates hold | **1.1583 pp**                           |
| predicted margin                        | **0.3004 pp**                           |
| predicted outcome                       | **`registered`**, on `phase-middlegame` |

**The assumption is the whole test**, and it is a heavier assumption here than it was at 1,240: it
requires the rates to hold over 969 games this account played _earlier_, not merely over more of the
same. `phase-middlegame` has read 60.25% at n=790 and 60.24% at n=19,577; the prediction is that
older play does not move it.

### What would refute it, stated before the run

- **Outcome is not `registered`.** The registration was a property of the recent record only.
- **The lowest bucket changes identity.** `phase-middlegame` has been last at both sizes; if older
  games unseat it, the bucket the bridge names depends on which slice of a career it is shown, which
  is a finding about the bridge and not about the player.
- **The margin lands far from 0.30 pp** in either direction. Above it means the older games separate
  _better_ than the recent ones, which the prediction does not expect and cannot explain. Below it
  means the rates moved.

Each of those is a result. None of them licenses a fourth window.

## 4. Co-primary analyses, both declared now

`ACCOUNT_BRIDGE_RESULTS.md` §6 found that `admissible()` does not look at the variant, and said a
variant filter "is the right thing to preregister for the next study, before it has an outcome to be
chosen against." **This is that study**, so both analyses are named here, in advance, with neither
one privileged:

|       |     games | what it is                                                                       |
| ----- | --------: | -------------------------------------------------------------------------------- |
| **A** | **2,209** | every game `admissible()` admits, unchanged. The rule the whole series has used. |
| **B** | **2,161** | standard chess only: 47 `From Position` and 1 `Atomic` removed.                  |

Both are reported. **Neither is "the result" and the other a footnote**, and which one is quoted
first is fixed here: **A**, because it is the rule the earlier windows ran under and the only one
that keeps this window comparable to them. B exists because a standard Stockfish scoring an atomic
game produces a number that means nothing, and a `From Position` game starts outside the opening book
and outside whatever the phase model assumes.

If A and B disagree on the outcome, **that disagreement is the finding** and neither is presented as
the truth.

## 5. What is held fixed

Unchanged from `ACCOUNT_BRIDGE_PREREG.md` §6 and not restated here: the shipped
`stockfish-18-lite-single` over `scripts/sf-wasm.sh`, depth 12, `Threads 1`, `Hash 16`, hash cleared
before every position, the frozen six bucketings, the separability bar at two standard errors, and
`decisions_before: 0`.

Three passes again: canonical, a repeat in a second engine process, and the games reversed. At
121,647 plies this is roughly 85 minutes per pass. The passes are not dropped to save time —
determinism has been confirmed at 48 and at 1,240, and confirming it twice is not a reason to stop
recording it.

## 6. What is forbidden

- **No fourth window.** This is the whole corpus; there is nothing left to expand into. Whatever this
  returns is the last word this account can give.
- **No threshold moves**, no bucket-cut changes, no relaxation of the separability bar.
- **No dropping games** beyond the pre-declared B analysis above.
- **No quoting agreement with the 1,240 as replication.** See §2.

## 7. What this still cannot answer

Everything `ACCOUNT_BRIDGE_PREREG.md` §10 already said, and one thing more. Even at 2,209 games this
is **one account**, and the reading is **accuracy** — a proxy. No calibration gap is measured here,
because an import cannot measure one, and this account has recorded zero live decisions. A registered
bucket is a place to look. Whether looking there finds anything remains the live loop's question, and
no amount of finished games can answer it.
