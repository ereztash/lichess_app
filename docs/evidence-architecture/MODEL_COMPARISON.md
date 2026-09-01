# M0 against M1

**Stated in advance, before any comparison: complexity is not evidence.** If M0 explains every
observable behaviour M1 explains, M0 wins. M1 survives only by producing a *measurable incremental*
distinction that changes what the system would do next.

---

## The two models

**M0 — MINIMAL**

```text
TRIGGER RECOGNITION
    ↓
ACTION SELECTION
```

Two states. A situation is recognised as belonging to a class, and an action follows. No separable
orientation, diagnosis, policy object, candidate set or control step. Everything between recognition
and action is a single compiled step.

**M1 — RICH**

```text
ORIENTATION → DIAGNOSIS → POLICY ACTIVATION → CANDIDATE GENERATION → CONTROL → ACTION SELECTION
```

Six states. M1 is informed by Galperin's stagewise formation and the *orienting basis of action*
(ориентировочная основа действия), by reflective-activity approaches, by Vergnaud's *schème* and
Pastré's *structure conceptuelle de la situation*, by cognitive diagnosis, and by the chess-expertise
literature.

**None of that makes M1 true here.** Every one of those traditions was developed on tasks with
externally specified correct procedures — arithmetic, industrial process control, medical
diagnosis — where the stages are separable *by construction of the task*. Chess move choice is not
such a task, and the transfer of a decomposition across that gap is exactly the move this programme
is not allowed to make on vocabulary alone.

---

## What each model predicts, and where they differ

| # | observation | M0 predicts | M1 predicts | discriminating? |
| --- | --- | --- | --- | --- |
| 1 | rule-consistent action rises with rating | yes | yes | **no** |
| 2 | detection of the trigger predicts the action | yes — they are one state | yes — via 3 further stages | **no** |
| 3 | detection **without** the action, at a measurable rate | rare; only execution noise | common; three stages can each fail | **yes** |
| 4 | the action **without** detection | possible via a different trigger class | possible via candidate generation alone | **no** |
| 5 | a **generic** cue (non-rule-specific) changes the action | no — nothing to activate | yes — cue supplies the missing stage | **yes** |
| 6 | the engine's move was on the board and was rejected | rare | expected when control is the weak stage | **yes** |
| 7 | correct untimed, wrong under time pressure | possible (recognition is slower) | expected (control and candidate generation are the costly stages) | **weak** |
| 8 | training on T− boundary items changes T+ behaviour | no | yes — diagnosis is separable | **yes** |

**Five of eight observations do not distinguish the models.** That is the first result of this
comparison and it is not a small one: most of what a Learning UX would naturally measure is
consistent with both.

---

## What the repository can say today

**Observation 6 is the one M1 currently wins on, and the win is one-sided.**
`candidate_moves_considered` and the `chose-past-it` reading make "generated the engine's move and
played something else" **directly observable** on live decisions. Under M0 that event is
close to incoherent — recognition selects the action — while under M1 it is exactly what a control
failure looks like.

**It is one-sided in three ways, all documented in the code rather than discovered here:**

1. **Presence only.** A move is in the array only if it was physically placed. Absence does not
   distinguish "not generated" from "not touched" (`shared/reveal.ts`).
2. **The base rate has never been measured.** `shared/reveal.ts` says so in as many words: *"None of
   which matters if it fires on three decisions in a hundred. That number has never been
   measured."*
3. **It needs live decisions.** Imported PGNs carry an empty array, so the branch cannot fire on the
   historical corpus at all.

**Observation 3 has no admissible instrument.** Measuring detection without the action requires
asking about detection, and asking is an intervention — #49 is right that the order effect is a
reactivity estimate, not a nuisance. **And on the only rule class that reached eligibility, the
underlying contrast is void anyway** ([`RECONCILIATION.md`](RECONCILIATION.md) §2.6a).

**Observation 5 has never been tried.** A generic cue — *"is there something here you should
check?"*, containing no rule content — is cheap, is not a rule-specific prompt, and is the single
sharpest M0/M1 discriminator available. It is the highest-ranked item in
[`ROADMAP.md`](ROADMAP.md) that needs no new construct.

**Observation 8 requires a trigger-negative cell that scores the same act.** It does not exist for
`RC-06`, and #49's H23 argues structurally that it cannot exist for any outcome-shaped defensive
rule. It could exist for a **method-shaped** rule, where `B` is a property of the move rather than of
a threat's survival — `RC-11 move-the-threatened-minor` is the worked example and does not branch.

---

## Verdict

> **M1 is not currently supported over M0, and the repository cannot yet run the comparison that
> would support it.**

Precisely:

- **M1 is not refuted.** Observation 6 is real, is already collected, and is not natural under M0.
- **M1 is not supported either.** Its base rate is unmeasured, and the three other discriminating
  observations (3, 5, 8) have no admissible instrument on the current rule class.
- **The prior goes to M0** by the rule stated at the top. Any learner state, any adaptive policy and
  any intervention mapping written against M1's six stages is currently writing against a
  decomposition with **one** partially-observed discriminator.

**What would change this — in order of cost:**

1. **Measure the `chose-past-it` base rate** on live decisions. It is a `SELECT` over data the
   product already stores. If it fires on 3% of decisions, M1's only current support is a rare
   event and M0 stands.
2. **Run the generic-cue contrast** (observation 5). One randomised arm, no rule content, no new
   construct.
3. **Move to a method-shaped rule class** so that observation 8 becomes measurable at all.

**What must not happen:** M1's stages must not be used as the axes of a learner state, an
intervention taxonomy or a POMDP observation space **because they are a well-attested vocabulary
elsewhere.** Under the programme's own rules that is importing a theory because it maps elegantly
onto the product, and this file exists to make that refusal concrete rather than rhetorical.
