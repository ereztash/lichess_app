# The harness that produced run 001

Not part of the build, not part of `npm test`, not a gate. It is the instrument, kept whole so the
numbers in [`../NETA_EMBODIED_RUN_001.md`](../NETA_EMBODIED_RUN_001.md) can be re-measured rather
than believed.

Run with `NODE_USE_ENV_PROXY=1 node docs/neta/harness/<script>`.

**Kept whole on purpose, defects included.** A curated subset would have been tidier and would have
made the sentence above false: several numbers in the run came from the exploratory scripts, and two
of the scripts here produced findings that were wrong. The order is the order they were written in,
because each one exists because the one before it was not enough.

## The instrument

| file | what it is |
| --- | --- |
| `session.mjs` | opens a clean Chromium context against production. Fresh profile per run: no `localStorage`, no cookies, no prior session. Production bytes and production headers relayed through Node, because this sandbox's browser cannot complete a TLS handshake to the origin. The engine reaches `uciok` under the relay, so the relay is not standing between the product and its own engine |
| `lib.mjs` | the four commitment steps and one commit, performed the way a person performs them |

## The walk

| file | what it measured, and where it appears in the run |
| --- | --- |
| `step1-landing.mjs` | the front door at 1440x900. §3.1 |
| `step2-decision.mjs` | pressing the bank-position control. Its 90-character `innerText` truncation is the instrument artifact that nearly became "the product does not respond" |
| `step2b-diagnose.mjs` | the discrimination that killed it: the button had darkened and an error had rendered |
| `step3-slice.mjs` | the deciding screen, every element with its computed weight and geometry |
| `step4-move.mjs` | the board as shown, and what changes when a square is clicked. §3.2, the empty-square ring |
| `step5-commit.mjs` | selecting a piece and placing a move. §3.3, the board that does not change |
| `step6-reveal.mjs` | the live regions and the move rail. Left in with the missing `browser.close()` that hung it |
| `step7-controls.mjs` | every visible control in reading order |
| `step8-commit.mjs` `step9-full.mjs` | steps 3 and 4 of the commitment panel, and the confidence scale |
| `step10-press.mjs` | the first press-to-reveal sample. Contaminated: its `/^5/` matched `5.Be3` in the move rail |
| `step11-discriminate.mjs` | whether the engine starts on production assets. It does, `uciok`. This killed "the engine does not start" |
| `step12-product-engine.mjs` | the product starting its own engine, with the network watched. Where the `REVEAL` masthead artifact became visible |
| `step13-clean.mjs` | the corrected timing: `+36ms` label, `+139ms` computing, `+2,185ms` the engine's sentence. §3.4 |
| `step14-continue.mjs` | `O-1` walked: `144 ms`, no navigation, a board that accepts a move. §1 |
| `step15-second.mjs` | the second decision and `O-3`, the question present on reveal 2. §3.6 |
| `step16-accumulate.mjs` `step20-rest.mjs` | the record surfaces and the return visit. §5 |
| `step16b-rate.mjs` | the rate at which the press does not reach a reveal. §3.5 |
| `step17-gate.mjs` | where the counterfactual question sits, measured against the viewport |
| `step18-trigger.mjs` | whether it follows the move played. It does not. This killed "it fires on engine agreement" |
| `step19-cf.mjs` | whether it follows click count or elapsed time. Neither. §7 |
| `step21-mobile.mjs` | every element's y at 390x844, on all three screens. §6 |
| `step22-blitz.mjs` | the `N-3` control: three blitz moves, then the front door. §5 |
| `step23-verify.mjs` | the `N-2` intervention, walked on `dist/public`. §9 |

## Pass 3

| file | what it measured |
| --- | --- |
| `k-record-spend.mjs` | every painted element of a reveal taken after three decisions, assigned to its panel block by DOM ancestry. 1 of 14 elements is about the record, and it sits in the limits block |
| `l-where-the-record-is.mjs` | every control and every in-app route on the reveal screen. Its "no route to the record" is the killed finding above |
| `m-the-door.mjs` | `.explore-toggle` -- where it is, what it promises, and what opens behind it. Where the five contradicting numbers on one screen were caught |
| `n-the-count-on-the-reveal.mjs` | whether the kth reveal says k. 5 of 5 correct, which did NOT reproduce the 4/3/3 the other probes saw. The open finding in pass 3 §7 |

## Pass 4

| file | what it measured |
| --- | --- |
| `p-accumulation.mjs` | the owner-licensed intervention against the criterion stated before it was built: heading weight per screen with a full weight census, the reveal's block sequence, its record-scoped share, and whether the replaced proposition is still in the DOM |

`step23` carries its own correction: its first verdict line used `\b` around a Hebrew word, which
never matches, and reported `STILL COLLIDING` against a fix that had worked.

## Pass 5

The macro audit. Its probes are not kept here: they were written under a scratch directory and are
named in [`../PRE_HUMAN_UX_PASS_5.md`](../PRE_HUMAN_UX_PASS_5.md) beside the numbers they produced.
What belongs here is the two biases they exposed, because both are properties of the method.

**A probe that answers the counterfactual is not a probe that controls for it.** Every walk in this
harness answers `מה כן היית עושה` when it appears, which silently draws a 0.35 arm that changes the
code path under test -- `onCommit` calls `runReveal` in its own closure on one arm and
`onAnswerProbe` calls a later one on the other. Three runs disagreed about which reveal printed the
wrong count, and the disagreement was read as a race for two passes. `assignProbe` takes its `draw`
as an argument, and `decision-session.ts` defaults it to `Math.random`, so `addInitScript` can pin
the arm before any page script runs. Pin it.

**A gate that went red before the fix is not yet a gate.** Twice in pass 5 a falsifier was red
before and green after and still did not discriminate the rule it was written for: one forced the
losing arm with focus events that do nothing, the other built one stratum where the rule under test
only runs with two. Both were caught by reverting the rule into the tree and re-running, which costs
one build and is now the last step of every repair.

## The pre-human UX pass

Added for [`../PRE_HUMAN_UX_PASS_1.md`](../PRE_HUMAN_UX_PASS_1.md). These serve `dist/public`
themselves, so they measure the built artefact rather than a dev server.

| file | what it measures |
| --- | --- |
| `ux-lib.mjs` | serves the build, launches Chromium, and holds the three instruments: a salience ranking, a visual-system inventory, and a press sampler |
| `a-front-door.mjs` | the front door at both viewports: what the eye is offered, ranked, and the font sizes, weights, radii, gaps, surfaces and borders actually in use |
| `b-decide.mjs` | the deciding screen and the commit transition, sampled at 50 ms |
| `c-press-feel.mjs` | holds five control classes down and reports which computed properties move |
| `d-gap.mjs` | what is on screen during the wait, and whether anything says so |

Two of these carried defects of their own, both corrected and both worth keeping in mind when
reading their output. `c-press-feel.mjs` aimed at each control's centre, where the sticky
`.commitment-submit` sits over the step heads, and recorded a control that had never been pressed as
unchanged; it now asserts `matches(":active")` and names what it actually hit. `d-gap.mjs` read
`getComputedStyle(el)` without a pseudo-element argument and reported zero animations against a page
whose only moving thing is an `::after`.

## Four biases the instruments have, measured

Recorded beside the two defects above, because they are properties of the method rather than bugs in
a script, and both were found by a claim they produced turning out to be false.

**A salience proxy that ranks by area ranks prose above controls.** `ux-lib.mjs`'s score is
`sqrt(area) x weight x contrast`, and in a product whose proposition is what it says rather than
what you press, the longest careful paragraph wins every time. That is the proxy describing itself.
It measures COMPETITION, which is real, and it does not measure priority. Reading a low-ranked
button as a defect imports an assumption about what a product's priority should be.

**A five-screen sweep understates the state space.** `j-800.mjs` reported zero elements at font
weight 800 across the front door, decide, ready, reveal and return, and concluded the weight was
dead. `.learning-grade` is weight 800 and is painted by `LearningQueue.tsx` on a rule that has been
graded, which needs sixty measured decisions or a completed drill to exist. Any claim shaped
"nothing in this product does X", drawn from a walk, is a claim about the walk.

**An anchor probe cannot see a disclosure.** `l-where-the-record-is.mjs` listed every `a[href^="/"]`
on the reveal screen, found none, and concluded the record was unreachable from there. `Home.tsx`
renders `.explore-toggle` -- `מה עוד יש כאן` -- which mounts `RecordExplorer` in place, handed the
whole record dashboard, with no navigation. Reachability is not linkage, and the probe measured
linkage. Killed by `m-the-door.mjs`, which pressed the thing.

**A leaf filter that lists tags misses the tags it does not list.** `m-the-door.mjs` reported the
zero sentence twice, 23px apart, one copy with a leading `— `. `NotMeasured` renders an outer
`span.value-triple` whose `innerText` is `— {reason}` around an inner `span.value-provenance` whose
`innerText` is the reason; the filter excluded elements containing `h1,h2,h3,p,li,button,summary`
and not `span`, so both matched. A duplicate in the instrument, not on the screen.

The first two are worked through in [`../PRE_HUMAN_UX_PASS_2.md`](../PRE_HUMAN_UX_PASS_2.md), the
second two in [`../PRE_HUMAN_UX_PASS_3.md`](../PRE_HUMAN_UX_PASS_3.md).

