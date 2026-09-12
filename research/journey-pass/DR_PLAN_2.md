# DR_PLAN_2 — frozen before the calibration run

Written before the run and before any further code. Nothing here was optimised by a peer first.

| pin | value |
| --- | --- |
| `lichess_app` base | `2afb7a2` (`origin/main` after PR #102 and PR #103) |
| working head | this branch, Phase A committed below |
| PPSA head | `7171f40` |
| prior decision record | `docs/decisions/D22-next-action-ownership.md`, mode `DEFER`, evidence `E2` |

## 1. The decision

> May an orchestration surface render what `deriveNextAction` proposes, and what may that surface
> state about where the player is, without inventing a claim the evidence ceiling forbids?

## 2. What is settled and must not be re-litigated

- `CAUSALITY`, `INTERVENTION`, `OUTCOME` unreachable by the discovery pipeline under any result.
- A goal is framing and never a denominator (`shared/goal.ts`, `GATE-GOAL-NOT-A-DENOMINATOR`).
- The published refusal list, which the product shows its own users: *"לא ימליץ מה ללמוד — הוא מודד,
  לא מאמן."*
- Guided practice, prompted recall and unprompted play are three constructs, never one number.
- `EVIDENCE_POLICY` v4: discovery reads free play and nothing else.

## 3. What is new since D22 was written

**The walk D22 asked for has been performed.** `tests/layout/a-walk-the-derivation-can-be-wrong-about.layout.test.ts`
drives the shipped bundle at 390×844 from an empty profile and reads `[data-primary-action]` off
the live page:

```
the record page, empty:        proposes play-first-decision → screen offers play-first-decision
the record page, one decision: proposes play-blitz          → screen offers play-blitz
```

Reversal condition 1 did **not** fire on either state. That is not the condition being met — the
condition is a disagreement — but it converts "nobody has looked" into "two states looked at".

**And D22's cost argument may rest on a routing error.** It reads:

> the record page and the blitz page would each have to pull it, plus the analysis queue, to
> assemble a `ProductState` … The front door holds all four readings already, so its shadow costs
> nothing and stays.

`App.tsx` routes `/` to `Record` and `/play` to `Home`. The "front door" and "the record page" are
**the same route**, and `ResumeScreen` — which calls `useProductState()` — is rendered inside
`Record.tsx`.

**Checked before stating it, and it is narrower than it first looked.** `ResumeScreen` is behind
`lazyChunk`, so the reading chain is a separate chunk and not in the entry. What follows is only:
a **returning** player on `/` has already fetched that chunk, because `ResumeScreen` renders for
them and is what pulls it. A surface on `/` that needed `useProductState()` would add no new
download for that audience, and would for a first visit, where `ResumeScreen` returns null.

So D22's price is real for a cold arrival and already paid for a returning one. Whether that
distinction is worth anything is part of what this run is being asked.

*(The same conflation cost me a false finding an hour earlier: a first draft of the walk navigated
to `/record`, read a 404 as a screen offering nothing, and reported a disagreement that was a typo.
Recorded so the peer can weigh how much to trust this observation.)*

## 4. Hypotheses, stated before the run

- **H-1 (favoured).** Render the proposal's **reason**, not its choice. The surface keeps offering
  exactly the act it offers today; the derivation supplies the sentence that says what completing
  it makes knowable. No act changes, so no claim about what the player should do is added that the
  screen was not already making by rendering the control.
- **H-2.** Hand the act over too. The walk found agreement; ownership is the point of the sequence.
- **H-3.** Neither. D22's E2 is about the mapping, not about the screens, and two agreeing states
  are not evidence that a third would agree. Wait for the acquisition trial.
- **H-4.** The binding constraint is not ownership at all but the instrument-first ordering: the
  player's purpose is below every count, and the shortfall wall is above them. Re-order, decide
  nothing.

## 5. The current default, and what reverses it

**Default: H-1.** Reversal: if rendering a reason is itself a recommendation under the product's own
published refusal, or if "what completing this makes knowable" cannot be stated without an
`INTERVENTION` claim, H-1 collapses into H-2's problem and the answer is H-3.

## 6. What I expect to be wrong about

I expect the peer to attack the distinction H-1 rests on — "what to learn" against "what the record
needs next" — and to find that a reason attached to an act is read as a recommendation whatever its
grammar. I expect the routing observation in §3 to be accepted and to matter less than I think,
because cost was D22's second argument and not its first.

## 7. Stopping rule

Stop when the remaining uncertainty is FIELD or OWNER. Do not reopen the evidence ceiling, the goal
safeguard or the three transfer constructs.

## 8. Build boundary

May build: copy, ordering, one surface's composition, tests, gates. May not: any progress
percentage, any rating denominator, any efficacy claim, any change to the detector, any new
telemetry, any change to what `EVIDENCE_POLICY` admits.
