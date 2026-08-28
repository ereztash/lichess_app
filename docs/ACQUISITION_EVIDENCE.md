# Acquisition Evidence Constitution

The next trial does not measure chess. It measures whether this chain holds:

```
acquisition promise → expectation → first action → unique payoff → continuation
```

Eight to thirty people will arrive from a message with a link in it. When it is over, we have to
be able to tell these eight outcomes apart:

1. nobody wanted the promise
2. the promise brought the wrong expectation
3. the first-use flow lost them
4. the interaction did not communicate causality
5. the reveal was generic
6. the unique reveal happened and was not noticed
7. it was noticed and was not worth continuing for
8. it was understood and they wanted more

Each is a **different pattern across the same seven observations**. Collapse any two observations
and two of those outcomes become the same row — which is how a trial comes back saying "it did not
work" with nothing to act on.

**The one rule.** An event records what happened. It never records the conclusion we hope to draw
from it. `user_understood_value` is not a shorter way of writing this down; it is the analysis done
in advance and stored where nobody can check it.

---

## 1. What already existed, and what was reused

Audited before anything was built. `existing fact | where | persistence | consumer | reused?`

| fact | where recorded | persistence | current consumer | reused |
| --- | --- | --- | --- | --- |
| visit opened (page load) | `progress-record.ts` `beginVisit` | localStorage, ring of 20 | self-check drawer | **yes** — the acquisition ledger is the same store |
| commitment-screen attempt: steps done, step open, seconds, refusals, outcome | `progress-record.ts` `recordAttempt` | same | self-check drawer | **yes**, untouched — it answers a different question (where the *form* got expensive) |
| visit count, last visit at | `context-engine.ts` `readUsage` | `decision-lab-usage-v1` | `ContextRibbon` gap line | **no** — it is read by the interface, so it is on the wrong side of the wall; session boundaries come from the trial ledger instead |
| decision atom: purpose, confidence, reads, candidates, result | `decision-atom.ts`, record store | local or server record | every measurement | **referenced by id only.** No atom content is copied into the ledger |
| reveal branch distribution | `oneThingMix` in `record-service.ts` | derived at read time | `RecordDashboard` | **not reused as the event source** — the mix is computed over *stored* decisions, and the trial needs what was *presented*. `RevealPanel` emits the branch it rendered |
| where a visit stopped | `progressReport()` | localStorage | copied out by hand | **yes** — same report, extended |
| import readings, claims, drills | record store | local or server | product | untouched |

**Nothing new was installed.** The acquisition ledger is `Visit.events[]` inside the file that
already held `Visit.attempts[]`: one append-only, per-visit, local, never-sent, copied-out-by-hand
store. A second one would have its own key, its own ring, its own quota failure and its own
copy-out, and the two would disagree the first time either was cleared.

---

## 2. Three layers, not collapsed

**Layer A — external prior.** GOV.UK Design System patterns (starting a service, question pages,
confirmation, error recovery, one thing per page) and IBM Carbon's interaction-state hierarchy and
motion-duration priors are used as **priors** for interaction decisions. They are not evidence that
a pattern works here. Where Decision Lab's context differs — pre-commit feedback may acknowledge
but never evaluate — the prior loses.

**Layer B — native behavioural evidence.** This repository owns the semantics of every event below.
No external service is permitted to define `activation`, `value delivered`, `unique insight`,
`continuation` or `successful session` for this product.

**Layer C — user interpretation.** Behaviour cannot say what someone understood. One free-text
question, once. Section 6.

---

## 3. The event ledger

Every event carries `at` (ISO timestamp) in addition to the properties listed. Persistence is
identical for all of them: **localStorage, this browser, ring of 20 visits × 400 events, never
transmitted, handed over by the participant from the self-check drawer.**

Authority for the schema is `client/src/lib/acquisition-evidence.ts`. If this table and that file
disagree, the file is right.

### `acquisition_entry`
| | |
| --- | --- |
| observable fact | A browser opened the app carrying these tags, or carrying none |
| trigger | `App` mount, once per page load, immediately after `beginVisit()` |
| source | The URL's query string, parsed against a closed vocabulary |
| properties | `context.angle`, `context.source`, `context.variant` (each an enum or `unknown`), `returning` |
| pre/post commit | pre |
| may influence measurement? | **No.** Nothing in the app reads the angle. Enforced by an import-graph assertion |
| legitimate denominator | The first-value funnel; the angle cross-tab |
| prohibited inference | "A campaign converted." It says a browser opened the app |
| privacy | required; enums only |

### `return_session_started`
| | |
| --- | --- |
| observable fact | A later session by this browser, after an earlier one still in the ledger |
| trigger | `App` mount when the ledger already holds a previous visit |
| properties | `hoursSincePrevious` (number, one decimal) |
| pre/post commit | pre |
| legitimate denominator | Arrivals whose first session is in this ledger |
| prohibited inference | Retention, unless the observation window is stated. "They lapsed", "they came back keen" — a duration is not a motive |
| known limits | One page load = one session. Two tabs are two sessions. A cleared browser is a first arrival. Not worked around; there is no fingerprinting |
| privacy | required; a duration |

### `first_position_presented`
| | |
| --- | --- |
| observable fact | A position is on the board, it is the player's move, a legal move exists, and the board will accept one |
| trigger | `Home`, first time that conjunction holds in the visit |
| properties | `purpose` (the decision purpose, or null) |
| pre/post commit | pre |
| legitimate denominator | `acquisition_entry` |
| prohibited inference | Intent. It says they could have decided, not that they wanted to |
| explicitly not | "the page loaded" — a stage every arrival clears measures nothing |
| privacy | required; enum |

### `decision_committed`
| | |
| --- | --- |
| observable fact | The decision crossed the commit boundary and was written to the record |
| trigger | `Home`, after `commitDecision` resolves. Every failure path above it returns first, so a failed write is an arrival that never committed |
| properties | `decisionId` (opaque uuid, same as the record's), `ordinal` (1-based within the session), `purpose`, `confidenceAsked` |
| pre/post commit | post (it *is* the boundary) |
| legitimate denominator | `first_position_presented` |
| prohibited inference | Effort, confidence, or quality. `confidenceAsked` is the protocol's answer — whether the question was put — never the player's |
| privacy | required; opaque id + enums + a counter. **No FEN, no move, no confidence value, no typed text** |

### `reveal_presented`
| | |
| --- | --- |
| observable fact | The reveal panel was rendered into the document |
| trigger | `RevealPanel` effect, once per `decisionId` |
| properties | `decisionId` |
| pre/post commit | post |
| legitimate denominator | `decision_committed` |
| prohibited inference | That it was read. Rendering is not reading |
| explicitly not | "the engine finished" — between the two sit a failure branch, the deferred arm, and a player who navigated away |
| privacy | required; opaque id |

### `reveal_kind_presented`
| | |
| --- | --- |
| observable fact | Which branch of the reveal was on screen |
| trigger | Same effect, same `theOneThing` value the panel renders |
| properties | `decisionId`, `kind` ∈ `chose-past-it` \| `confident-and-wrong` \| `outplayed` \| `trusted-it-too-little` \| **`silence`** |
| source of truth | `shared/reveal.ts` `theOneThing`. **Never re-derived.** A second implementation of the branch conditions would be a second answer to "what did this player see", and the two drift the first time a threshold moves |
| legitimate denominator | `reveal_presented` |
| prohibited inference | That any branch is "the valuable one". No branch is labelled in stored data |
| privacy | required; enum |

`silence` is a value, not an absence. On an accurate decision inside engine noise it is the only
thing the reveal can say. Omitting it would select the denominator on the outcome and make the
product look differentiated far more often than it is.

### `next_decision_started`
| | |
| --- | --- |
| observable fact | After a reveal, the player placed a move on the board |
| trigger | `Home`, via `continuationStarted({ movePlaced, revealsPresented, alreadyRecorded })` |
| properties | `afterReveals` |
| pre/post commit | post |
| legitimate denominator | `reveal_presented` |
| prohibited inference | Satisfaction. They continued; nothing here says why |
| explicitly not | Being on `/play`; a re-render; a route change. All three are true of somebody who read the reveal and stopped |
| privacy | required; a counter |

### `value_reconstruction_prompted`
| | |
| --- | --- |
| observable fact | The free-text question was displayed |
| trigger | Second reveal of the browser's history — see section 6 |
| properties | `afterReveals` |
| pre/post commit | post |
| legitimate denominator | Sessions reaching a second reveal |
| privacy | required; a counter |

### `value_reconstruction_submitted`
| | |
| --- | --- |
| observable fact | The player submitted an answer, or dismissed the question |
| trigger | Either button |
| properties | `outcome` ∈ `answered` \| `dismissed`; `answer` (verbatim, ≤1000 chars, or null) |
| pre/post commit | post |
| legitimate denominator | `value_reconstruction_prompted` |
| prohibited inference | **A dismissal is not "no value articulated."** There is no text to code. It is an interruption, a closed tab, or somebody who does not like typing |
| privacy | **the one free-text field in the ledger, stored deliberately.** It is the evidence. Never classified in the product; never included in any replay payload (there is none) |

---

## 4. Events deliberately absent

| not built | why |
| --- | --- |
| `user_understood_value`, `user_was_confused`, `activation_succeeded`, `unique_value_delivered`, `user_liked_reveal`, `user_is_engaged` | Each is an analysis with a denominator and a coding scheme. Stored as an event it is the trial's conclusion written into the trial's data |
| `decision_milestone_reached` | Derivable exactly from `decision_committed.ordinal`. A second, coarser copy of a number the ledger already holds — and the shape a streak mechanic arrives in. Never surfaced to the player |
| page views, route changes, clicks, scroll depth | None of them is a stage of the chain this trial measures |
| time-on-task interpretations | Durations are recorded between named events. "Hesitated" is an interpretation and is not stored |

---

## 5. Acquisition angle contracts

Three hypotheses. **Nothing randomises between them and no screen changes because of one.** They
are a tag, so that at n≈30 a person can lay out `angle × reveal kind × what they said ×
continuation` and look for mechanism fit. There is no significance test and the code contains none.

The **prohibited** row is the one that matters for validity. An angle that promises a reveal
*branch* brings every arrival an expectation the instrument cannot guarantee — `chose-past-it` may
simply not occur — and then nobody's continuation means anything.

### `selection`
- **Problem.** Sometimes the stronger move has already entered your search and you choose something else anyway.
- **Promise.** This can tell some "did not find it" situations apart from "it was on your board and you chose another".
- **Required action.** Make a decision before the engine speaks.
- **Possible payoff.** If that event occurs, the reveal shows the recorded distinction.
- **Prohibited.** "We know why you rejected it." "We will show you the move you saw and rejected." Any claim about what you saw, considered or understood — the record holds moves placed on a board.

### `confidence`
- **Problem.** You may be most certain exactly where you are most often wrong, and no engine report is built to notice.
- **Promise.** Your stated confidence is recorded before the engine answers, so the two can be compared.
- **Required action.** Say how sure you are, then let the engine speak.
- **Possible payoff.** Over enough decisions, a difference between how sure you were and how you did — inside a stated bucket, with n on screen.
- **Prohibited.** "You are overconfident." A single decision is not a calibration gap, and the product refuses to say it is. No promise of a number on day one.

### `process`
- **Problem.** An engine can tell you which move was better without telling you anything about what happened in your decision.
- **Promise.** This records the decision itself — what you could read, what you could not, how sure you were — before any evaluation exists.
- **Required action.** Commit the decision first.
- **Possible payoff.** A reveal that is about the decision rather than only about the move.
- **Prohibited.** "We analyse your thinking." Nothing here observes thinking; it observes what was written down before the answer arrived.

**Semantic continuity.** The first in-product screen leads with *"כל כלי שחמט אחר אומר לכם מה עשיתם
לא נכון. זה מודד מתי לא ידעתם שאתם לא יודעים"*, and the share card carries the same sentence. No
angle may promise more than that sentence does. There is no landing page in this repository and
none was built; the acquisition message lives outside it and is held to this contract.

---

## 6. The value-reconstruction question

> **מה קיבלת כאן שלא היית מקבל מניתוח רגיל של המשחק?**

**Trigger: after the second reveal, once per browser, inline, dismissible.**

The tradeoff, stated because either choice costs something:

- **After the first reveal** gives the closest attribution — the reveal is still on screen — and
  interrupts the player at exactly the moment the trial is measuring whether they continue.
  `next_decision_started` would then be measuring the question rather than the reveal, and Q4 is
  one of the four things this build exists to answer.
- **Later** gives a richer basis and buys selection bias: whoever left after one reveal never
  answers.
- **The second reveal** is where the first cost is gone and the second is still small. Continuation
  after reveal one has already been recorded before the component can exist, so the number that
  matters most is taken clean, and a player who reached a second reveal has seen enough to answer.

**Why the wording is non-leading.** It names no reveal branch, no mechanism, and no product term.
It does not praise what was shown, does not ask whether it was useful, and offers no scale. It asks
what they *received*, against the comparison the whole trial is about — ordinary analysis of the
game. A question that named the mechanism ("did you notice the move was already on your board?")
would teach the reply and then record it as though the player had produced it, and every coded
answer afterwards would be a measurement of the prompt.

**It is post-commit only.** Asking before a commit would put the idea of a differentiated finding
in front of somebody who is still deciding — contaminating the decision and the answer at once.

**Free text, never a scale.** "Was this useful? 1–5" measures agreeableness and produces a number
that looks like evidence. An answer of *"the engine showed me the best move"* is a real result and a
negative one; it must reach the analysis intact rather than being averaged into a 3.

**Coding happens offline.** A preregistered scheme — *unique value reconstructed / ordinary engine
value only / unclear / no value articulated* — is applied later, by a person, and stored apart from
the raw answer. No classifier ships in the app. A dismissal is never coded; there is no text.

---

## 7. What the event model can answer

**7.1 First-value funnel.** `acquisition_entry` → `first_position_presented` → `decision_committed`
→ `reveal_presented` → `next_decision_started`. Each stage's denominator is the stage above it,
within a visit.

**7.2 Reveal yield.** `P(kind)` over `reveal_kind_presented`, silence included. This is the reading
nobody has ever taken: how often does this product say something an engine would not?

**7.3 Continuation by branch.** `P(next_decision_started | kind of the preceding reveal)`, joined on
`decisionId`. **Descriptive at this n.** At 8–30 people no difference between branches is a causal
claim and none may be reported as one.

**7.4 Angle × experience.** `angle × kind × answer × continuation`, one row per session. Mechanism
fit, not an A/B test. The example hypothesis — a player recruited on the selection problem who then
receives a `chose-past-it` reveal reconstructs the unique value more clearly — may be supported,
unsupported, or left silent by 30 people, and "silent" is the likeliest.

**7.5 Return.** `P(return_session_started)` over arrivals, **with the observation window stated**.
Not called retention until it is.

Every one of these is computed by a person from the copied-out log. Nothing in the product computes
a rate, and `progressReport()` deliberately prints no percentages: a report that said "reached
stage 4 of 5" would hand the reader a denominator nobody chose.

---

## 8. Privacy model

| field | classification |
| --- | --- |
| opaque visit id (random per page load) | required |
| acquisition angle / source / variant | required, enums, `unknown` allowed |
| decision id (opaque uuid) | required — the join key |
| decision ordinal, reveal counts, durations | required |
| decision purpose, reveal kind, `confidenceAsked` | required |
| free-text value answer | required, **deliberately stored**, ≤1000 chars |
| username, email, account id | **prohibited** |
| FEN, PGN, SAN/UCI moves, game history | **prohibited** |
| stated confidence value, typed read/unknown text | **prohibited** |
| IP, referrer, user agent, screen fingerprint | **not collected** |

Enforced twice: the event union makes prohibited fields unrepresentable in TypeScript, and
`prohibitedContent()` throws at the boundary — because the ledger is serialised to JSON and pasted
into a message by a participant, so the cost of a leak is not a bad row.

**Where it lives.** This browser. It is never transmitted; the participant copies it from the
self-check drawer and sends it. That keeps handing it over an act rather than a default, and it
keeps the product's existing statement about what stays local true.

**Stated limit.** Copy-out means a participant who never presses the button contributes nothing but
their absence. For 8–30 people in contact with the owner this is the right trade; automating it
would mean transmitting a free-text answer to a server, which is an owner decision and is not made
here.

---

## 9. Identity

- An anonymous browser session, identified by a random per-load id.
- A signed-in account, where one legitimately exists — **not joined to the ledger.**
- Two people sharing a browser are indistinguishable. **This limit is retained.** No fingerprinting,
  no cross-site identity, no probabilistic matching.

---

## 10. Time

Timestamps are recorded on each event, and one derived duration exists
(`return_session_started.hoursSincePrevious`). Allowed: *event B occurred 8 seconds after event A*.
Not allowed, and not stored: *the player hesitated*. Manual review may later support that
hypothesis; the ledger may not assert it.

---

## 11. Low-N rule

The first cohort is 8–30 people. Therefore: no significance testing, no winner declarations, no
automated allocation, no Bayesian dashboards, no conversion optimisation. What matters is
**mechanism tracing per user** — for each session, reconstruct

```
angle → first position → commit → reveal kind → what they said → continued? → returned?
```

Aggregate rates are allowed. Claims of superiority are not.

---

## 12. External dependency decisions

Nothing was installed. A test asserts none of these appears in `package.json`.

| candidate | decision | reason |
| --- | --- | --- |
| **PostHog** | **defer** | Would buy funnels, paths, retention and surveys for free. Costs: a vendor's definitions of activation and retention in a product whose whole claim is that it defines its own measurements; ~50 kB against a 648 kB budget currently at 645; a CSP change; and a third-party network destination in an app that tells players the record stays in their browser. Revisit when the trial is larger than one person can read by hand |
| **OpenReplay** | **reject now** | Self-hosting is required to keep the privacy statement true, which is infrastructure for a 30-person trial. It would capture the board, the free-text answer and the username field by default; masking is possible and is the kind of configuration that fails silently |
| **rrweb** | **reject now** | Same capture surface as above with none of the hosting solved, plus a large bundle. The questions replay would answer — where exactly did the interaction fail to communicate causality — are better answered at this n by watching two people use it |
| **Formbricks** | **reject now** | We need one prompt, one textarea, one append-only answer and three context fields. A survey platform is a hosted third party and a network destination for the single most sensitive field in the ledger. Anti-build applies |
| **GrowthBook** | **reject now** | Statistical experimentation infrastructure for a trial with no statistics. There is no requirement it meets |

**If replay is ever wanted**, it changes a user-facing privacy statement. That is an owner decision
and is not made by an import.

---

## 13. Interaction attention map

Walked in Chromium at 390×844 from an empty profile. Volume levels: **V0** immediate state, **V1**
tactile acknowledgement, **V2** orienting semantic transition, **V3** rare major boundary.

| step | control | current feedback | min | max | measurement risk | change |
| --- | --- | --- | --- | --- | --- | --- |
| entry | `קחו אותי לעמדה` / `עמדה מהסט המשותף` | rest/hover/focus/pressed, spinner + label change while fetching | V1 | V2 | none — pre-position | none |
| load position | board paint | position appears, ribbon holds its slot (CLS fix) | V0 | V1 | none | none |
| choose | square buttons (`aria-label` = square) | selection state, legal-target marks | V1 | V1 | **high** — any feedback that varies with the move is engine-derived styling before commit | none. Acknowledge only |
| choose | candidate list "מהלכים שהנחתם על הלוח" | appears as moves are placed | V0 | V1 | **high** — a reward that grows with the number of candidates would pay players to inflate `chose-past-it` | none. Neutral list, no count praise |
| commit | `רשמו את ההחלטה` | label carries the reason when blocked, `disabled` only while in flight | V1 | V2 | none | none |
| pending | "רושם החלטה…" | label change | V1 | V1 | **medium** — a pending state whose duration varied with the answer would leak | none |
| reveal | `.reveal-panel` | appears; the finding is now the largest thing on the screen | V2 | V2 | none — post-commit | **done this build**: weight inverted (F4) |
| reveal | `.analysis-hero` evaluation | large number, static | V0 | V1 | none | **done**: one rank down, so the finding leads |
| continue | board accepts the next move | position advances | V1 | V2 | **high** — celebration, streak or countdown here would be the interface paying for continuation, which is the thing being measured | none. No celebration exists and none may be added |
| question | value-reconstruction | inline, dismissible | V1 | V1 | **high** — a modal would coerce an answer and interrupt continuation | inline only, once |

**Attention budget.** Where the minimum volume needed to communicate causality exceeds the maximum
the measurement permits, the answer is structure, not animation. The product has no V3 and needs
none.

**Interaction constitution (unchanged, restated).** Pre-commit feedback may acknowledge input and
may never evaluate it. Allowed: pressed, selected, open, move recorded as yours, input accepted,
required step missing. Forbidden: "interesting move", "are you sure?", confidence-dependent
animation, speed-dependent feedback, engine-derived styling, quality-derived styling, reward by
candidate count, adaptive salience on anything the instrument measures.

---

## 14. No feedback loop

Acquisition telemetry must not influence the live experience during this trial. No different reveal
by angle, no different position, no different prompt, no prioritisation by what previous users did,
no telemetry-driven position selection.

Enforced as an import-graph assertion: only `App`, `Home`, `ValueReconstruction` and the two ledger
modules may name `acquisition-evidence`, and nothing that chooses a position, computes a reading or
renders a finding may. Additionally, nothing under `shared/` may reach the trial log at all.

---

## 15. Definition of acquisition-ready

For one real user, without guessing, without reading raw logs for basic facts, without claiming a
psychological state from behaviour, and without exposing them to any measurement-derived
adaptation, we can reconstruct:

1. which acquisition angle brought them — `acquisition_entry.context.angle`
2. whether they reached a real first position — `first_position_presented`
3. whether they committed — `decision_committed`
4. whether a reveal was shown — `reveal_presented`
5. which branch they received — `reveal_kind_presented.kind`, silence included
6. whether they began another decision — `next_decision_started`
7. what they said they received — `value_reconstruction_submitted.answer`, verbatim
8. whether they returned — `return_session_started`

A user who drops out is reconstructible to their last verified stage. A user who says the value was
"the engine showed me the best move" is preserved as a **meaningful negative result**. Negative
outcomes are the purpose of this build and nothing here optimises them away.
