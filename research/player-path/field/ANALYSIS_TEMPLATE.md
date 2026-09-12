# FIELD analysis

Filled **once**, after the last session. Every line cites a participant file. Empty until then.

Build: `4c395637cd274c5faffb29ebb8429bfdac358eb1`.
Participants: ___  Sessions run: ___  Excluded after screening: ___ (and why)

## 1. Participant matrix

Frozen pass/fail rules only.

| Participant | Segment / context | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | Highest assistance | First failure point |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P1 | | | | | | | | | | | |
| P2 | | | | | | | | | | | |
| P3 | | | | | | | | | | | |
| P4 | | | | | | | | | | | |
| P5 | | | | | | | | | | | |

"Segment / context" is the screening facts that could plausibly condition the result: rating band,
whether they already analyse their games, and which door they took. It is not a persona.

## 2. Raw to interpretation trace

**No aggregate conclusion may exist without participant-level evidence.** One row per diagnosis.
The middle column is a quotation or a log line, not a paraphrase.

| Diagnosis | Raw observation or verbatim it rests on | Participant and file location |
|---|---|---|
| | | |

A diagnosis that cannot fill its middle column does not go in the report. Write it in section 7
instead, as something the run did not establish.

## 3. Primary bottleneck

Exactly one. Take the **earliest failing layer** in the frozen decision rules, not the most
convenient one and not the most interesting one.

- [ ] `VALUE_CONTRACT`
- [ ] `JOURNEY_ORIENTATION`
- [ ] `NEXT_ACTION`
- [ ] `INTERACTION`
- [ ] `TIME_TO_VALUE`
- [ ] `CLAIM_BOUNDARY`
- [ ] `FOUNDER_DEPENDENCE`
- [ ] `PRODUCT_PULL`
- [ ] `NO_BLOCKER_FOUND_IN_THIS_SAMPLE`

The frozen mapping, restated so the choice is mechanical:

| Outcome | Bottleneck |
|---|---|
| M1 fail | `VALUE_CONTRACT` |
| M1 pass, M2 fail | `JOURNEY_ORIENTATION` |
| M2 pass, M3 fail | `NEXT_ACTION` |
| M3 pass, M4 fail | `INTERACTION` |
| M4 pass, M6 fail | `TIME_TO_VALUE` |
| M5 fail | `CLAIM_BOUNDARY` |
| A2 or A3 required for any success | `FOUNDER_DEPENDENCE` |
| M1 to M5 pass, M7 fail | `PRODUCT_PULL` |

**If the result is M1 to M5 pass and M7 fail, it is a product-pull and value problem and must be
named as one.** Do not repair it as a legibility problem, do not rewrite copy for it, and do not
add a surface to it.

Justification, citing section 2:

> 

## 4. Owner decision impact

### Is the two-denominator structure actually confusing?

Answer from the non-pointing probe and from the M2 and M5 verbatims. **Do not infer it from the
fact that the architecture contains two evidence paths.** That was already known before any
participant arrived, and it is not what this run was for.

| Evidence available | What it shows |
|---|---|
| Participants whose unit did not match their screen | |
| Participants who visibly hunted between two numbers | |
| Participants who named a number the screen does not show | |
| Participants who answered the probe cleanly | |

Verdict, one of:

- `CONFUSION_OBSERVED` — with participant-level evidence cited
- `NO_CONFUSION_OBSERVED_IN_THIS_SAMPLE` — the structure was reached and did not stop anybody
- `NOT_REACHED` — participants stopped before a denominator mattered, so the run says nothing about it

> 

### Does the evidence support making `decisions` the single user-facing denominator?

This is `D26`'s deferred question. Answer it only from what was observed.

- Did any participant produce `play` decisions at all, and by which route?
- Which lane did participants actually reach, and which did they talk about?
- Did anyone treat a finished blitz game as progress toward the `60` counter?

> 

## 5. Experimental learning flag

It stayed off, as decided. The question is not whether to turn it on; it is whether the flag is
even the next lever.

**Does the observed failure occur before the point where learning states would matter?**

> 

If the journey fails before a learning object could exist, adding six learning states is not the
next move, and saying so is the finding.

## 6. One next move

Exactly one. The smallest intervention or experiment that addresses the primary bottleneck in
section 3.

No backlog. No redesign package. No new architecture. If two things seem equally necessary, the one
that goes here is the one whose result would change what the other should be.

> 

## 7. What this run did not establish

Everything the sample was too small, too narrow or too short to say. Written plainly, so the next
reader does not borrow authority this run did not earn.

> 
