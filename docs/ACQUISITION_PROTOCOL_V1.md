# Acquisition protocol, version 1 — frozen 2026-09-03

**This is the instrument for the first field trial. From this freeze until that trial ends, the
intervention and the instrument do not move together.**

`RNL-11` is the rule this exists to satisfy. Changing the route the player takes changes what the
funnel counts; changing what the funnel counts changes what the route's numbers mean. Doing both at
once produces a measurement of neither. Everything below is fixed for the duration of trial 1, and
a change to any of it requires **a new protocol version**, not an edit to this file.

| | |
| --- | --- |
| version | **1** |
| frozen at | `2026-09-03`, on the commit that introduces this file |
| supersedes | nothing. `docs/ACQUISITION_EVIDENCE.md` remains the definition of every event, its denominator and its prohibited inferences; this file freezes the six things a trial can be invalidated by moving |
| owner decisions carried | `O-1` = A, `O-2`, `O-3` — `docs/user-loop-integrity/FALSIFICATION_REGISTER.md` |
| ends when | trial 1 completes, or the owner declares the freeze lifted in writing |

---

## 1. Route after the reveal

**Frozen: the direct route.**

After a reveal whose game holds no further position — which is every front-door arrival, because
`pickFirstDecision` hands over exactly one position on purpose — the reveal offers **one** control,
carrying the act `next-decision`, which serves the anchor set's next unanswered position and puts it
on the board in a single press.

The player does not pass through the record to reach it. The record remains the destination in
exactly one case: a player who has answered all sixty bank positions, for whom there is genuinely
nowhere else to be routed.

**Why it is frozen rather than tuned.** The route was chosen to remove navigation friction from what
the trial measures, and a route changed mid-trial makes the two halves incomparable at exactly the
stage the trial exists to read.

**Held by** `tests/layout/the-loop-a-stranger-can-close.layout.test.ts`.

---

## 2. `next_decision_started`

**Frozen definition.** The event is recorded when, and only when, all four hold:

1. a reveal has already been presented in this visit;
2. the player is shown a legal position in which it is **their** turn and which the board will
   accept a move in;
3. the player places a legal move in it;
4. the event has not already been recorded this visit.

**It is not recorded on** a route change, a press of the way-on control, a render of a position,
entry to a screen, or the selection of a game. None of these is behaviour the trial is entitled to
read as continuation.

`continuationStarted` in `client/src/lib/acquisition-evidence.ts` is the definition.
`client/src/lib/continuation-event.ts` is its only writer.

**Held by** `GATE-CONTINUATION-IS-A-MOVE`, which reads the source for the three ways this decays: a
caller that stops consulting the predicate, a clause hard-coded at the call site, and a second
writer anywhere in `client/src`. Each was deliberately introduced into the real tree and each went
red for its own reason.

---

## 3. `ASK_AFTER_REVEALS`

**Frozen at 2.** The value-reconstruction question is put after the second reveal of the browser's
history, once per browser.

Not after the first: that is the moment continuation is being measured, and a question there would
be measured instead of the continuation. Not later: whoever leaves after two reveals never answers,
and the selection bias grows with the threshold.

`O-1` did not move this number. It made it reachable from the front door, which it had not been.

**Held by** the second walk in `tests/layout/the-loop-a-stranger-can-close.layout.test.ts`, which
asserts the question is absent on reveal 1 and present on reveal 2.

---

## 4. Event denominators

Frozen as `docs/ACQUISITION_EVIDENCE.md` states them. Reproduced here so a change to that file
during the trial is visible as a change:

| stage | denominator |
| --- | --- |
| `acquisition_entry` | none. It is the denominator of the first-value funnel and of nothing else |
| `first_position_presented` | `acquisition_entry` |
| `decision_committed` | `first_position_presented` |
| `reveal_presented` | `decision_committed` |
| `reveal_kind_presented` | `reveal_presented` |
| `next_decision_started` | `reveal_presented` |
| `value_reconstruction_prompted` | sessions reaching a second reveal |
| `value_reconstruction_answered` | `value_reconstruction_prompted` |

---

## 5. Prohibited inferences

Frozen. Each is a sentence the data cannot support, and the reason it cannot.

| observable | may **not** be read as |
| --- | --- |
| `acquisition_entry` with tags | "a campaign converted". It says a browser opened the app |
| `reveal_presented` | `reveal_read`. A rendered block is not a read one |
| `next_decision_started` | "the player was satisfied". It says they placed another move after seeing one reveal |
| `returned_session` | a retention motive. One page load is one session; two tabs are two |
| a clean DOM | comprehension. `F-2` is field-required for exactly this reason |
| the funnel as a whole | a rate over arrivals. The ledger is handed over voluntarily, so every rate here has **handover compliance** in its denominator, not arrivals |

That last row is the one most easily forgotten and it is a property of the collection method, not a
defect: the ledger is `localStorage`, this browser, never transmitted, handed over by the
participant from the self-check drawer.

---

## 6. Value-reconstruction timing and placement

Frozen. The question is rendered directly under the reveal it is about, from the second reveal
onward, gated on a reveal that was actually written. Attribution wants it as close to the reveal as
it can get; the continuation measurement wants it nowhere near the first one. The component owns
that rule.

The four-block order inside the reveal is **not** frozen by this file because it was never in
question: `RevealPanel`'s own header declares it non-negotiable and nothing measured has licensed
moving it. `F-1` records that on a 390×844 handset the reveal begins at y=893 in an 844px viewport,
and that is a field question, not a licence to reorder.

---

## What a new version requires

A change to §1 through §6 needs:

1. a new file, `ACQUISITION_PROTOCOL_V2.md`, stating what changed and why;
2. the protocol version stamped on events recorded under it, so the two are separable in analysis;
3. an explicit statement of which trial-1 numbers remain comparable and which do not.

**Not** an edit to this file. A silently overwritten protocol is a trial whose two halves cannot be
told apart, which is the failure this freeze exists to prevent.
