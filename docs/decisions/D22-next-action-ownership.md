# D22 — may a derivation decide what the player is sent to next?

**Mode:** `DEFER` — the derivation exists, one surface shadows it live, and the correspondence
between what it proposes and what a control can name is now measured rather than waited for. No
screen has been handed over.
**Evidence level:** E2 — a reference behaviour reproduced beside the product and compared to it. It
has never been compared against a person's judgement, and reversal condition 3 is why that matters.
**Depends on:** `shared/next-action.ts`, `client/src/lib/next-action-shadow.ts`,
`shared/primary-action.ts`, `tests/shared/a-proposal-with-no-control-to-name-it.test.ts`,
`docs/INERTIAL_UX_LAWS.md` LAW 2 and LAW 3.

## CLAIM

`deriveNextAction` claims to know what a player should do next. P0.4 built it as a pure function and
P0.5 sequenced what may happen to it: **derivation, then shadow, then ownership per state.** The
shadow's own brief said why —

> the honest thing to do with a function that claims to know what a player should do next is to
> watch it disagree with the screens for a while before believing it.

That sentence describes a wait. **The wait had not started and could not finish.** The ledger it
writes to is a ring buffer in one browser's `localStorage`, this build has had no players, and the
trial ahead is eight to thirty people over a handful of sittings. So "for a while" was an unbounded
condition on a step nothing was going to satisfy, and ownership was blocked on it.

## WHAT THE SHADOW WAS ACTUALLY MEASURING

Two of its three inputs were about itself rather than about a screen. Both were found by reading it
against the screen it runs on, not by a test.

**`analysisRunning` was hard-coded `false`,** under a comment saying the front door does not
subscribe to the queue. `ResumeScreen` calls `useBlitzAnalysis()` three lines above the call that
set it. It did subscribe. `wait-analysis` carries `scoring` to the player and it is the difference
between *eleven games are waiting* and *eleven are waiting and one is being scored right now*; every
row the shadow had ever written said the second was never true.

**`offered` was the constant `"play"`** — a word in no vocabulary, recorded whether or not the
screen rendered a control. P1.5 made the front door deliberately offer **nothing** on
`nothing-scored`, because another game grows the backlog that is the blocker. That is the state the
derivation and the screen agree about most emphatically, and the shadow logged it as a
disagreement, for a reason belonging entirely to the shadow.

**And the comparison itself was one line of hand-written disjunction** —
`kind === "play-first-decision" || kind === "play-blitz"` — true of the front door, invisible to
every other screen, and silent if a kind were added.

A shadow with those three properties does not measure a screen. It measures its own description of
one.

## ALTERNATIVES

1. **Wait for players.** The original plan. Blocked on a trial that has not run, and the thing it
   would establish about the *mapping* does not need a person.
2. **State the correspondence once and test it.** `actFor` maps a proposal onto the act a control
   would have to name, over the closed vocabulary three gates already read; `agreesWith` is the
   comparison. Then totality, ontoness and reachability are facts about two closed sets.
3. **Instrument every surface live.** A shadow hook on the record page and the post-game screen as
   well as the front door.
4. **Hand the front door over now**, since it is the surface with the fewest blind spots.

## DECISION

**2, and 3 only where it is free.**

**The correspondence is stated once and tested.** `actFor` is total over `NextActionKind`; every act
it names is in `PRIMARY_ACTIONS`; exactly two proposals map to no act at all, and both are a screen
correctly going quiet — `wait-analysis`, whose act is to wait, and `none`, where the derivation has
nothing to say. Exactly three acts are unreachable from any proposal, and all three are mid-act
controls the player is already using rather than being sent to: `commit-decision`,
`answer-instrument`, `next-decision`. Every kind is reachable from a `ProductState` the product can
be in, so the mapping's domain is not hypothetical.

**The live shadow stays on the front door and does not go to the other two.** Not caution — cost.
`blitz-reading-api.ts` exists as its own module because the reading chain in the entry graph was
measured at **+16.1 kB raw / +5.1 kB gzipped**, and the record page and the blitz page would each
have to pull it, plus the analysis queue, to assemble a `ProductState`. That is a real page weight
on two hot routes to write a row nobody reads, in service of a question a test answers. The front
door holds all four readings already, so its shadow costs nothing and stays.

**`ShadowSurface` moved out of `acquisition-evidence.ts` into `shared/next-action.ts`.** §30's
import-graph rule is that nothing choosing a position, computing a reading or rendering a finding
may name the telemetry module. The shadow was naming it for a type. The rule is right and the type
was in the wrong file.

**And the ledger deduplicates per surface, not per name.** `trialEventSeen("next_action_shadow")`
meant whichever screen rendered first wrote its row and every other surface was silently absent —
a ledger that would have looked like agreement with two thirds of the product missing from it. That
is now `trialEventSeenOn(name, surface)`, which matters the day a second surface is instrumented and
would have been invisible until then.

**No screen is handed over.** Ownership is still per state and none has been taken.

## WHAT THIS DOES NOT ESTABLISH

The tests say the mapping is total, that it is onto everything but the three mid-act controls, and
that every kind is reachable. **They say nothing about whether a screen agrees**, which is a fact
about components in the states they are actually rendered in — and nothing about whether the
proposal is one a person would have wanted, which nothing in this repository can answer.

`docs/decisions/D21-feedback-exposure.md` is why the second gap is not worth closing by guessing: a
layer that changed what a player was shown based on their own measurements would create exactly the
exposure the record cannot represent.

## REVERSAL CONDITION

Any one of these takes a state, or reopens the design:

1. **A surface's screen and the derivation disagree on a state, in a walk over the built app.** That
   is a fact about the product available today, and it is what would say a screen is wrong rather
   than merely unshadowed.
2. **The blind spots close.** A drill and a transfer live in `Home.tsx`'s component state and do not
   survive navigating away — a LAW 4 defect with its own row. While they are invisible to every
   other surface, `continue-drill` and `continue-transfer` are proposals no screen could ever have
   agreed with, and a derivation cannot own a state whose highest-priority input it cannot see.
3. **A person disagrees with a proposal a test called correct.** The mapping is right by
   construction; the ORDER in `deriveNextAction` is a set of arguments, and an argument is the thing
   a person can be wrong about. The acquisition trial is where that first becomes observable.
4. **A screen offers an act the derivation cannot name.** The vocabulary is closed and the test
   above checks both directions, so this arrives as a red test rather than as a surprise — and it
   means either a new kind or a screen doing something the derivation has no theory of.
