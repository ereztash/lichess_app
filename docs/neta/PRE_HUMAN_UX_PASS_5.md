# Pre-human UX, pass 5: a macro audit that repaired three things and refused to repair two

Passes 1 to 4 worked outward from the owner's raw signals. This one had no signal to start from. It
was a macro audit of the whole product under Neta v0.2, run as a falsification system rather than as
a consultant: the measure of it is material uncertainty removed, not findings produced.

Ten measurement passes with deliberately different attacks, run against one frozen state. Three
families reached `BUILD_READY` and were repaired. Two reached the authority ceiling and were routed
rather than built. One repair's own gate was falsified by an independent pass while the repair was
still warm, and that is the most useful paragraph in this document.

---

## 1. The baseline, and why it is not `main`

Three states were candidates when this began. `main@f1315d7`; PR #87, a strict superset of it
closing four falsified failure families; PR #85, one commit on main rebuilding the reveal's
continuation block. Both open PRs touch precisely the surfaces a macro UI audit examines, so
auditing either surface without them would have rediscovered ground already repaired.

PR #85 showed a red `verify`. It was not the product: the run died at `npm audit` on a 503 from
`registry.npmjs.org`, five minutes into the step before the suite, and no test ran. PR #86 is open
against exactly that failure mode.

So the baseline is the composition, verified rather than assumed: `e6fb2fc`, `main@f1315d7` merged
with #87 and #85, `npm run verify` exit 0 before a single finding was measured against it.

**The choice was settled from outside during the run.** PR #87 merged to `main` at 10:36 UTC and
production is serving it. The baseline was the right guess about what `main` was about to become,
and `main` is now merged back into this branch.

**The bundle ratchet caught the one thing in that merge that was reasoned instead of measured.** The
first resolution took the higher of the two ceilings; the tree measured 687.1 against 687 and went
red. Four builds settled it: `+1.4` and `+1.1` arrive as `+2.5`, to the tenth. Composition is
addition, the ceiling is the sum, and the attribution table is in `check_bundle_budget.ts`.

---

## 2. What was repaired

### `N-7` — the reveal counted the record with a cache plus one

Open since pass 3 as `DISCRIMINATE_FIRST`, with three candidate mechanisms and a note that it needed
"a build with instrumentation and a forced refetch, and that is its own pass". It needed neither.

`Home.tsx` built `decisionsOnRecord` as `(decisionCount.data?.decisions ?? 0) + 1`. `onCommit`
awaits the write and returns on failure before the engine is ever asked, so the decision being
revealed is already ON the record and the number wanted is the number the record holds. `+ 1` was
right only while the query had not caught up.

**Whether it had caught up is the counterfactual probe's arm, and it is deterministic.**
`useCommitDecision` invalidates `LOCAL_KEYS.count` immediately after the write. On the NOT-PROBED
path `onCommit` calls `runReveal` inside the closure it was created in, where `data` is still `k-1`
and `+ 1` lands on `k`. On the PROBED path `onCommit` returns, the invalidated count refetches,
React re-creates `runReveal` — `decisionCount` is in its dependency array — and `onAnswerProbe`
calls the LATER closure, where `data` is already `k`.

Measured: **8 of 8 probed runs wrong, 18 of 18 not-probed runs right, 26 runs, 26/26 agreement with
the arm.** A four-decision walk read `1, 2, 4, 4` — a number skipped, then a number that did not
move. A probed FIRST decision was told `נרשמו 2 החלטות`, which is also `זו החלטה אחת שנרשמה` not
rendering at all: at `k=1` the defect crosses a copy branch and not only a digit.

**Confirmed at R4 on the deployed build.** Production, `2f3c261`, `target=production`, arm pinned
and the control run beside it:

| arm | printed | record holds | |
| --- | --- | --- | --- |
| probed | 2 | 1 | `נרשמו 2 החלטות...` |
| not-probed | 1 | 1 | `זו החלטה אחת שנרשמה...` |

The repair reads the count instead of inferring it. `countForReveal` is a free function so the rule
can be tested against a literal; `CountView.forReveal` binds it so `Home.tsx` needs no import line,
because R-13's ceiling may only go down and the file is back at 2,399.

### The bank reading — the only between-player comparison, missing both its preconditions

`forAnchorReference` states them: *"the only reading this product claims is comparable BETWEEN
players, and the whole of that claim is that the item difficulty is held fixed."*

**It read the largest regime, which is the rule that was measured and falsified for its sibling one
commit earlier.** `4049c16` carried the regime wall to the bank and copied the largest-stratum sort,
under a message naming the very defect it was fixing: *"`readRecord` computes two readings and the
first commit walled only one of them."* Then `67bad3c` falsified "the largest" and replaced it with
the regime in force — on one of the two readings. The repair is `regimeInForceFirst`: one function,
two callers. A rule that lives in two places gets repaired in one.

**And a bank position answered twice entered the comparison twice.** Reachable by a gesture: take a
bank decision, read the reveal, reload `/play`. The board comes back — `session-position.ts`
persists it so a reload does not lose the game — and the reveal does not, because it is component
state. The screen keeps the position, drops the only thing that said it had been decided, re-arms
the commitment and accepts a second answer, this time with the verdict already read. Browser Back,
and the brand lockup out and `ללוח` back, reach the same screen.

Measured: five answers over four positions read `anchorAnswered.length === 4` beside
`anchor.n === 5` — progress dedupes by position id, the reading did not — and the post-verdict
answer moved the observed accuracy from 0/4 to 1/5. **A reading a player can improve by reloading is
not a measurement of the player.**

Per stratum, never across them: whether a bank answer taken under a retired protocol should be
re-asked is the open OWNER question `PRE_HUMAN_CEILING.md` files, and deduplicating across regimes
would answer it by dropping the re-answer.

### A sentence that excluded decisions from numbers they were in

`setAside`'s note said those decisions are "not averaged into `המספרים כאן`". Measured on the built
app, one `section.record-dashboard`: the note at y=1363, three denominators reading n=30 at y=1491,
and five reading **n=65** at y=2741. 65 = 30 + 35.

The arithmetic is right and is untouched — the branch tally carries its own denominator and is *"not
a comparison between decisions, which is the only operation a stratum boundary forbids"*. The defect
is the scope of the claim. And proximity could not have disambiguated it: the identical phrase sits
eight lines above in the stale-regime note, where it can only mean the whole panel.

---

## 3. The repair whose gate could not go red

`N-7`'s first repair shipped a layout test that forced the losing arm with **focus events**, on the
theory that `useDecisionCount` is one of two reads in `record-api.ts` without
`refetchOnWindowFocus: false`. An independent pass measured that arm: 50-56 synthetic
blur/visibilitychange/focus events dispatched across the engine wait, **5 of 5 runs on the
unrepaired build printed the CORRECT sentence.**

The test had gone red when it was written, and it went red for the wrong reason — the probe drew the
probed arm by chance. A gate that passes on an unfixed tree 65% of the time is not a gate.

Both arms are now pinned rather than sampled: `assignProbe` takes its `draw` as an argument and
`decision-session.ts` defaults it to `Math.random`, which `addInitScript` fixes before any page
script runs. Against the reverted arithmetic the two probed cases go red and both positive controls
stay green.

**The same thing happened again, on the next repair, and was caught the same way.** A guard written
to stop repeats winning a regime the reading it would otherwise lose stayed green when the rule it
guards was deliberately reverted — because every case in that file built ONE stratum, and with one
stratum the sizing function never runs. The replacement builds two regimes where ten repeats win by
row count and lose by comparable count. Red under the revert, green restored.

The transferable line: **a test that went red before the fix is not yet evidence that it went red
for the fix.**

---

## 4. What was measured and deliberately not repaired

### The position leaves the phone while the player declares what they read in it

At 390x844 and 320x844, at the scroll position the application sets itself, **0 of the board's 370px
is in the viewport during the tension, claim and confidence steps — 12 of 12 stage samples at each
width across three decisions.** At 1440x900 the same steps run with 99-100% of the board visible.
The mechanism is `CommitmentScreen.tsx`: on the arrival of a move the panel is scrolled with
`block: "start"`, measured as an app-driven smooth scroll 0 → 802 with no harness involvement.

`docs/INTERACTION_GEOMETRY.md` says DECIDE's centre is coupled and that the layout serving it is two
adjacent regions, *"not a single column with the board on top"*. The phone is one column with the
board on top.

**The size-constraint explanation was killed by measurement.** `block: "end"` was built and walked:
scrollY 790 instead of 802, board still 0%, because `.commitment-screen` is 833px on an 844px
viewport and aligning THE PANEL any way fills the screen. So the whole scroll range was swept
instead, asking at every position whether the open step is fully visible and any board is:

> **133 scroll positions have both. The best, y=510, shows 133 of 370px of board — 36%, three ranks
> — with the entire question on screen.**

The 0% is a consequence of scrolling the 833px panel rather than the question. It is not the phone's
height.

**And it is still not ours to fix.** If co-visibility of the position and the question is part of
what the declaration measures, this is a defect in the phone layout. If the declaration is meant to
be made from an orientation already formed, this is instrument necessity and the desktop is the odd
one out. `CommitmentScreen`'s docblock reasons only about the board being visible *while the move is
chosen*. Nothing in the repository answers the other half.

The sharper form of the question, and the reason it is worth the owner's minute: **the record does
not carry viewport class**, so if co-visibility is a condition, decisions taken under the two
conditions are pooled today with nothing distinguishing them — which is the shape of `reveal_timing`,
recorded per decision precisely because *"a decision whose condition nothing recorded is one that can
never be pooled with either mode afterwards"*. Adding that field before the owner says co-visibility
is a condition would be encodability bias, so it was not added.

### A failed chunk fetch takes the reveal off the screen 56 ms after it renders

Across a whole commit the app makes exactly **one** network request: `/assets/ValueReconstruction-*.js`.
Serve that one URL a 404 -- the exact deploy case `lazy-chunk.ts` names -- and, at 1440x900:

| | |
| --- | --- |
| +2554 ms | **the reveal renders**, body innerText 860 -> 1550 |
| +2610 ms | `document.body.innerText.length = 0`, `scrollHeight = 0` |
| +2764 ms | the DECIDE screen, for the position just recorded, commitment panel empty |

Present in one 50 ms sample, gone in the next. Aborting instead of 404ing gives the identical shape;
eight runs across both injection kinds. It is the product's own path and not the probe's: the app
POSTs its own `stale-build-reload` client-event and writes the `decision-lab.chunk-reload` mark
before `window.location.reload()`.

Two details make it worse than a lost screen. **On reveal 1 that chunk paints nothing** --
`ASK_AFTER_REVEALS = 2` -- so it mounts, fetches, renders nothing, and still costs the reveal. And
**the first failure is silent**: the product has a well-written stale-build screen with a reload
control, and `alreadyReloaded()` means it appears only on the second.

`lazy-chunk.ts` argues its own safety on two legs -- the record is written per decision, and
`session-position` puts the board back. Both were measured and both hold. Neither of them is the
reveal, and the docblock does not mention it. **A recovery that is safe for the record is not
automatically safe for the screen**, and the difference is exactly the state that is derived rather
than stored.

Not repaired. And the half of the next step that looked free is not: `/api/client-event` calls
`emit`, which writes one line to a runtime log, and `R-23` already records what that means here --
**Vercel Hobby retains runtime logs for one hour and sends no alerts**. The count cannot be taken
retrospectively, so the frequency question is downstream of an owner decision that was already open
before this pass found anything. `N-10`.

That is worth stating on its own, because it is the second time in this pass a discriminator was
checked before being trusted and turned out not to be the instrument it looked like.

### What the loop does on a reload

The reading is now sound whatever the screen does. What a re-armed board should say to a player who
has already answered it — refuse, advance, or say so — is a question about the product's voice.
Routed, not smuggled into a measurement fix.

---

## 4b. Three routes into one state, and the one thing that was repaired about it

`N-9` (reload, Back, the brand lockup out and back) and `N-10` (a failed chunk) all land the player
on a position they have already decided, with the commitment panel re-armed and the reveal gone.
Each was measured separately and each is routed separately, because what the screen should do is the
owner's.

What did not wait on that is the reading. The between-player comparison now admits one answer per
bank position whichever route produced the second one, so the measurement half of all three is
closed while the product's voice is still the owner's to choose.

## 5. Instrument defects found in this pass, recorded beside the four already in `harness/README.md`

**A probe that answers the counterfactual is not a probe that controls for it.** Every walk in this
pass answers `מה כן היית עושה` when it appears, which means every walk silently draws a 0.35 arm
that changes the code path under test. Three separate runs disagreed about which reveal was wrong,
and the disagreement was read as a race for two passes. `assignProbe` takes its `draw` as an
argument for exactly this reason.

**A gate that went red before the fix is not yet a gate.** Twice in this pass a falsifier was red
before and green after and still did not discriminate the rule it was written for. Both were caught
by reverting the rule into the tree and re-running, which is cheap and is now the last step of every
repair here.

---

## 6. Stopping state

Three families repaired, gated, and attacked. Two routed to `OWNER` with the REPO half of each one
closed by measurement rather than left as an opinion. One reality level raised: `N-7` from R3 to R4
on the deployed build, with a control.

What remains at the time of writing is the second-order pass over the repairs themselves and the
lenses still running. Nothing here says the UI has no more problems. It says that these are the ones
this pass could establish, and that two of them stopped at an authority this repository does not
hold.
