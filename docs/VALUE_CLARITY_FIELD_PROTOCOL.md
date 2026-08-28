# Value Clarity Field Protocol

Frozen before the first participant. Three small arms, three different questions, deliberately
kept apart — because two of them require interrupting the player, and the third requires that
nobody interrupts them.

Companion to `docs/VALUE_CLARITY.md` (what must be legible) and `docs/ACQUISITION_EVIDENCE.md`
(what the product records).

**These are clarity gates, not market-success criteria.** Continuation rate, return rate and
willingness to pay are deliberately absent from every threshold below. A fully understood product
may still be unwanted; that outcome must remain observable rather than designed away.

---

## Why three arms and not one

Recording `angle=selection` says which message was sent. It does not say what the player
understood from it — and the gap between those two is exactly what the trial is at risk of
mistaking for a product failure.

But the obvious fix (ask them what they expected, in the product, before they decide) teaches the
hypothesis and then records the echo. So the comprehension questions move **out of the product**
and into two separate arms whose participants are excluded from the continuation numbers.

| arm | sees | interrupted | counted in continuation |
| --- | --- | --- | --- |
| A — message comprehension | acquisition message + share card only | before entering | **no** |
| B — first-Reveal comprehension | product through Reveal 1 | after Reveal 1 | **no** |
| C — natural acquisition trial | everything | never | **yes** |

A participant is in exactly one arm. Arm assignment is recorded by the researcher, outside the
app; the product has no notion of it and must not acquire one.

---

## Arm A — Message comprehension

**n ≈ 5–8.** Chess players who have not seen the product.

Show only the acquisition message, and the share card if the message carries a link. **Do not open
the app.**

Open text, in this order, with no answer choices shown first:

> **Q1** מה לדעתך הכלי הזה יעשה בשבילך?
>
> **Q2** במה לדעתך הוא שונה מניתוח משחק רגיל?

Then stop. Do not correct them, do not explain, do not let them proceed into the trial — a
participant who has now been taught the answer cannot be recycled into Arm B or C.

**Measures:** expectation as formed by the message alone. **Answers:** Lens 1 and Lens 2.

---

## Arm B — First-Reveal comprehension

**n ≈ 5–8.** Cold players, no prior exposure.

Let them use the product normally through the **first** Reveal. Then stop and interview.

> **A** מה קרה כאן?
>
> **B** מה קיבלת כאן שלא היה קיים רק במשחק שכבר שיחקת ובניתוח מנוע?
>
> **C** מה עדיין אי אפשר לדעת מכאן?

Open text or interview notes. No examples, no options, no naming of any Reveal branch. If the
participant asks what the answer is, note the question and answer only after C.

**Record alongside every response:** which Reveal branch they actually received
(`reveal_kind_presented` in their ledger). An answer coded `generic_engine_value` from someone who
received `outplayed` is a correct reconstruction, not a comprehension failure — and the coding is
uninterpretable without knowing which branch they saw.

**Measures:** Reveal reconstruction, information-advantage reconstruction, caveat reconstruction.
**Answers:** Lens 3, Lens 4, and the limitation half of Lens 4.

---

## Arm C — Natural acquisition trial

**n ≈ 8–15 initially.** No researcher contact after entry. No interruption after Reveal 1.

Everything comes from the product's own ledger plus the one in-product question after Reveal 2:

- `acquisition_entry` — angle, source, variant, or unknown
- `first_position_presented`
- `decision_committed` — ordinal 1, 2, 5
- `reveal_presented`, `reveal_kind_presented` — including `silence`
- `next_decision_started`
- `value_reconstruction_submitted` — the production question, after Reveal 2
- `return_session_started`

**Exploratory.** Report counts and the per-participant trace. Do not convert proportions into
market estimates, do not compute significance, and do not compare angles as if they were arms of
an experiment — at this n they are labels on a handful of sessions.

---

## Per-participant reconstruction

For every participant in every arm, the analysis must be able to lay out one row:

```
arm │ angle │ first position │ committed │ reveal kind │ what they said │ continued │ returned
```

Arm A rows have the last five columns empty by design. Arm B rows stop after the interview. That
emptiness is the arm working, not data loss.

---

## Preregistered thresholds

Working **clarity** gates. Each is a proportion of coded responses, coded per the scheme below.

| gate | threshold | arm |
| --- | ---: | --- |
| **Problem legibility** — describes a problem about their own decision or choice process, not merely "analyse my game" | 8/10 | A |
| **Differentiation** — reconstructs that something is captured before the engine speaks, which retrospective analysis does not contain | 8/10 | A |
| **Mechanism** — understands why the engine must wait until commitment | 9/10 | A, B |
| **Reveal reconstruction** — among participants who received a process branch, reconstructs the distinction without being taught it in the question | 8/10 | B |
| **Limitation reconstruction** — can say a single decision does not establish a repeating pattern | 8/10 | B |
| **Continuation economics** — can explain that another decision is another independent observation that can test repetition | 8/10 | A, B, C |

Thresholds are stated as x/10 for readability; with n ≈ 5–8 per arm the real quantity is a count,
and it should be reported as a count with its denominator. A gate met at 5/6 is met; the fraction
is a target shape, not a licence to round.

**Not in any gate:** continuation rate, return rate, willingness to pay, session length,
satisfaction. Those measure pull, and pull is the next question, not this one.

---

## Coding scheme — frozen before data

Manual. **No production classifier, and no model in the app.** Coding happens offline, in a
separate artifact from the raw text.

Every coded row keeps: **raw answer, coder, code, optional note.** The raw text is never
overwritten, never normalised, never summarised. Where two coders are used, both codes are
preserved before adjudication and the disagreement is part of the record.

### Problem (Arm A, Q1)
`decision_process` · `confidence_only` · `engine_analysis` · `training` · `unclear` · `other`

### Differentiation (Arm A, Q2)
`pre_engine_evidence` · `personalization_only` · `stronger_engine` · `explanation_only` ·
`unclear` · `other`

### Reveal (Arm B, A+B)
`exact_unique_distinction` · `partial_unique_distinction` · `generic_engine_value` · `unrelated` ·
`unclear`

### Limitation (Arm B, C)
`single_decision_not_pattern` · `partial` · `no_limit_stated` · `unclear`

### Continuation (all arms)
`repetition_evidence` · `more_analysis` · `unlock_progress` · `practice_only` · `unclear`

A response that names the mechanism the question already named is coded `unclear`, not as a
success: the question leaked and the row is evidence about the interview, not about the player.

---

## The limits-order question, deliberately unresolved

The Reveal puts what a decision cannot say **before** what it can. That protects the reader from a
finding they are not entitled to generalise, and it is why the order exists.

There is a competing hypothesis worth taking seriously: the limitation must be **unavoidable**,
but may not need to occupy the first semantic position **in full**.

Two candidates, both documented, **neither shipped by default**:

- **Current** — the full limitation block, then the finding.
- **Compact-limits** — one concise scope line ("החלטה אחת, לא דפוס"), then the finding, with the
  full limitations immediately below and not behind an interaction.

This is decided by Arm B, by asking **both** questions of every participant:

> מה למדת מההחלטה הזאת?
>
> מה עדיין אי אפשר להסיק ממנה?

A variant wins only if **value comprehension improves while limitation comprehension does not
weaken**. A gain on the first with a loss on the second is a loss.

Do not run an underpowered A/B test. Qualitative usability evidence decides this, and if it does
not decide it cleanly, the current order stays — the incumbent is the one that protects the
reader.

---

## What this protocol may not become

- No arm may be reassigned after seeing a participant's answers.
- No question may be reworded between participants within an arm.
- Arm A and Arm B participants never enter Arm C's numbers, in either direction.
- The app learns nothing about arms, thresholds, or codes. If a future build branches on any of
  them, every measurement taken before that build is retired.
