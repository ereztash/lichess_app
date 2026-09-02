# Implementation map — what was built, what was not, and why the second list is longer

**One thing was built into the product's own machinery this cycle: a gate.** Everything else is
research code, frozen data, and specifications. No production behaviour changed, no flag was flipped,
no surface was added, and `VITE_EXPERIMENTAL_LEARNING_ENABLED` is off, exactly as it was.

That is the correct outcome given `BARRIER_DECISION.md`, and this file exists to make the restraint
auditable rather than to claim it.

---

## 1. Built

| what | where | why now |
| --- | --- | --- |
| **`GATE-CUE-PLAYER-OBSERVABLE`** | `scripts/cue-scan.ts`, wired in `scripts/run_gates.ts` | refusal 9 of the packet spec's ten, and the only one that could be closed without a participant. Every rule-class trigger, plus every function it reaches inside the module, must compute from the board alone |
| its positive control | `tests/fixtures/cue/research/measurement/rule_classes.py` | three triggers: one honest, one that reads a centipawn score, one that is four clean lines calling a helper that does. The third is the case a declaration-only scanner would pass |
| the freeze verifier | `scripts/learning-v3/verify_freeze.py` | checks the three things a hash cannot: one commit introduced both frozen documents, it touched nothing else, and no later commit modified them |
| research instruments | `research/learning-v3/{gate_a,minimal_twins,gate_b,sham_twins,played_move_cost,extract,preserve,cache}.py` | the measurements this cycle ran |
| the preserved corpus | `research/learning-v3/corpus/` | 70,258 evaluations, content-addressed, 4.3 MB, re-hashed by `GATE-RESEARCH-RECONCILED` on every gate run |

**The gate passes today and fixes nothing.** Every trigger in the register is already board geometry.
What it fixes is that nothing stopped the next one from not being — and the first version of the
scanner reddened on the real tree twice, both times on a docstring saying *"no SEE, no engine"*,
which is exactly the *"gate that can only fail through an irrelevant implementation detail"* Phase 14
forbids. Comments and docstrings are stripped, with their line count preserved so a finding still
points at the real line.

---

## 2. Deliberately not built

| what the mission sketches | why not |
| --- | --- |
| the `BehavioralPacket` type in `shared/` | it is specified, not admissible. A type in `shared/` is a commitment the evidence has not earned, and three of its ten refusals cannot be checked |
| `ONE THING FOR THE NEXT GAME` as a surface | `BARRIER_DECISION.md` says the packet is not worth showing for the only class that reached it |
| a `packetVisible` row on `ModeContract` | it would be a permission for an object that does not exist. Named in `NATURAL_RETEST_SPEC.md` §4 as the smallest change that would make the contamination rule structural, and left for the cycle that has a packet |
| the opportunity matcher | the mechanism is cheap; the base rate makes it pointless for `RC-05`. `NATURAL_RETEST_SPEC.md` §6 |
| `GATE-BEHAVIORAL-PACKET-AUTHORITY`, `GATE-RETEST-FROZEN-BEFORE-DECISION`, `GATE-CONDITIONAL-DISCRIMINATION`, `GATE-NO-LEARNING-EVIDENCE-DURING-DECISION`, `GATE-PACKET-REVERSIBLE` | each guards an object that does not exist. A gate over nothing passes forever and teaches the next reader that the question is settled |
| flipping `VITE_EXPERIMENTAL_LEARNING_ENABLED` | `D25` is why it is off, and nothing here changes `D25` |
| repairing `finishLearningTransfer`'s use of `accurateDecision` | **the sharpest omission, and deliberate.** See §3 |

---

## 3. The one defect found and not fixed

`AUTHORITY_MAP.md` §2: the product scores rule use as **engine agreement**. `finishLearningTransfer`
counts a transfer position as a success when the recalled text clears a word-overlap floor **and**
`accurateDecision` says the move was close enough to the engine's. Nothing in that expression asks
whether the move satisfies the rule.

**It is a real defect** — `KNOWLEDGE_MAP.md` §H names the exact substitution as a failure mode — and
it is left alone for three reasons:

1. **It is unreachable.** The flag is off; no player has ever run a transfer test.
2. **Fixing it means giving the product a `satisfies` predicate**, which is the packet's cue and
   action model, which is not admissible.
3. **`RNL-11`** — do not change the intervention and the instrument together. This cycle changed the
   measurement model (`ACTION_SET_AUDIT.md` §7). Changing the product's grading in the same pass
   would make the next comparison uninterpretable.

Recorded here rather than filed away, because `RNL-10` says failed history is provenance and an
unfixed defect that nobody wrote down is the kind that gets rediscovered by a player.

---

## 4. If the next cycle builds the packet, the order

Derived from the repository's own laws rather than proposed fresh.

1. **`C12` first, then the class.** Do not implement against `RC-05`.
2. **The predicate before the type.** `cue` and `action` are `rule_classes.py` entries with a hashed
   version. The `BehavioralPacket` type references them; it does not restate them.
3. **Shadow before ownership.** `INERTIAL_UX_LAWS.md` LAW 3, and `next-action-shadow.ts` is the
   working example: derive, log what it *would* have said, inspect the disagreements, and only then
   let it decide anything. Each shadow row carries `blind` — the inputs the surface could not supply
   — because a disagreement caused by a missing input is not the same finding as a wrong derivation.
4. **Judge before contender.** The opportunity matcher is a classifier that will decide what counts
   as evidence, so it gets an oracle first. The frozen corpus is one: 4,620 labelled trigger-positive
   items, 4,821 trigger-negative, **1,100 hard negatives**, and a matcher that disagrees with the
   predicate that labelled them is wrong by construction.
5. **The retest before the surface.** `created_before_decision` has to be true by construction, not
   by intention, and `GATE-PREREG` already holds this shape for drills.
6. **The surface last, and small.** One cue, one action, one primary action, everything else behind
   disclosure. `GATE-ONE-PRIMARY-ACTION` and `GATE-DECISION-FOCUS` already enforce the shape.

---

## 5. Files this cycle touched outside `docs/learning-v3/` and `research/learning-v3/`

| file | change | why it is not scope creep |
| --- | --- | --- |
| `scripts/run_gates.ts` | one gate registered | the deliverable of Phase 14 |
| `scripts/cue-scan.ts` | new | that gate's predicate |
| `scripts/research-scan.ts` | three relations registered | `GATE-RESEARCH-RECONCILED` refused to pass until the new hashes were classified. The gate asked; this is the answer |
| `README.md` | one gate row, numeral 31 → 32 | `tests/docs/the-table-that-fell-behind.test.ts` fails otherwise, by design |
| `tests/docs/the-table-that-fell-behind.test.ts` | Hebrew numeral for 32 | same test |
| `tests/fixtures/cue/**` | new | the gate's positive control |

**Nothing else.** No restructuring, no CSS, no file splitting, no renamed research history, no
deleted experiments, no rewritten verdicts, and `experiment/n-of-1-timing-policy` is untouched at
`d1cdc02`.
