# ADR-001 — measuring a blitz decision without changing it

**Status:** accepted, and nothing in the product implements it yet.
**Supersedes:** nothing. **Depends on:** `docs/blitz/AUDIT.md` for what the tree actually does today.

This decides the semantics before the code exists, because the failure this whole exercise guards
against is not a wrong number — it is a number that was never measuring what its name says. A
threshold can be corrected later. A `think_ms` that quietly includes the time somebody spent
answering a questionnaire cannot: the contamination is in the observation, and no analysis
downstream can subtract it.

---

## The four questions, answered first

A reader who takes nothing else from this document should take these.

**1. At what moment does decision time stop being measured?**
At **move commit**, and at no other moment. Not when a confidence question is answered, not when the
engine returns, not when the screen advances. `decision_ms` is frozen by the same event that puts
the move in the record, and after that event no code path may write to it.

**2. May Stockfish run during a blitz game?**
The **analysis** engine: no. Not visibly, not hidden, not "just to warm the cache". Zero calls
before `game_over`, and a test asserts the call count is zero.
The **opponent** engine: yes — that is what makes a game exist. It is a different object with a
different contract (§5), it never returns an evaluation to any surface, and it never gates the
player's clock.

**3. May historical blitz and instrumented blitz enter the same claim?**
No, not by default and not silently. They are different `measurementProtocol` values, and the
admission table refuses a mixed population unless a cell says otherwise in writing. Historical blitz
cannot carry a calibration gap at all (§7), so the question is usually moot — but "usually" is what
a policy exists to remove.

**4. How is a time-pressure claim validated?**
By a `TimedHoldout` — future decisions, in a named protocol and time control, after a frozen
timestamp — and never by a static-position drill. A drill presents a position without the clock
state that made the claim, so it cannot test a claim about the clock (§8).

---

## 1. Measurement protocols

A protocol is *the conditions under which an observation was produced*. It is not a data source and
it is not a feature. Two rows with the same fields and different protocols are different
measurements that happen to share a schema.

| protocol | what it means |
| --- | --- |
| `historical-passive` | A game played elsewhere, imported afterwards. Nothing was measured while it happened; every field is reconstructed from the PGN. **No stated confidence exists, and none can be added retroactively.** |
| `instrumented-standard` | The existing commitment loop: one position at a time, no clock, the player commits before the engine speaks. |
| `instrumented-blitz` | A timed game inside the product, decision time measured to the commit, confidence sampled *after* the commit, all analysis deferred to game end. |
| `lichess-board-api` | Reserved. Not implemented, and out of scope until `instrumented-blitz` is proven. Named here so a later addition is a new value rather than a redefinition of an old one. |

**And a fifth key that is not a protocol.** A row written before this field existed did not have an
unknown protocol — nobody recorded one, and the era contains several. It is `legacy`, a separate
key, refused everywhere by default. This is the argument `evidence-policy.ts` already makes for
`LEGACY_CONTEXT`, applied to a second axis, and it is made the same way for the same reason: a
missing fact must never be filled in with a plausible one.

`protocolVersion` accompanies the protocol. A protocol whose rules change is a different protocol
for analysis purposes even when its name is the same; the version is what lets a later reader tell
the two apart, and it is what `EVIDENCE_POLICY_VERSION` already does for the admission table.

## 2. Clock semantics

**Unchanged, because it is already right.** `shared/pgn-clock.ts` establishes that `clockMsRemaining`
is *the clock the player faced* — the reading **before** their move — and states why: the
after-reading is a consequence of the decision, the before-reading is a condition of it. The live
path means the same thing by the field. That definition holds for every protocol, and the native
blitz core adopts it rather than inventing a second meaning.

The increment is added back to recover thinking time (`spent = previous − current + increment`), and
a missing `TimeControl` header yields `null`, never `0`. Both already hold.

**What is added:** the opponent's clock. Its readings already sit in the same array at the
alternating indices and nothing derives them, so `clock_balance` and `clock_share` are underivable
today. They become derivable; they do not become features anyone is entitled to threshold on.

**Time control is `{ initialMs, incrementMs }`, both nullable, and never a string.** `speed: "blitz"`
is metadata. `3+0`, `3+2`, `5+0` and `5+5` are four different environments, and an analysis that
pools them has to say it is pooling them.

## 3. The authoritative clock in a live game

**`setInterval` is a renderer, not a timekeeper.** The remaining time is *computed*, never
accumulated:

```
remaining_now = remaining_at_turn_start − (performance.now() − turn_start_mark)
```

and the increment is applied once, at the commit event. A tick that fires late, twice, or not at all
changes what is painted and cannot change what is measured. This matters concretely: a backgrounded
tab throttles timers to once a second or less, and a clock built by subtracting a fixed amount per
tick would drift by exactly the amount the browser withheld — in the player's favour, invisibly.

`performance.now()` is the monotonic source for every **duration**. `Date.now()` may be stored as an
**event timestamp** and must never be subtracted from another to produce a duration: it moves when
the system clock moves.

**Timeout is a computation, not an event.** A flag is detected by evaluating the expression above at
the next opportunity — a tick, a commit attempt, a return to the foreground — not by a timer having
fired. A player whose tab was hidden when their clock ran out has still lost on time.

## 4. The decision timestamp, exactly

```
position becomes actionable
│  clock_before captured
│  decision timer starts          ← performance.now() mark
▼
player thinks
▼
MOVE COMMITTED  ────────────────  the only event that freezes decision_ms
│  own clock stops
│  increment applied
│  move written to the record
▼
if this decision was sampled for confidence:
│  instrumentation timer starts   ← a SECOND, independent mark
│  confidence captured
│  instrumentation timer stops
▼
opponent's move becomes visible
```

Two fields, never summed, never merged:

| field | measures |
| --- | --- |
| `decisionMs` | position actionable → move committed |
| `instrumentationLatencyMs` | everything the instrument cost afterwards, `null` when nothing was asked |

`null` and `0` are different. A decision that was never sampled has `null` instrumentation latency.
A decision sampled and answered instantly has a small number. Storing `0` for the first would make
the two unrecoverable from each other, and would make the mean of the column a fiction.

## 5. Two engines, one binary

`OpponentEngine` and `AnalysisEngine` are separate objects with separate contracts, even where they
run the same WebAssembly build behind the scenes.

- **`OpponentEngine`** produces a move. It returns no evaluation, no centipawn loss, no
  classification, and nothing it produces reaches a surface the player can read. It may begin
  computing the moment the player commits — including while a confidence question is open, since the
  player's clock is already stopped — but its move **may not be displayed** until confidence capture
  has closed. Otherwise the instrument would be answering a question the player can already see the
  answer to.
- **`AnalysisEngine`** produces evaluations. In `instrumented-blitz` it is not called at all before
  `game_over`. Not for the player, not for a hidden field, not for a cache.

The separation is a contract and not an optimisation: the moment one object serves both, the
question "did an evaluation exist before the confidence was stated?" stops having an auditable
answer.

## 6. Analysis timing

`analysisTiming` is recorded per decision and takes the values the record already needs to
distinguish:

| value | meaning |
| --- | --- |
| `per-decision` | the engine spoke after this decision, before the next |
| `end-of-game` | the engine stayed quiet until the game ended |
| `post-hoc` | the engine never ran during play at all; the evaluation was computed afterwards from the record |

`historical-passive` is always `post-hoc`. `instrumented-blitz` is always `post-hoc` — which is the
same statement as §5, expressed as a field so that a violation is visible in the data rather than
only in the code.

## 7. Evidence pooling

`shared/evidence-policy.ts` already is the single versioned admission table this needs, and it is
extended rather than replaced. Today it keys on one axis — `DecisionPurpose`. It gains two more:

```
admission = f(consumer, purpose, measurementProtocol, revealTiming)
```

**The reveal-timing axis is owed today, before blitz.** `reveal-timing.ts` states that per-decision
and end-of-game "are not poolable, and every decision records which was in force". The recording
happens; nothing enforces it. A decision made by a player who has been told twenty times how their
last move scored, and one made unaided, are both `purpose: "play"` and both enter discovery. That is
a live defect in the shipped product and it is fixed first, on its own merits.

**Historical accuracy is not calibration.** An imported game carries no stated confidence, and
`shared/import-diagnostic.ts` already refuses to compute a gap from one, in its own words: *"There
is no confidence in this data."* So `historical-passive` can answer *time ↔ accuracy* and can never
answer *time ↔ calibration gap*, and the table says so as a refusal rather than as a caveat.

Every new cell carries a written reason, as every existing cell does. A refusal a reader cannot
explain is one somebody deletes the next time it is inconvenient.

## 8. Validation protocols

`Claim → Drill` becomes `Claim → ValidationProtocol`:

| protocol | for claims that are a property of | why |
| --- | --- | --- |
| `PositionDrill` | the **position** — phase, standing, structure | a position can be re-presented faithfully |
| `TimedHoldout` | the **decision environment** — time pressure, an unusually long think, a clock deficit | it cannot |

A `TimedHoldout` freezes, before any evidence is collected:

```
claim_frozen_at        a timestamp, not a decision index
eligible_protocol      which protocol's decisions count
eligible_time_control  base and increment, because 3+0 and 5+5 are not one environment
target_n               and the stopping rule
verdict criteria       confirm / refute / inconclusive, written before the first decision
```

**No decision that occurred before `claim_frozen_at` may enter.** The existing prospective machinery
freezes on a decision *count* (`atoms.slice(narrowing.decisions_before)`), which is correct for a
claim about positions and wrong for one about time: two records with the same decision count span
different amounts of clock. The boundary becomes a timestamp.

## 9. The chain, and who owns each arrow

```
Lichess / Chess.com history          Native blitz game
         │                                   │
         ▼                                   │  MOVE COMMITTED FIRST
  Game Normalizer                            │  decision timer freezes
  moves, both clocks,                        │  player clock stops
  base + increment,                          │  sampled confidence
  source, speed, protocol                    │
         │                                   ▼
         └──────────────┬────────────  Decision Atom
                        │
                        ▼
                  GAME FINISHED
                        │
                        ▼
              Post-game analysis          ← the ONLY place the analysis engine runs
                        │
                        ▼
              Versioned features          ← derived, never stored instead of raw
                        │
                        ▼
          Protocol-scoped evidence        ← the admission table, extended
                        │
                        ▼
                    Detector
                        │
                        ▼
                     Claim
              ┌─────────┴─────────┐
              ▼                   ▼
      Position Drill        Timed Holdout
```

Each arrow has one owner in code. Two stages inside one component, without a stated reason, means an
abstraction is missing.

## 10. The invariants

Numbered so a review can cite one. An implementation that violates any of these is wrong even when
the screen works.

1. **INV-1** `decisionMs` ends at move commit, and nothing may write to it afterwards.
2. **INV-2** `instrumentationLatencyMs` is a separate field and is never added to `decisionMs`.
3. **INV-3** A committed move advances the board without awaiting any engine.
4. **INV-4** The analysis engine makes zero calls before `game_over` in `instrumented-blitz`, including hidden ones.
5. **INV-5** Raw observations are stored before anything derived. Never a bucket alone.
6. **INV-6** Protocols do not pool without an explicit written cell.
7. **INV-7** Reveal timings do not pool without an explicit written cell.
8. **INV-8** Time control is `{initialMs, incrementMs}`; `speed` alone is not a unit of analysis.
9. **INV-9** Historical accuracy is never used as a stand-in for calibration.
10. **INV-10** A claim about the decision environment is validated by `TimedHoldout`, never by a static drill.
11. **INV-11** The opponent engine and the analysis engine are separate contracts.
12. **INV-12** `null` is not `0`, for every clock, every confidence, and every latency.

## 11. Decisions taken here because they are reversible

The commissioning plan permits choosing a reversible implementation and recording it rather than
asking. Four:

- **The blitz game lives at its own route and its own domain module**, not inside `Home.tsx`. This is
  not a preference: a committed ratchet caps `Home.tsx` at 2,400 lines and 55 `useState`, and it only
  ever goes down, so a fifty-sixth piece of state fails the build.
- **`measurementProtocol` lives on the decision atom**, not only on the game record. The admission
  table filters atoms, and a filter that has to join back to a game to learn what it is holding is a
  filter somebody will forget to apply.
- **Legacy rows get an explicit `legacy` protocol key**, refused by default, never back-filled with a
  guess.
- **This work stacks on the branch this session is constrained to**, which currently carries the
  completed time-representation study in PR #40. Whether that merges first, and whether the
  integration wants its own branch, is the repository owner's call; the commits stay small and
  separable so that either answer remains cheap.

## 12. What this ADR does not decide

- **No threshold.** Not 45, not 120, not a replacement for either. The 117-game study established
  that the shipped cut is structurally unsuitable for blitz — every decision in one bucket, the
  second bucket empty — and that finding licenses no substitute. A new cut requires prospective
  calibration evidence that does not exist yet.
- **No confidence sampling rate for blitz.** `ASK_RATE = 0.15` was argued for on a loop with no
  clock. Whether it survives contact with a three-minute game is an experiment, not a constant to
  copy across.
- **Whether instrumentation is safe at all.** §4 describes a design intended not to contaminate
  `decisionMs`. Whether it contaminates *behaviour* — the next move's think time, the abandon rate —
  is unmeasured, and the plan's own stop condition forbids using instrumented blitz for claims until
  it is measured.
