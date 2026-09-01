# Four knowledge representations, kept apart

**`LearningRule` is not removed and is not deprecated.** It is the thing the player actually
authors, it ships, and it is the only one of the four with users. What follows separates it from
three things it has been asked to be at once.

The separation exists because a single type doing all four jobs is how *"the player wrote a
sentence"* becomes *"the player has a validated decision policy"* without anything in between being
measured.

---

## 1. `PlayerRule` — what the player can state

**This is `LearningRule` as it exists** (`shared/learning-record.ts`), renamed here only for
contrast. Fields: `trigger`, `mechanism_class`, `missed_signal`, `action_rule`, `exception_rule`,
`predicted_outcome`, `refutation_condition`.

**What it is evidence of:** that the player produced this text at this time, about this decision.

**What it is not evidence of:** that the trigger is a real board condition; that the action is
correct when the trigger holds; that the player can recognise the trigger; that following the rule
helps. **Fourteen of fifteen researcher-designed rule classes failed the domain screen, and the
fifteenth failed this audit** ([`RECONCILIATION.md`](RECONCILIATION.md) §2.6a). A player-authored
sentence has no reason to do better.

**Current handling, verified:** `formLearningRule` files it as `hypothesis` and schedules retrieval
at 1/3/7/21 days **without consulting `mayPrescribe`**. The authority gate exists
(`shared/evidence-authority.ts`), is enforced in `FindingCard`, and is not on the rehearsal path.
That is the architecture finding from D24 and it survives every measurement revision.

## 2. `DecisionScheme` — hypothesised operational organisation

**A candidate only. Not to be implemented in production.**

```ts
DecisionScheme {
  situation_class
  orienting_cues
  diagnostic_invariants
  candidate_generation_policy
  action_constraints
  control_checks
  exception_conditions
}
```

**This is M1 with a type signature**, and [`MODEL_COMPARISON.md`](MODEL_COMPARISON.md) is why it must
not ship. Six of its seven fields name stages that are `UNOBSERVED` or `NOT-A-SEPARATE-STATE-YET` in
[`INFERENCE_CHAIN.md`](INFERENCE_CHAIN.md). Writing the type creates seven places for a value to
live, and a field that exists gets populated — by a default, by a heuristic, or by a label chosen
because the schema asked for one.

**The test it must pass before it may be implemented:** does populating any field change a decision
the system would otherwise make differently? That is an empirical question about incremental
identifiability ([`INCREMENTAL_EVIDENCE_VALUE.md`](INCREMENTAL_EVIDENCE_VALUE.md)), not a design
question.

**One field is measurable today and is worth keeping separately from the rest:**
`candidate_generation_policy` — because `candidate_moves_considered` already observes candidate
generation, one-sidedly (V5, V6).

## 3. `BehavioralTransferSpec` — what can be observed

What a claim about a rule must be cashed out as, before anyone may say the rule was used.

```text
trigger_predicate      pure function of the position, no move parameter, C10-audited
                       AND its scope predicate audited  (RECONCILIATION §2.2)
response_predicate     ONE predicate, identical on both cells        <-- the new requirement
positive_cell          items where the trigger holds
negative_cell          items where it does not, scored by the SAME response predicate
chance_rate            per item: share of legal moves satisfying the response predicate
harm                   regret of the prescribed act, and of the worst permitted act
delay                  0 for immediate, >0 for retention
cue                    none / generic / rule-specific
setting                task / drill / ordinary play / blitz
```

**`response_predicate` being one predicate is the requirement this programme did not have and now
does.** `RC-06` fails it. So does any rule of the form *"if THREAT, act so that THREAT is gone"*,
structurally (#49, H23) — and the failure is visible in `chance_rate`: **.994 of legal moves satisfy
`RC-06`'s rule on trigger-negative items.** A spec whose negative cell has a chance rate near 1 has
no negative cell.

## 4. `EvidenceState` — what has actually been supported

The level a claim has reached, attached to the claim rather than to the object it is about. The
repository already has this ladder (E0–E7) and already has an authority vocabulary
(`shared/evidence-authority.ts`, `AUTHORITY_ORDER`, `mayPrescribe`). **Nothing new is proposed.**

What this file adds is where the four representations currently sit:

| representation | evidence level | may be shown to a player as |
| --- | --- | --- |
| `PlayerRule` | **E0** — a sentence, at the moment of authoring | *"what you said"*, and nothing else |
| `DecisionScheme` | **E0** — a hypothesis about hypotheses | **nothing. Not implemented.** |
| `BehavioralTransferSpec` | **E1–E2** for the domain half; **E0** for the human half | not player-facing |
| `EvidenceState` | shipped | the authority word already in `FindingCard` |

**The rule that follows, and it is the sequencing constraint D24 reached from a different
direction:** rehearsal strengthens whatever it is pointed at. Pointing it at an E0 sentence is not a
small error that better content would fix later — it is an amplifier attached to an unvalidated
sign.
