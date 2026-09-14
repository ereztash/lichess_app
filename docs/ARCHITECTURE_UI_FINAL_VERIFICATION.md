# Architecture → UI: final verification

What was checked, how, and what it does and does not establish.

---

## 1. Automated

`npm run verify` **EXIT=0**:

| | |
| --- | --- |
| tests | **3,421 pass**, 38 skipped, 0 fail |
| gates | **53 pass**, 0 fail, 0 not-measured |
| positive controls | **53 red** — "All implemented controls went red" |
| bundle | within budget (entry raw 684.5 / 685 kB) |
| typecheck + inverted control | pass |

Four gates are new, each with a control demonstrated red:

| Gate | Asserts | Its control |
| --- | --- | --- |
| `GATE-CANONICAL-ACTION-REACHABLE` | every canonical kind that names an act has a renderer | a presenter set that renders one kind |
| `GATE-SEMANTIC-PRESERVATION` | a presenter may reword an act, never rename it | a presenter that rewords `continue-drill` into "new game" and stamps `play-blitz` |
| `GATE-NO-LOCAL-PRODUCT-POLICY` | no surface names a product act outside the contract | a component branching on local state to a hardcoded act |
| `GATE-NO-FABRICATED-STATE` | unread stays unsound; unimplementable is not blindness | the ladder as it was, charging every unobserved input |

---

## 2. Browser verification

Chromium against the production build, fresh context per row, record seeded through `localStorage`
in the shape `local-record-store.ts` reads. **No UI was mutated**; every state is constructed from
record rows the product itself writes.

| # | Canonical state | Canonical action | Surface | Rendered primary act | Result |
| --- | --- | --- | --- | --- | --- |
| A | empty record, first visit | `play-first-decision` | record | `play-first-decision` — *"קחו החלטה אחת"* | **PASS** |
| B | empty record, returning | `play-first-decision` | resume | `play-first-decision` | **PASS** |
| C | one decision, **first** visit | `play-blitz` | record | `play-blitz` — *"שחקו משחק קצר"* | **PASS** |
| D | one decision, returning | `play-blitz` | resume | `play-blitz` | **PASS** |
| E | **open drill 2/3**, returning | `continue-drill` | resume | `continue-run` — *"חזרה לסט"* | **PASS** |
| F | **open drill 2/3**, first visit | `continue-drill` | record | `continue-run` | **PASS** |
| G | **untested rule**, returning | `test-hypothesis` | resume | `test-hypothesis` — *"בדקו את הכלל שכתבתם"* | **PASS** |
| H | drill the player **closed**, returning | `play-blitz` | resume | `play-blitz` | **PASS** |

Exactly one primary act rendered per state. **Zero page errors in every row.**

Rows E and F are the collision this migration is about: a set in progress outranks a new game, on
both surfaces, on a first visit as well as a return. Row H is its negative control — an abandoned
drill is *not* revived.

### The repository's own walks

| Walk | Result |
| --- | --- |
| `a-walk-the-derivation-can-be-wrong-about` | **PASS** — both stops agree, both proposals `[sound]` |
| `axe-past-the-commit` | PASS |
| `cumulative-layout-shift` | PASS |
| `what-a-colour-and-a-direction-mean` | PASS |
| `the-words-a-stranger-must-read` | PASS |
| `content-security-policy` | PASS |

### What the walks caught that unit tests did not

Three real defects in this work, all found against the built app:

1. **A render loop.** `useProductState` builds a fresh object every render, so reporting the
   canonical answer upward set state unconditionally, which re-rendered, which reported again. The
   front door's offer never settled and the derivation walk read "the screen offers none".
2. **Two controls, one act.** On a cold front door both `FirstDecision` and the new canonical
   control rendered `play-first-decision` — LAW 2's defect, caught by the primary-fill walk.
3. **A gap the whole migration was for.** A **first visit with a non-empty record** — the
   second-device case — had no renderer for the canonical act at all, because `ResumeScreen` mounts
   only when returning.

### NOT_VERIFIED

| State | Why |
| --- | --- |
| active transfer mid-run | seeding one truthfully needs a `learning_transfers` row plus per-position observations plus a rule; constructible, not constructed |
| claim awaiting its forward test (`test-claim`) | needs a scored claim with a separation, which needs a real analysed blitz record |
| `wait-analysis` with a live queue | needs a pending game the queue is actively scoring; timing-dependent |
| `review-event` | **unreachable by construction.** No seen-set exists and none was built |
| recoverable failure paths | exercised by `RevealFailure`'s own tests, not by this walk |

None was faked with arbitrary UI mutation.

---

## 3. Definition of done, scored

| # | Condition | State |
| --- | --- | --- |
| 1 | the UI no longer operates as a parallel product-policy engine | **met** — four policy sites removed, four documented exceptions |
| 2 | canonical state contains what real decisions need | **met** — `ARCHITECTURE_UI_STATE_MAP.md` §2 |
| 3 | one canonical policy determines semantic next action | **met** — `proposeNextAction`, unchanged branch order |
| 4 | every meaningful production surface consumes that intent | **met for Resume, PostGame, Record**; in-run surfaces exempt with reasons |
| 5 | surfaces retain presentation freedom | **met** — two voices, same act, §6 of the state map |
| 6 | hardcoded fallbacks removed or justified | **met** — ledger in `ARCHITECTURE_UI_AUTHORITY_MIGRATION.md` §1 |
| 7 | continuation state crosses the boundaries it needs to | **met** — already true from PR #121; verified again in rows E/F |
| 8 | missing state is not fabricated | **met** — `GATE-NO-FABRICATED-STATE`, control red |
| 9 | production behaviour covered by red-proven gates | **met** — 4 new, all controls red |
| 10 | browser verification confirms agreement | **met** — 8 rows, 0 errors, plus the repo's own walks |
| 11 | old FIELD evidence stays truthful | **met** — `docs/FIELD_STIMULUS_CUTOFF.md`; nothing rewritten |
| 12 | remaining human questions classified | **met** — §4 |

---

## 4. `FIELD_REQUIRED` — what none of this establishes

Everything above is about code paths and rendered controls. It establishes architectural
consistency, reachability, state truthfulness, policy coherence and rendered-action correctness.

It establishes **nothing** about a person. Specifically, all of these remain open and are
**`FIELD_REQUIRED`**:

- whether a player **notices** the canonical action;
- whether they **understand** what it is asking;
- whether they **agree** it is the right next thing;
- whether they grasp **why finishing a registered set matters** more than another game;
- whether the change produces **value** they can feel;
- whether they **prefer** this flow to the one it replaced;
- whether they **return**.

A player being shown the right act is not a player acting on it. Treating the eight PASS rows above
as evidence about people would be exactly the conversion of implementation correctness into UX
evidence that §15 forbids, and no sentence in this document does it.

`docs/FIELD_STIMULUS_CUTOFF.md` records that the existing freeze no longer describes this product,
which of its assumptions are void, and that a new freeze is an owner decision that was not taken
here.
