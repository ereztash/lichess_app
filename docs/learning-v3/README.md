# `docs/learning-v3/`

**The question:** what is the *minimum* information a player must receive after one game so that
their action is more likely to change appropriately in the next naturally occurring relevant
situation?

Not understanding. Not engagement. Not perceived usefulness. Not drill completion. Not remembering
an explanation. The target is **a change in an uncued future chess decision**.

---

## Read in this order, because the order is the method

```text
FROZEN_EXTERNAL_SYNTHESIS.md   E1-E5, fixed before the repository was read
FALSIFICATION_REGISTER.md      what would make each of E1-E5 wrong, fixed at the same moment
FREEZE.json                    their hashes, checked by GATE-RESEARCH-RECONCILED on every gate run
↓
BASELINE.md                    what the tree actually says, including where it contradicts the brief
↓
EXTERNAL_REPO_CROSSWALK.md     mechanism against mechanism, not summary against summary
↓
ACTION_SET_AUDIT.md            Gate A -- is the final action a valid observation of rule use?
EXCHANGEABILITY_AUDIT.md       Gate B -- are T+ and T- comparable enough to attribute a difference?
COMPUTE_VALUE_EXTRACTION.md    what the hour of Stockfish bought beyond the gate it was run for
↓
BARRIER_DECISION.md            which barrier is first, and therefore which packet
BEHAVIORAL_PACKET_SPEC.md      the object, before any component
NATURAL_RETEST_SPEC.md         how a future opportunity is recognised without telling the player
INTERVENTION_EXPERIMENT.md     the smallest comparison that answers a product decision
FIELD_PROTOCOL.md              what recruiting would require
IMPLEMENTATION_MAP.md          what would be built, and in what order
AUTHORITY_MAP.md               one authority per question, named
ADVERSARIAL_PASS.md            fifteen attacks; the two that landed, and the files they corrected
FINAL_REPORT.md                one outcome, chosen
```

The first three files were committed **before** any learning document was read, in a commit that
touches nothing else. That is not a style preference: a repository this size can find external
support for almost anything it already contains, and the only defence against
`repo idea → search literature until it agrees` is to fix the external position first and let the
audit contradict it. `scripts/learning-v3/verify_freeze.py` checks that the crosswalk commit is a
descendant of the freeze commit, that no later commit edited the frozen documents, and that the
freeze commit changed nothing else.

## The rule about downstream documents

If a gate fails, the documents after it are still written — as **`NOT ADMISSIBLE`**, naming the exact
blocker. They do not contain a design that the evidence does not license. A specification written
past a failed gate is not a plan, it is a wish with a filename.

## Arithmetic

`research/learning-v3/`, against the published corpus at the published seed. The scan reproduces
`docs/measurement/`'s manifest exactly — 60,834 games seen, 60,000 used, 180,000 positions, 12,119
in check, 580,852 records, identical trigger counts on all seventeen classes. A number that cannot
be reproduced is an anecdote.

## What this directory does not contain

**Any human data.** Zero participants, which remains the correct cost until the pre-human gates
finish. Every falsifier whose measurement names ΔP(Y|X) is marked `NOT EXECUTABLE` with its blocker
rather than argued around.
