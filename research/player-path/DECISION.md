# DECISION — what the player's path is, and what gets built

Frozen plan: `DR_PLAN_1.md`. Live run: `PATH_TRACE.json`, task `CAL-LICHESS-PLAYER-PATH-001`,
`final_state: COMPLETE`, `stop_or_continue: CONTINUE`.

## 1. The decision as it stood before the run

> Build a front entry frame carrying the player's own aspiration and the personal-inference promise,
> placed before the machinery, with one next act and its payoff stated.

## 2. The decision after

> H-1 as specified is not buildable in its stated content.

The full text is in `PATH_TRACE.json` under `synthesis.decision_after`. The three load-bearing
findings:

1. **The personal-inference promise is outcome-shaped.** It promises that something recurring
   specifically in this player's decisions will be found. The frozen evidence ceiling places that
   out of reach under any sample size, and the telos requires the process to work in the state where
   no personal pattern is ever found.
2. **An aspiration frame is the most likely route by which rating re-enters as a denominator**,
   because chess aspirations are rating-shaped and the success condition forbids rating as a
   progress unit. The default did not name this collision.
3. **H-3 leaves the four-way race entirely.** It is not a cheaper competing build. It is an
   already-supported internal-consistency defect of the same family the repository's existing gates
   already legislate, non-exclusive with H-1, resolvable at `REPO` + `OWNER` with a gate and a
   positive control, and no field debt.

## 3. The routing that produced it

Deterministic, from `routing.py`. `NETA` fired on `multiple_plausible_mechanisms`,
`proxy_substitution_risk`, `research_to_intervention_transition`, `signal_interpretation_ambiguity`.
All four authority flags fired: `OWNER`, `REPO`, `ENVIRONMENT`, `FIELD`.

`resource_deltas` records one material delta, from `NETA`, with `evidence: null` — the peer changed
decision, action, reversal, allocation and distinction, and produced **no new evidence**, which is
the correct shape for a peer that inspected nothing. Three learning records were logged, two of them
mismatches against the pre-committed expectation:

- allocation was pre-committed **false** for `NETA` and observed **true**;
- proxy-substitution risk was correctly predicted as live but **mislocated** — the diagnosis put it
  in the prospective `OWNER` invocation, and it was actually inside the proposed intervention.

## 4. The three REPO questions, and the answers

The run's `next_move` was `COLLECT_REPO`, one bounded inspection, **before any build**. All three
questions were relayed rather than observed, including by the peer that raised them
(`limitations[0]`: "No repository, screenshot, DOM, geometry or deployed environment was inspected
in this call").

**(a) Is the post-commit single-decision payoff surfaced at n=1?**
**Yes, and already labelled by evidence kind.** `RevealPanel` renders `EVIDENCE_LABEL.process`
against `EVIDENCE_LABEL.engine`, plus `one-thing-basis` and the player's own stated read echoed
back. H-2's premise is weaker than stated.

**(b) Ordering and salience on the import screen.**
**Confirmed, and worse than relayed.** Measured at 390×844: six accuracy rates began at y=1363 and
ran to y=1698; the conclusion denying the ranking was not in `.import-observation` at all — it
rendered through `NotMeasured`, which is the **provenance register**, at `--panel-body`, grey, about
800px below the numbers it denies. A ranked list of six rates whose differences lie inside their own
sampling error, rendered above the sentence that denies the ordering.

The level boundary is preserved exactly as the peer drew it, and is not collapsed anywhere in this
lane:

| statement | level | asserted? |
| --- | --- | --- |
| the ordering renders above the denial | OBSERVATION | yes, measured |
| the eye has little basis to reject the ranking | PERCEPTUAL INFERENCE | yes, as inference |
| players misread it | BEHAVIORAL CLAIM, needs FIELD at R6 | **no** |

**(c) Is "an import cannot produce a calibration gap" encoded as a reason to act?**
**No.** It appeared twice in `shared/import-diagnostic.ts`, as `bucket-absent-note` and as
`review-caveat`, and it was a caveat both times. Never once a reason to do anything.

## 5. What gets built

Three changes, all bounded by answer (a): the front-half build is a **sentence**, not a frame.

1. **The finding outranks its numbers.** The import panel's conclusion moves above the bucket list,
   renders at `--panel-title` in its own register, and stops wearing `.value-provenance`.
2. **The not-separable state carries a reason to act.** `LIVE_DECISION_ADDS` attaches the
   evidence-type statement to the finding, so the screen that says "nothing separated" does not end
   in a denial.
3. **The same repair on the record dashboard**, where the construct is separation from the
   population rather than between the player's own buckets. Two different separations, kept apart.

And one invariant so it cannot silently regress: `GATE-FINDING-OUTRANKS-ITS-NUMBERS`, with a
positive control that reproduces the shipped defect.

## 6. What does not get built, and why

| not built | reason |
| --- | --- |
| entry frame with the personal-inference promise | outcome-shaped, refused by the run under every outcome |
| aspiration frame | unresolved rating-denominator collision, `OWNER` authority, unanswered |
| any progress bar or rating denominator | no denominator exists |
| any efficacy programme | `INTERVENTION` is `OWNER`, `OUTCOME` is `FIELD`, both unreachable here |
| any change to the detector's method | out of the build boundary in `DR_PLAN_1.md` §8 |

## 7. What remains open, and to whom

The outcome claim proper — **a player told what the product uniquely does judges the next act worth
taking** — stays `DENY` below `FIELD`/R6. No build closes it.

The single discriminator worth paying for is unchanged from the run:

> three cold users, no coaching, watched to the first commit, with two things recorded: whether the
> core move completes after the repair, and, **before they touch anything**, what they say the
> product is for in their own words.

The second record must be an **unprompted utterance**, not agreement with a stated frame. Agreement
is not confirmation. This is `FIELD_TEST_PROTOCOL.md` in this lane.

## 8. Independence, stated rather than assumed

Every resource in the live run shares one model lineage. `PATH_PROVENANCE.jsonl` carries the caveat
on each phase:

> Same model lineage as the other resources in this run. Agreement between resources is
> role-conditioned execution, not independent triangulation.

The peer also flagged the reverse direction: its own conclusion is close to the earlier paired run
on a different provider lineage, and **under the shared kernel that resemblance is not
triangulation** either. The decision is justified from the present observables — three measured
`REPO` facts — not from two runs agreeing.
