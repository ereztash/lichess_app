# Field companion protocol

Companion to `docs/VALUE_CLARITY_FIELD_PROTOCOL.md`, which is **frozen** and is not edited by this
work. This document adds observations and one arm. It rewords nothing.

> **Where this document and a frozen document disagree, the frozen document wins, and the
> disagreement is a defect in this document.**

The frozen protocol's own retirement rules apply here unchanged: an arm may not be reassigned after
answers are seen, a question may not be reworded between participants within an arm, and Arm A and
Arm B participants never enter Arm C's numbers.

---

## What this adds, and why it needed a companion rather than an edit

The frozen protocol asks whether a cold player can **reconstruct** what the product does. It does
not ask two things that this work's ledger made pressing:

1. **Whether the instrument had to be explained at all**, and which sentence caused the hesitation.
   The frozen protocol measures comprehension of the *product*; the ledger is about the cost of
   comprehending the *instrument*, which is a different quantity and is the one the whole
   `instrument literacy vs decision literacy` distinction turns on.
2. **Whether anything asked before the result changed how the player thought about the position
   while they were still deciding.** This can only be asked post hoc, and asking it at all requires
   a place to put it that is not inside the frozen question order.

Both are additions. Neither touches Arms A, B or C as written.

---

## The cold-user rule, restated because it is the easiest one to break

> Say **`תשחקו כרגיל`** and nothing else.

- Do not explain the model, the ordering, the confidence scale, the reads, or why the engine waits.
- Do not use think-aloud **during the evidence window**. Narrating a decision is itself a
  metacognitive prompt and it puts a reactivity path straight onto `seconds_taken`, which is a
  detector axis. Whether it would move the number is unmeasured and beside the point: the arm would
  no longer be the arm everyone else is in, and nothing in the row would say so.
- Do not answer a question about what the product does until the observation window is closed. Note
  the question, its timing and its exact words; the question is data.
- If the participant is stuck and cannot proceed, the session ends and is recorded as an assistance
  event. **Do not rescue them into a first decision.** A first decision reached with help is not a
  first decision, and the frozen protocol's stop condition depends on that distinction being clean.

---

## Arm D -- instrument literacy, added

**n ≈ 5-8.** Cold players. Runs alongside Arm B, on the same session, with **no extra question
before the frozen A/B/C order**. Everything below is either observation during the session or a
question asked after the frozen questions are finished.

### Captured by the observer, before the first reveal

Silent observation only. No prompts.

| # | observation | how it is recorded |
| --- | --- | --- |
| D-1 | did they reach a first committed decision? | yes / no |
| D-2 | was any assistance given, of any kind, including a reassuring noise? | yes / no, plus what was said, verbatim |
| D-3 | which on-screen sentence preceded the longest pause? | the sentence, quoted from the screen, plus the pause in seconds |
| D-4 | time from the position appearing to the first move placed on the board | seconds |
| D-5 | time from the position appearing to the commit | seconds |
| D-6 | did they leave the position without committing, or navigate away from the board? | count |
| D-7a | pauses over 5s: how many, how long, and what was on screen at each | count, seconds, quoted sentence |
| D-7b | did they re-read: eye or cursor returning to a block already passed, or scrolling back up | count |
| D-7c | did they reopen a step they had already answered? | count, and which step |
| D-7d | did they change the move after placing one? | count |
| D-7e | did they open the help overlay, or the `למה?` disclosure? | yes / no, and at what point in the flow |
| D-7f | did they attempt an action the state does not offer: pressing a collapsed step, clicking a non-interactive sentence, dragging a piece the board refuses | count, and what they aimed at |
| D-7g | did they say anything, unprompted? | **verbatim**, never paraphrased |
| D-7h | did they stop without committing, and at which step was the panel? | yes / no, plus the open step |
| D-8 | did the architecture of the product have to be explained for them to proceed? | yes / no, and which part |
| D-9 | which steps did this decision actually ask for? | from the screen: the rendered step legends |

**D-7 used to be one row reading *"visible confusion, in the observer's words"*, and that was an
interpretation of a person where observables were available.** "Confused" is a state inside somebody
else's head; an observer who writes it down has already decided what a pause meant, and every later
reading of that row inherits the decision without being able to see it. The eight rows above are
what an observer can actually witness, and they are the things the interpretation was standing in
for.

> **Describe what the interface demanded and what the person did. Do not infer a state when an
> observable exists.**

An observer note in free text is still welcome and still valuable -- but it is a **note**, not a
measure, it is coded by nobody, and *"confused"* may not be a primary reading. If the note is the
only evidence for a finding, the finding is about the observer.

**D-9 is not bookkeeping.** `stepsFor` gives four different screens depending on the purpose and a
hash of the position. A comprehension result that does not record which screen the participant met
is uninterpretable, in the same way and for the same reason that the frozen protocol requires
`reveal_kind_presented` beside every Arm B answer.

### Asked after the frozen Arm B questions, in this order

Only after A, B, C and the two limits-order questions are finished.

> **D-i** מה היה ברור לך מיד, ומה הבנת רק אחרי שניסית?
>
> **D-ii** היה משהו על המסך שלא הבנת למה הוא שם?
>
> **D-iii** אם היית מסביר לחבר מה עשית כאן, במשפט אחד -- מה היית אומר?

### Coding, frozen before data

**Instrument cost (D-i, D-ii):**
`no_instrument_learning` · `learned_by_trying` · `needed_explanation` · `still_unclear` · `other`

**Self-description (D-iii):**
`about_my_decision` · `about_the_position` · `about_the_tool` · `unclear` · `other`

`about_the_tool` is the failure this whole programme is named after: a player who describes what
they did as *"I filled in a form about a chess position"* has learned the instrument.
`about_my_decision` is the target.

### Threshold

| gate | threshold | arm |
| --- | ---: | --- |
| **Reached without explanation** -- committed a first decision with no assistance and no explanation of the product's architecture | 8/10 | D |
| **Self-description** -- describes what they did in terms of their own decision or the position, not in terms of the tool | 7/10 | D |

Reported as counts with denominators, per the frozen protocol's own note about `x/10` at n ≈ 5-8.

---

## Arm E -- post-hoc reactivity, added

**Asked once, at the very end of a session, of Arm B and Arm D participants only. Never during a
decision. Never before a reveal.**

> **E-i** משהו שביקשנו ממך לפני התוצאה גרם לך לחשוב אחרת על העמדה בזמן ששיחקת?
>
> **E-ii** (only if E-i is yes) מה, ומה זה שינה?

### Why this is worth almost nothing on its own, and is asked anyway

**Self-report of reactivity is weak evidence in both directions.** A participant who says
*"the confidence question made me look again"* may be constructing an explanation after the fact.
A participant who says *"no, nothing"* has not established the absence of an effect, because the
effects at issue are exactly the kind people do not notice.

So this arm may **generate hypotheses and may not confirm or refute one.** A named surface here
goes to the experiment backlog; it does not license a change. Confirmation requires
`MEASUREMENT_REACTIVITY_EXPERIMENTS.md`, where the comparison is behavioural.

Recorded per participant with which surfaces they were actually exposed to, because most are
conditional:

| surface | exposure is conditional on |
| --- | --- |
| the confidence question | `confidenceIsAsked`: always on `first`/`anchor`/`drill`/`transfer`, else a hash draw at `ASK_RATE` |
| the read chips | `readsAreAsked`: as above, minus `first` |
| `.commitment-tension` | the answers themselves: a stated tension |
| the counterfactual probe | `probe.assignment`, ~35% of eligible |
| `.context-loop`'s grading sentences | whether a claim exists |
| `.context-why`'s body | whether they pressed `למה?` |

**Nothing in the record stores the middle four.** The probe's arm is stored; the rest is not. So
Arm E's exposure column has to be filled by the observer, by hand, from the screen. That is a
finding about the record, not about the protocol, and it is the first item in the experiment
backlog for a reason.

---

## Coding scheme additions

Frozen before data, in the same shape as the frozen protocol's.

### Instrument cost (Arm D, D-i and D-ii)
`no_instrument_learning` · `learned_by_trying` · `needed_explanation` · `still_unclear` · `other`

### Self-description (Arm D, D-iii)
`about_my_decision` · `about_the_position` · `about_the_tool` · `unclear` · `other`

### Reactivity report (Arm E)
`named_a_surface` · `denied_any_effect` · `unclear`

`named_a_surface` records **which** surface, verbatim, and is a hypothesis rather than a finding.

The frozen protocol's rules apply to all three: raw text is never overwritten, normalised or
summarised; both coders' codes survive adjudication; nobody codes their own participant.

---

## Per-participant reconstruction, extended

The frozen protocol's row, with four columns appended. The frozen columns keep their meaning and
their order.

```
arm │ angle │ first position │ committed │ reveal kind │ what they said │ continued │ returned
    │ steps asked │ assistance │ instrument code │ reactivity report
```

`steps asked` comes from D-9. Empty for Arms A and C by design.

---

## What this companion may not become

- It may not add a question **before** any of the frozen ones, in any arm.
- It may not be used to justify a change to the confidence question, the read chips or the probe.
  Those are LAW 9 and they change through the experiments in
  `MEASUREMENT_REACTIVITY_EXPERIMENTS.md` or they do not change.
- It may not convert Arm E's self-reports into a reactivity finding.
- It may not be run on a build whose commitment screen differs from the one under test. Every row
  records the build's `gitSha`.
- Arm D observations do not enter Arm C's continuation numbers, for the same reason Arms A and B
  do not: the session was interrupted.

---

## What would stop these arms rather than produce a result

- A participant cannot reach a first decision on either route. That is the frozen protocol's own
  stop condition: a **liveness defect**, the trial pauses, and the authority moves back to REPO.
- The observer answers a question during the evidence window. That session is retired.
- Any question in this document is reworded between participants within an arm. Everything measured
  before the change is retired.
