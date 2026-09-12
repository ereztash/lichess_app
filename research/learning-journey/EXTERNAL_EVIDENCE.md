# External evidence, scored by what it changed

Run after `DR_PLAN_0.md` was frozen and after the live R&D run. Each branch is scored against the
decision value the plan declared for it in advance, so a mispredicted branch is visible as a
mispredicted branch.

Every row is `RESEARCH`-class evidence about *other products and other literatures*. None of it is
evidence about this product's users, and none of it raises any claim here above `R1`.

## E1 — chess learning products · predicted HIGH · **ΔDecision**

**Lichess puzzle dashboard.** Shows the three highest and three lowest performing themes, each with
a performance rating, a solve percentage **and a play count**, over a rolling 90-day window. The
denominator is always on screen, and the construct is explicit: it is a rating *inside the puzzle
instrument*, never a claim about games.

**Aimchess.** Six competencies (tactics, endgame, advantage capitalisation, resourcefulness, time
management, opening). It analyses the player's own games and **compares them to others at the same
rating** — the same population-baseline move the mechanism research makes — then generates puzzles
from positions the player actually misplayed and assembles a weekly study plan. This is candidate 3,
built and shipping.

**What it does not do, and this is the finding.** A review of the platform reports no sample sizes,
no confidence intervals, no statistical validation, and no evidence that solving the generated
puzzles translates into rating: it "fails to distinguish between puzzle-solving success and actual
game improvement". So the strongest commercial instance of managed-effort makes exactly the claim
the frozen pipeline says is unreachable, and substantiates it with testimonials.

**The transfer gap is documented in this category.** An empirical study of 2,763 active players
compared puzzle ratings against rapid game ratings, cross-referenced against a blunder taxonomy over
5.8 million Lichess puzzles. The reported mechanism is the load-bearing sentence for this decision:

> Puzzles train **solving**, while real games require **detecting that a tactic exists**. A high
> puzzle rating does not mean an equivalent game rating because puzzles train one skill while games
> need several.

**ΔDecision.** Candidate 3 is falsified in its efficacy register: it is buildable and common, and it
rests on a claim neither this repository's research nor the category's own products substantiate.
And the detection/solving split is precisely what this product's core act already isolates — the
player commits a read on a position from their own game before the engine speaks, which is a
detection act, not a solving act. Nobody in the category measures it.

## E2 — Go · predicted MEDIUM · **ΔAction**

**KaTrain / KataGo.** Immediate feedback on mistakes **with the option to retry**; a teaching-game
mode that automatically undoes moves that are sufficiently bad; auto-generated reviews focused on
the player's biggest mistakes **in terms of point loss, rather than deviation from AI style**. No
rank-progress meter is part of the loop.

**ΔAction.** Retry-before-explanation is the intervention shape a serious engine-backed trainer
converges on, and this product already owns the stronger version of it (the retry happens before the
reveal, not after). It also confirms the negative: a tool this deep in engine analysis does not
represent progress as rank.

## E3 — Riichi Mahjong · predicted HIGH for the context check · **ΔDistinction**

Tile-efficiency calculators measure `ukeire` (tile acceptance) with **no look-ahead**, so they will
call a deliberately slowed hand a mistake. Akochan Reviewer analyses **rank-point expected value**
rather than round or hand EV. Situational analysis is load-bearing because the game is
placement-oriented: a player in fourth should take more risk than a player in first.

**ΔDistinction.** Two analysers disagree about the same decision because they optimise different
objective functions, and neither is wrong. Mapped onto this product: the engine's centipawn loss is
**one stated objective function**, and a decision it scores as an error can be correct under the
player's own objective — a plan, a risk posture, a clock budget. A diagnosis is therefore not
automatically a deficit, and a product that goes straight from "the engine disagreed" to "here is
your weakness" has substituted the instrument's objective for the player's.

This product already holds the repair and does not present it as one: `LearningRuleComposer`
requires `would_choose_again` before a rule can be authored. The player says, having seen the
engine, whether they would still choose their move. That is the context check.

## E4 — Xiangqi · predicted LOW-MEDIUM · **Δ0**

Nothing found that discriminates between the candidate architectures. Recorded as a branch not to
repeat for this decision.

## E5 — cross-ecosystem product convention · predicted MEDIUM · **ΔDistinction, and a refusal**

**Convekta / CT-ART (RU tradition).** Over 2,000 positions hand-picked over twenty years, ordered to
ensure efficient learning; six modules across three levels. Structured, sequential, predetermined.
Mastery by progression through a curriculum.

**Chess.com (US).** Adaptive personalisation over the player's own games; the Coach "doesn't just
tell you what to play — he helps you understand what's going on in a position and encourages you to
look for the right answer".

**Reading.** These are different **coaching surfaces** over the same underlying loop: identify a
gap, practise it, check it. That supports the plan's invariance hypothesis. It supports nothing
about nationality, and **no product rule is derived from country here.** A user-selectable coaching
style is not built: no evidence says it is needed, and geolocating a coaching register would be a
stereotype dressed as personalisation.

## E6 — learning science · predicted mostly Δ0 · **the plan was wrong: ΔDistinction, decisive**

The transfer literature supplies the vocabulary this product's own state machine is missing.

- **near vs far transfer** — near is application to highly similar tasks, far is application across
  contexts that differ superficially but share a concept.
- **maintenance vs generalisation**, and
- **typical vs maximum transfer**: *typical* transfer is what happens in the ordinary environment,
  where the learner may apply the skill **without explicit prompts**; *maximum* transfer is measured
  when the learner is **prompted** to demonstrate what they have learned. "Typical transfer can be
  considered as what trainees **will** transfer, whereas maximum transfer can be considered as what
  trainees **can** transfer."

**Why this is decisive.** `beginLearningTransfer` presents the player with their own rule and three
positions chosen to test it. Under this vocabulary that is **maximum transfer at best** — prompted,
cued, and near. The product currently calls it transfer, and a passing result would be shown to the
player as evidence that the thing they learned is working.

What the product has never measured is **typical transfer**: whether the behaviour appears in
ordinary free play, unprompted, after the rule existed. And that is measurable from data the product
already records — every free-play decision carries a timestamp, a position, a stated confidence and
an engine verdict — without a single new claim and without a new instrument.

Deliberate practice also names the structure the product already has (baseline, immediate specific
feedback, repetition, subsequent measurement) and adds nothing to the architecture choice, which is
the part the plan predicted correctly.

## Branches that produced Δ0

`E4`. Do not repeat it for this decision.

## What no branch resolved

Whether cold users of **this** product fail to continue because the journey is illegible or because
its payoff is too far away. Every source above is about other products. That question is `FIELD`.
