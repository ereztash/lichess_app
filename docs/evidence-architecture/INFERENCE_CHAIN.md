# The target inference chain, frozen

**This is a candidate decomposition, not a finding.** Nothing here asserts that each stage is a real
separable latent state. Several arrows below are marked `NOT-A-SEPARATE-STATE-YET` for exactly that
reason, and [`MODEL_COMPARISON.md`](MODEL_COMPARISON.md) exists to attack the decomposition itself.

The chain is frozen here so that later work has a fixed target to fail against, and so that a claim
can be located at an arrow rather than asserted about "learning".

```text
POSITION / DOMAIN STATE
    ↓ (1)
RELEVANT INFORMATION
    ↓ (2)
ORIENTATION
    ↓ (3)
SITUATION DIAGNOSIS
    ↓ (4)
POLICY / SCHEME ACTIVATION
    ↓ (5)
CANDIDATE GENERATION
    ↓ (6)
CONTROL / VERIFICATION
    ↓ (7)
ACTION SELECTION
    ↓ (8)
EXECUTION
    ↓ (9)
OBSERVED MOVE
    ↓ (10)
OUTCOME
```

**Status vocabulary.** `OBSERVED` — the repository measures something at this arrow.
`PROXY-ONLY` — something is measured that is downstream of it and is not specific to it.
`UNOBSERVED` — nothing in the repository or the research corpus bears on it.
`NOT-A-SEPARATE-STATE-YET` — the arrow may not correspond to a distinct latent state at all.

---

## (1) POSITION → RELEVANT INFORMATION

**Must be true:** there is a fact of the matter about which board features bear on the decision, and
it is determinable before the player acts.

**Repository observes:** the trigger predicates. Seventeen of them, each a pure function of the
position with no parameter through which the played move can reach it (V3). `C10` now asks, at
import, whether a trigger tests the condition its class is named after.

**Alternative mechanisms producing the same observation:** none — this arrow is about the domain,
not the player. **But the arrow can be wrong about the domain**, and twice it was:
`_passer_trigger` fires on positions the rule of the square does not describe
([`RECONCILIATION.md`](RECONCILIATION.md) §2.2); `_knight_check_a_queen_could_not_give` tests a
condition that is not the one claimed (§2.3).

**Disambiguating evidence:** a scope predicate for every stated condition, plus an audit of the scope
predicates themselves. The second layer is what §2.2 shows is missing.

**Status: `OBSERVED`, and demonstrably fallible.** Two of seventeen triggers were caught naming a
condition they do not test, and the correction for one of them was itself wrong.

## (2) RELEVANT INFORMATION → ORIENTATION

**Must be true:** the player's attention reaches the relevant region before, and causally upstream
of, everything that follows.

**Repository observes:** **nothing.** No eye tracking, no mouse trace, no region-of-interest
measurement, in production or in research.

**Alternative mechanisms:** orientation may not be a stage. In a strong pattern-recognition account
the relevant configuration is *recognised*, not *searched for*, and there is no separable orienting
step to measure. The Shogi verbal-protocol work (RIKEN) reports professionals reading **narrow and
deep** where intermediates read broad, which is consistent with either account.

**Disambiguating evidence:** gaze or region-restricted presentation, in a laboratory. Nothing
low-friction distinguishes them.

**Status: `UNOBSERVED` and `NOT-A-SEPARATE-STATE-YET`.**

## (3) ORIENTATION → SITUATION DIAGNOSIS

**Must be true:** the player forms a classification of the situation ("mate is threatened") distinct
from, and prior to, choosing what to do about it.

**Repository observes:** in research, nothing. In production, `known` / `unknown` / `known_parts` /
`unknown_parts` — a *stated read*, composed of tapped labels plus free text, written before reveal.

**Alternative mechanisms producing a correct stated read:** post-hoc rationalisation of a move
already chosen; selecting the label the interface makes most available; a correct read that did not
govern the move. **The stated read is written in the same sitting as the move**, so it cannot
by itself establish precedence.

**Disambiguating evidence:** MOVE-FIRST vs DETECT-FIRST order randomisation — which is Study D's
design and which #49 correctly identifies as an *intervention*, not a neutral instrument.

**Status: `PROXY-ONLY`.**

## (4) SITUATION DIAGNOSIS → POLICY / SCHEME ACTIVATION

**Must be true:** a diagnosis retrieves a policy, and the retrieval is a distinct event from the
diagnosis.

**Repository observes:** nothing that separates them. `LearningRule` stores a `trigger` and an
`action_rule` as two text fields, which is an *authoring* separation, not a measured one.

**Alternative mechanisms:** direct stimulus–response compilation with no intervening policy object;
a single recognition event that carries the action with it. **This is the arrow M0 denies exists**
(see [`MODEL_COMPARISON.md`](MODEL_COMPARISON.md)).

**Disambiguating evidence:** a case where diagnosis is demonstrably present and the action absent,
*and* a case where the action is present and the diagnosis absent, on matched items. The first half
is what a detection-then-action study would show; the second half needs the trigger-negative cell —
and §2.6a shows that on the only eligible class the trigger-negative cell scores a different act.

**Status: `UNOBSERVED` and `NOT-A-SEPARATE-STATE-YET`.**

## (5) POLICY ACTIVATION → CANDIDATE GENERATION

**Must be true:** an activated policy makes some moves available for consideration and others not.

**Repository observes — and this is the strongest process observation the product actually has:**
`bounded_action.candidate_moves_considered`, every distinct move physically placed on the board while
deciding, **in touch order**, plus the randomised `probe` arm asking for one named alternative after
commitment (V5).

**The asymmetry is documented in the code and is decisive for how it may be read** (V6): a move is in
the array **only if it was physically put on the board**. A player who weighed four moves in their
head and touched one leaves a list of length one. So:

- **presence is near-conclusive** — `chose-past-it` (the engine's move was on your board and you
  played something else) is a *lower bound* on "generated it and rejected it";
- **absence is uninformative** — it does not distinguish "did not generate" from "did not touch".

**Alternative mechanisms:** touching a move is not considering it (a slip, an exploration of the
board, a rehearsal of the opponent's reply). Touch order is not consideration order.

**Disambiguating evidence:** think-aloud on a subset, to estimate the touch-to-consider mapping once.

**Status: `OBSERVED, ONE-SIDED`.** The one-sidedness is the whole character of this arrow.

## (6) CANDIDATE GENERATION → CONTROL / VERIFICATION

**Must be true:** a generated candidate is checked before it is played, and the check can reject it.

**Repository observes:** `bounded_action.seconds_taken`, and `confidence` (1–7, with the scale and
grid version stored so an old row still asserts what the player said).

**Alternative mechanisms:** time is generated by anything — difficulty, interface, interruption,
number of legal moves. Confidence is a *report about* the decision, produced after it, and is asked
only on positions `shared/confidence-asked.ts` selects, so it is not missing at random.

**Disambiguating evidence:** revision after a generic (non-rule-specific) cue. A candidate that is
placed, then abandoned, then replaced after a cue is control being exercised where it was not
before. `candidate_moves_considered` **already records the placement order** that makes this
readable.

**Status: `PROXY-ONLY`.**

## (7) CONTROL → ACTION SELECTION

**Must be true:** among verified candidates, one is chosen, and the choice is attributable to the
policy rather than to a default.

**Repository observes:** the chosen move, and whether it satisfies `B`.

**Alternative mechanisms — this is the arrow the whole programme keeps failing at.** A move can
satisfy `B` from: explicit recognition; calculation without classification; a generic forcing-move
heuristic; familiarity; the move being the only plausible one; response bias; another tactical
motive; or **`B` being satisfied by almost everything**. The last is not hypothetical: on `RC-06`
trigger-negative items, **99.4% of legal moves satisfy the rule as written** (§2.6a).

**Disambiguating evidence:** a trigger-negative cell scoring **the same act**. That is the thing
that does not exist for the only eligible rule class, and #49's H23 gives a structural reason why it
cannot exist for outcome-shaped defensive rules.

**Status: `OBSERVED, UNIDENTIFIED`.** The observation exists; the inference does not.

## (8) ACTION SELECTION → EXECUTION

**Must be true:** the intended move is the move made.

**Repository observes:** the move, and in Blitz the clock. Mis-clicks are not distinguished from
choices.

**Status: `PROXY-ONLY`.** Low value at current precision, and cheap to leave alone.

## (9) EXECUTION → OBSERVED MOVE

Identity in this product: the committed move *is* the observation. The one thing worth recording is
that **`DecisionAtom` freezes the pre-reveal state** — `known`, `unknown`, `decision`,
`bounded_action`, `probe` — before the engine speaks, and `outcomeLeakControl` asserts the table is
identical after every oracle field is stripped.

**Status: `OBSERVED`.**

## (10) OBSERVED MOVE → OUTCOME

**Must be true:** the move's value is measurable.

**Repository observes:** `result.engine_eval_cp`, `engine_best_move`, `engine_depth`,
`engine_source`; in research, the full action-set model — `V_B`, `V_notB`, regret, advantage, the
within-`B` distribution, on two utility scales.

**Alternative mechanisms:** the utility scale can fail to price the decision. §2.5: every
mate-in-one position has mean `V*` = 1.000, so on expected score the sharpest rule class in chess
buys nothing, and in centipawns the same cell reads +99,255, which is a constant rather than a
quantity.

**Status: `OBSERVED`, scale-dependent, and the scale dependence is now measured.**

---

## Where the chain actually breaks

Four arrows carry the programme's whole risk, and they are not the ones a learning-UX design would
have prioritised:

| arrow | why it is load-bearing |
| --- | --- |
| **(1)** | a trigger that does not test its own condition invalidates everything downstream of it, silently, and did so twice |
| **(4)** | if policy activation is not a separate state, M1 is unnecessary and most of a learner model is unidentifiable |
| **(7)** | `B`-membership is the only behavioural observation, and on the only eligible class it is satisfied by 99.4% of moves when the trigger is absent |
| **(10)** | the utility scale broke the gate that ranked the rule classes |

**Arrows (2), (3), (5) and (6) are where a Learning UX would put its effort, and three of the four
are `UNOBSERVED` or `NOT-A-SEPARATE-STATE-YET`.** Building instrumentation for them before (1), (7)
and (10) are sound would produce richer measurements of a chain whose backbone is not established.
