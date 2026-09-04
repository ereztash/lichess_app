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

`step23` carries its own correction: its first verdict line used `\b` around a Hebrew word, which
never matches, and reported `STILL COLLIDING` against a fix that had worked.

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

## Two biases the instruments have, measured

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

Both are worked through in [`../PRE_HUMAN_UX_PASS_2.md`](../PRE_HUMAN_UX_PASS_2.md).

