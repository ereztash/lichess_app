# D28 — may the expression of the recursive loop vary by user, context, burden and horizon?

**Mode:** `DEFER` — the policy space is defined, the blocker is named and it is not a data shortage,
and one preparation that every candidate policy requires was made. No adaptive behaviour is built
and none is proposed for this build.
**Evidence level:** E1 for the architecture — the idea is externally attested and nothing has been
prototyped here. E2 for the blocker: it is read off this repository's own modules and reproduced by
a test. **Humans measured: 0.**
**Depends on:** `docs/decisions/D21-feedback-exposure.md`,
`docs/decisions/D22-next-action-ownership.md`, `docs/decisions/D26-primary-evidence-path.md`,
`docs/decisions/D27-recursive-spine.md`, `shared/confidence-asked.ts`, `shared/quiet-window.ts`,
`shared/evidence-policy.ts`, `shared/claim-state.ts`, `shared/spine.ts`,
`research/ux-measurement/MEASUREMENT_REACTIVITY_EXPERIMENTS.md` `X-0`,
`research/player-path/FIELD_RUN_CURRENT.md`.

---

## CLAIM

The question is whether the same recursive loop should be expressed differently for this user, in
this context, at this burden, over this horizon. The answer this node reaches is not *"not enough
data yet"*. It is sharper and it comes from the tree:

> **An adaptive policy is a stimulus that varies within a build and within a player. This record can
> represent variation within a build (barely, and only as of this commit) and none whatsoever within
> a player. So an adaptive product would not produce a worse claim. It would produce a claim nobody
> can interpret, and the failure would be silent.**

And one whole class of adaptation is refused for a second, independent reason that more
instrumentation cannot repair: a policy that changes *whether the instrument asks* as a function of
the player's own behaviour curates the sample on the variable being measured.
`shared/confidence-asked.ts` already refused the hand-operated version of that idea and wrote down
why. An automated version is the same defect with a controller in front of it.

---

## A. THE PR #109 BASELINE, RESTATED AND NOT REOPENED

```text
PLAY ──▶ CAPTURE ──▶ REVEAL ──▶ UPDATE ──▶ RETURN ──▶ PLAY
```

`ACT` is not a phase: the untimed lane plays the committed move at the continuation, after the
reveal, and the blitz lane plays it immediately and asks afterwards. The one ordering the spine
asserts is **`CAPTURE` before `REVEAL`** — the evidence packet closes before post-commit information
exists — and `mayShowPostCommitInformation` is held against `engineMayRun` so the boundary has one
definition.

Three state layers, composed as of #109:

| layer | module | values |
| --- | --- | --- |
| event | `shared/decision-stage.ts` | `deciding` `committing` `committed` `revealed` `blocked` |
| claim | `shared/claim-state.ts` | `unread` `accumulating` `nothing-separated` `candidate` `decided(replicated\|refuted)` |
| journey | `shared/next-action.ts` | eleven proposal kinds, `test-claim` among them |

This node adds nothing to any of them. It asks what may vary *around* them.

---

## B. INVARIANT VS ADAPTIVE, AND THE TEST THAT SEPARATES THEM

The useful split is not "epistemic things" versus "cosmetic things". It is:

> **Does the variation enter the evidence window, and can the record say which arm produced each
> row?**

Three tiers fall out, and they are ordered by how hard they are to escape.

### Tier 1 — refused on principle, and instrumentation cannot repair it

**Endogenous variation of the instrument.** Any policy that changes whether, when or how often the
instrument asks, *as a function of the player's own behaviour or state*.

`shared/confidence-asked.ts` states the argument in full, about the manual version:

> Whoever skips it skips it BECAUSE OF HOW THEY FEEL ABOUT THE POSITION — unsure, bored, in a hurry,
> embarrassed. That makes the confidence data a sample the player curated on exactly the variable
> being measured, and the calibration gap over a self-selected sample is not a noisier reading of the
> same thing, it is a reading of something else.

A burden-sensitive prompt rate does the curating on the player's behalf. The sample is still
selected on a variable correlated with the construct; the only change is that the selection is now
the product's fault rather than the player's. **This kills the single most attractive adaptive knob
in the whole space** — "ask less when they skip" — and it kills it before any evidence question
arises.

The existing design shows what the permitted shape looks like. `drawForDecision` is a pure function
of `(gameId, fen, ply)`: the draw is keyed on the **position**, deliberately not on the player, and
it is reproducible by any later analysis. That is exogeneity and auditability in four lines.

### Tier 2 — not refused, currently unanalysable

**Exogenous or presentational variation inside the evidence window.** An A/B arm, a different
explanation depth, a suppressed ribbon.

`research/ux-measurement/MEASUREMENT_REACTIVITY_EXPERIMENTS.md` `X-0` is the standing blocker and it
predates this node: of the six conditional surfaces in the evidence window, the record stores the arm
of **one**, two more are re-derivable, and three cannot be reconstructed at all. Its own verdict:

> Every experiment below needs to stratify on exposure, and three of them cannot be analysed at all
> without it. **Running X-1 or X-3 before X-0 produces a number nobody can interpret.**

`D21` Finding 3 is the same wall one layer up: within-player exposure has **no representation at
all** — no sequence, no index, no count on the atom. Decision #1 and decision #200 are one
population.

An adaptive policy is a within-player exposure by definition. It is therefore blocked by an
already-open node, by an argument nobody had to invent for this one.

### Tier 3 — already permitted, already used, and not "adaptation"

Variation the record already carries as a first-class axis:

| what varies | who chooses | stamped | stratum axis |
| --- | --- | --- | --- |
| reveal timing | the player, per game | `reveal_timing` | yes |
| purpose | the loop the position came from | `purpose` | admission, per `evidence-policy` |
| the quiet-window arm | the build | `quiet_window_exposure` | **yes, as of this commit** |
| claim state → next act | the record's own accumulated evidence | derived | not applicable: proposes, decides nothing |

This is the honest answer to the mission's question. **The loop already varies from pass to pass,
and the mechanism is #109: the claim state changes what may be proposed.** That is regulation the
record can name, and it is the whole of what is currently earned.

---

## C. TENSION REGISTER

Twelve were proposed. **Four do not survive contact with the repository** and are recorded as killed
rather than filled in, because a register that flatters a symmetry is worse than a shorter one.

| # | tension | value of A | value of B | too much A | too much B | signals | knobs | epistemic constraint | evidence needed | repo support |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **speed ↔ rigor** (absorbs *flow ↔ measurement*) | decisions get taken | decisions get measured | no readings; a calibration gap over decisions nobody stayed to record is no finding | abandonment, which `confidence-asked.ts` records as reported twice | completion latency, abandonment, decisions per session | `ASK_RATE`, `PROBE_PROBABILITY`, question count | the rate is a **population definition**: `measurement-protocol.ts` says a moved rate is two populations | the burden/time-to-first-claim curve, runnable on the shuffle harness with no field data | **strong**: `ASK_RATE = 0.15`, `PROBE_PROBABILITY = 0.35`, both moved once with the arithmetic written down |
| 2 | **autonomy ↔ guidance** | the player's own question goes first | the product says what is worth doing | a research instrument with no payoff | coaching, which the published refusal list forbids: *"לא ימליץ מה ללמוד, הוא מודד, לא מאמן"* | next-action agreement, `M3`/`M6` | next-action emphasis, whether a proposal renders at all | `D22`: no screen handed over; `next-action.ts` may never rank by expected value | a person disagreeing with a proposal a test called correct | **strong**: the whole `next-action` / `primary-action` pair |
| 3 | **observation ↔ intervention** | evidence means something | the player might improve | the Instrument–Telos problem, with its own research directory | every claim downstream becomes uninterpretable | `purpose`, `evidence-policy` admission | hints, retries, scaffolds — none built | **a hard constraint, not a dial.** `discovery` admits `play` only | a pre-registered intervention arm, which is `FIELD_PROTOCOL_TEMPLATE.md` | **strong**, and it is the repository's spine |
| 4 | **personalization ↔ generalization** | this record's own structure | a reading comparable between players | `R*` was predictive and mostly **level-typical**; personal-looking structure that is not personal | nothing specific enough to act on | anchor completion, population baseline | which positions are served | **the anchor set may never be personalised**: everyone answers the same positions in the same order or the between-player reading dies | a residual that survives population correction — `R**`, one record, one analysis | **strong**: `ANCHOR_SET_VERSION`, `population-baseline.ts` |
| 5 | **local engagement ↔ long-term internalization** | the session continues | the behaviour survives without support | rehearsal that measures nothing | a product nobody returns to | retrieval step, due counts, return gap | queue cadence, what is visible by default | a cue kept permanently in view is rehearsed on every visit, so the delay stops being the thing under test | `RETRIEVAL_INTERVAL_DAYS` with a null model, which `D23` says it lacks | **strong**: the LearningQueue repair is a shipped instance |
| 6 | **assistance ↔ independence** | success now | success later, unaided | supported performance read as ability | no scaffold ever offered | `purpose` on every decision | hints, drills, transfers | **already structurally enforced**: `drill` and `transfer` are refused by `discovery` and scoped to a matching test | a measured gap between supported and unsupported success | **strong**, and it needs nothing new |
| 7 | **simplicity ↔ expressiveness** | one thing to do | everything available | a product that hides its own evidence | *"A column of nine sections does not offer nine things; it offers a search"* | — | disclosure state, explanation depth, provenance depth | LAW 1: no reading of the record while evidence is being made | `M2`, `M6` from the FIELD run | **decided already** by LAW 2 and the `RecordExplorer` split |
| 8 | **user value ↔ system value** | the player gets something | the record gets something | a product | an employee of the research instrument | `M6`, `M7` | whether evidence is requested at all | the next action must not be derived solely from what the record lacks | `M6` failing at `A0` | **strong**: `research/instrument-telos/` |

### Killed

* **flow ↔ measurement.** The same dial as 1 in this product. Two names for `ASK_RATE` and
  `PROBE_PROBABILITY` would let a policy move one while claiming the other was untouched.
* **immediate ↔ delayed reinforcement.** **Not a tension here, because side A does not exist.** No
  rating, score, streak or badge exists anywhere in the build and a test holds the absence
  (`PRODUCT_STATE_WALK.md` §4, collapse 6). This is a proposal to add a mechanism, and it belongs in
  §F as a feedback-kind question rather than as a dial with two live ends.
* **exploration ↔ exploitation.** Exploitation here means choosing what to serve so as to maximise
  information gain for the instrument. That is the Instrument–Telos failure stated as an objective
  function, and the product refuses it. There is no balance to find.
* **stability ↔ novelty.** No novelty mechanic exists, and `GATE-SAID-ONCE` already governs
  repetition in the direction that matters. `D27` scoped the remaining question as perceptual
  differentiation of semantic transitions, which is a design question rather than a policy one.

---

## D. CONTEXT MODEL — only what could change a decision

| dimension | values that exist **today** | where it comes from | could it move a policy? |
| --- | --- | --- | --- |
| task | `first` `anchor` `play` `import` `drill` `transfer` | `DecisionPurpose`, stamped | yes, and it already does: `ALWAYS` vs the sampled branch |
| lane | untimed / blitz | route, and `measurement_protocol` | yes: the action ordering differs |
| reveal timing | `per-decision` / `end-of-game` | the player, per game, stamped | yes, and it already does |
| claim state | five kinds | `claimStateOf` | yes, and it already does: `test-claim` |
| session position | first visit / returning | `visitsOnRecord()`, `return_session_started` | weakly: it gates the resume screen |
| burden | **nothing** | — | **cannot: nothing counts prompts, skips or latency per decision** |
| learning state | unassisted / assisted, via `purpose` | `evidence-policy` | yes for admission; nothing observes "later unassisted" |
| exposure | **nothing** | — | **cannot: `D21` Finding 3** |

Two of the eight dimensions the mission asks for **do not exist as observations**, and they are the
two an adaptive controller would lean on hardest. That is not a gap to be filled casually: `X-0`
owns one and `D21` owns the other, each with candidate schemas already written down so that whoever
adds one is choosing rather than inventing.

**Self-initiated reflection does not exist and is not assumed anywhere below.** `D27`'s loop walk
recorded it: every capture in this product is system-sampled or implied by purpose.

---

## E. HORIZON MODEL

The governing rule, and it is the one this product can actually enforce:

> **The granularity of the feedback may not exceed the granularity of the evidence.**

| horizon | what the record can support saying | what it may not say |
| --- | --- | --- |
| seconds | this decision cost N pawns; the engine's move was X; one move was recorded as considered | that the player is weak at this |
| session | another comparable decision is in the record; the count moved | that they improved |
| days–weeks | the signal appeared again in this context; the floor was reached; nothing separated | that a recurring signal is "your weakness" |
| longer | the behaviour occurred in ordinary play without the support; a forward test survived or died | that the product caused it — `INTERVENTION not yet established` |

The reveal already obeys this. `inferenceLimits` renders *what this decision does not yet say*
before anything else on the panel, and the accumulation block counts rather than praises.

---

## F. THE THREE THINGS CALLED FEEDBACK

| kind | purpose | exists here? | governed by |
| --- | --- | --- | --- |
| **epistemic** — what changed in what is known | tell the truth about the record | **yes, and it is essentially the whole product** | `claim-state`, `learning-journey`, `reveal.ts` |
| **learning** — help change a future decision | act on a finding | **partly**, and behind a flag `D25`/`D26` keep off | `learning-record`, drills, transfers |
| **behavioural reinforcement** — make the act more likely to repeat | retention | **does not exist** | nothing |

Treating these as one category is how "reward" becomes a design conversation. The useful policy
question is not *how strong* but *which kind is justified now* — and for this product the answer is
almost always **epistemic**, because that is the only kind whose granularity the record can match.

`"no reinforcement"` is a valid and currently the *default* policy output, and the FIELD run is
the thing that would say whether the absence costs anything: `M6` (is the next unit of effort worth
it) and `M7` (does anyone continue unprompted) are exactly that question.

---

## G. THE THREE-AUTHORITY MODEL, TESTED AND PARTLY REJECTED

Proposed: an Epistemic controller with veto, a Learning controller, an Experience controller.

**As a conceptual separation it is already real and already named.** `evidence-policy.ts` is the
epistemic authority; `learning-record.ts` and the journey family are the learning authority;
`INERTIAL_UX_LAWS.md` is the experience authority. The arbitration the mission describes is what
LAW 1 already does: *the moment the engine may speak is the moment the record may.*

**As three runtime services it is rejected, on this repository's evidence.** Arbitration implies the
three can disagree and that something resolves the disagreement at runtime. In every case examined
here the epistemic authority's answer is not a vote — it is a precondition that removes the option
before the other two are consulted. A veto that is always checked first and is never overridden is a
**guard**, and the repo already spells guards as total functions and gates rather than as
negotiating parties.

The one place the metaphor earns its keep is as a **review question**, not as code:

> Before adding any variation: which authority is proposing it, and has the epistemic one been asked
> whether the record could name the arm afterwards?

That question is what this whole node exists to answer for the general case, and the answer is
currently *no*.

---

## H. SPINE × POLICY MATRIX

| phase / transition | invariant | adaptive (eventually) | signals that could legitimately move it | forbidden |
| --- | --- | --- | --- | --- |
| **PLAY** | ordinary chess is the environment; `PLAY → PLAY` exists so reflection is optional | nothing today | — | making capture the price of a move |
| **PLAY → CAPTURE** | the draw is exogenous and reproducible (`drawForDecision`) | the *rate*, as a pre-registered population change with a version bump | corpus-level burden/yield curve; never this player's skips | keying the draw on the player; any endogenous rate |
| **CAPTURE** | no reading of the record while evidence is made (LAW 1); the packet is immutable once committed | packet depth, question count — under `X-0` | task context, purpose | exposing engine-derived information; changing depth on the player's own answers |
| **CAPTURE → REVEAL** | the packet closes before post-commit information exists | *when* the reveal happens: already adaptive, already stamped, already a stratum axis (`reveal_timing`) | the player's explicit choice | any verdict, hint or evaluation before commit |
| **REVEAL** | limits render before findings; `nothing yet` is a valid reveal | explanation depth, provenance depth | comprehension evidence from FIELD | manufacturing a finding to fill the panel |
| **REVEAL → UPDATE** | a decision changes counts, never a grade | — | — | letting a bad move create a pattern claim |
| **UPDATE** | a claim never moves to `replicated` from more retrospective data | which reading leads | claim state | presenting a hypothesis in a finding's words |
| **UPDATE → RETURN** | the proposal is derived from the record, never from a prediction about the player | ranking among open items | claim state, runs in progress | ranking by expected value; naming what to work on |
| **RETURN** | every proposal re-enters a phase that reaches `PLAY` | emphasis, whether a proposal renders at all | burden — **once burden is observable** | a dead end; a proposal with no arc back |

---

## I. UX KNOB REGISTER

| knob | attaches at | tension | in the evidence window? | verdict now |
| --- | --- | --- | --- | --- |
| `ASK_RATE` | PLAY → CAPTURE | 1 | **yes** | fixed. Moving it is a population change and needs a version bump |
| `PROBE_PROBABILITY` | CAPTURE | 1 | **yes** | same |
| question count / packet depth | CAPTURE | 1, 7 | **yes** | blocked by `X-0` |
| reveal timing | CAPTURE → REVEAL | 1, 5 | yes, and **already stamped and stratified** | the model for all the others |
| quiet-window arm | CAPTURE | 3 | yes, **stamped, and a stratum axis as of this commit** | the second model |
| explanation depth | REVEAL | 7 | yes, via exposure | blocked by `X-0` |
| provenance depth | REVEAL, UPDATE | 7 | yes, via exposure | blocked by `X-0` |
| next-action emphasis | RETURN | 2 | yes, via exposure | blocked by `D22` first, then `X-0` |
| practice surfacing | RETURN | 5, 6 | yes | unreachable anyway: no shipped record has a claim |
| hint / retry availability | CAPTURE | 3, 6 | **yes, maximally** | not built; would need a pre-registered arm |
| summary cadence | UPDATE | 5 | yes, via exposure | blocked by `X-0` |
| visual / motion intensity | all | 7 | **no**, if it carries no information | the one class genuinely outside the window, and correspondingly the least valuable to adapt |

**Deleted from the candidate list:** *feedback latency* (it is `reveal_timing`, which already exists
and is already a stratum axis — a second knob for it would be a second definition), and
*default expanded/collapsed state* (a per-viewer convenience with no decision value, and LAW 2
already decides what a state's primary action is).

The last row is the uncomfortable one. **The only knob that is cleanly outside the evidence window
is the one with the least reason to move.** That is not a coincidence; it is what "inside the
evidence window" means in a product whose output is what the player believed before feedback.

---

## J. SIGNAL REGISTER

Every candidate signal, as observation versus inference. The `PERMITTED` column is bounded by what
exists — and most of these are **not observed today**.

| observed | recorded? | inferred | alternatives | permitted use | forbidden use |
| --- | --- | --- | --- | --- | --- |
| a decision was committed | yes | the player decided | — | counts, strata | "engaged" |
| confidence was not asked | re-derivable from `(gameId, fen, ply)` | the draw passed over it | — | exclude from calibration, count separately | treat as low confidence |
| the probe was assigned | yes, `probe.assignment` | — | — | stratify | — |
| a prompt was skipped | **no.** Nothing records a skip | burden may be high | bad timing, game urgency, unclear copy, low perceived value | **nothing today** | labelling the player low-motivation |
| completion latency | `seconds_taken` per decision, yes | thinking, or distraction | a phone call | it is already a measured variable | a proxy for effort |
| abandonment | partly: `acquisition_entry`, `next_decision_started` | the loop lost them | anything | funnel rates, in aggregate | a trait |
| return after days | `return_session_started` with `hoursSincePrevious` | — | two tabs, a cleared browser — both stated in `App.tsx` | describe the gap | "they lapsed" / "they came back keen" |
| a claim exists and is untested | yes | a question is open | — | propose a forward test (#109) | say what the player is bad at |

**The pattern in the "recorded?" column is the finding.** The two signals an adaptive controller
would most want — skips and cumulative burden — are the two that do not exist. Building them is
`X-0`-adjacent work with a schema choice attached, not a logging line.

---

## K. TEN CASE WALKS

Format: context → event / claim / journey → tensions → constraints → policy → what would falsify it.

**1. Cold user, `unread`.** Journey: `none`, because the reading has not resolved.
*Policy:* say nothing about the record; the value contract carries the screen. **May not** render an
empty-record sentence as if it were a reading — which is exactly `R-30`, open and deliberately
unrepaired on the frozen surface. *Falsified by:* `M1` passing at `A0` while the empty sentence is
on screen, which would say the aliasing costs nothing.

**2. `accumulating`.** Tension 1 and 8 both live. *Policy:* the per-decision reveal is the payoff and
the count is not; the floor is named so the distance is a fact rather than a wall. **May not** lower
the floor to produce an earlier finding. *Falsified by:* `M6` failing — the next unit of effort is
not worth it — which would make the reveal an insufficient payoff and is a product question, not a
policy one.

**3. `nothing-separated`.** The hardest case, and the product's best-defended boundary.
*Policy:* the existing sentence — *"שהוא לא הפריד ביניהם לא אומר שאין מה למצוא בכם, אלא שהוא לא
מצא"* — scopes the silence to the detector. **May not** convert restraint into fake progress.
*Falsified by:* `M8` read as failure (*"so it didn't work"*), which `FIELD_RUN_CURRENT.md` already
classifies as a claim-boundary problem rather than a copy problem.

**4. `candidate`.** *Policy:* this is the one pass where something genuinely new becomes possible,
and #109 is the mechanism: `test-claim`. **May not** raise the register during `CAPTURE` because a
candidate exists — that would be exposure, and the record cannot represent it. *Falsified by:* a
player who runs the drill and cannot say what it was testing.

**5. `decided/refuted`.** *Policy:* the proposal stops; the stage names a saving and a continuation.
**May not** read as failure, and may not read as improvement. *Falsified by:* a participant reading
the refutation as a verdict on themselves.

**6. `decided/replicated`.** *Policy:* the claim may be stated in a finding's words rather than a
hypothesis's — `GRADE_WORD` already enforces the vocabulary. **Still not justified:** any claim that
the player has changed, or that the pattern is personal rather than level-typical. `R*` is the
standing warning: predictive, and mostly level-typical.

**7. Repeated skipping.** *Policy today:* **nothing, because nothing is observed.** If it were
observed, Experience policy could move *where* a prompt appears; it may never move *whether* the
instrument samples this player, per Tier 1. **May not** infer anything about the player's chess.

**8. Assisted success.** *Policy:* `purpose: "drill"`, refused by `discovery`, scoped to a matching
test. The lineage is already structural and needs nothing. The open question is the **later
unassisted** observation, which `WATCHED_IN_PLAY` counts on both sides of the line and attributes to
nothing.

**9. Repeat user, low burden.** *Policy:* unchanged, and this is the case that most tempts a quiet
mode. Burden is not observed, and the quieter-over-time hypothesis is untested. `M7` is the measure.

**10. High system value, low user value.** *Policy:* **do not ask.** This is the Instrument–Telos
case stated as a single interaction, and the rule `next-action.ts` already carries is that a
proposal is justified by a fact about the record — never by what the record is missing *for the
system's benefit*. The honest output is `none`, which is a first-class answer.

---

## L. COMPETING ARCHITECTURES

| architecture | what it needs | status |
| --- | --- | --- |
| **fixed UX** | nothing | **what ships.** Sufficient until something measured says otherwise |
| **claim-state-conditioned UX** | the claim state to reach the layer that proposes | **built, in shadow** (#109). Handing it a screen is `D22`, still `DEFER` |
| **rule-based context-sensitive UX** | `X-0`; a burden observation with a schema; a within-player exposure axis (`D21` F3) | **blocked on two open nodes**, neither opened by this one |
| **learned policy** | all of the above, plus per-player n that this product does not have — `MIN_BUCKET_N = 30` per bucket, and a policy has more arms than a bucket has strata | **not reachable from here.** Worth naming only to say so |

Moving from row 1 to row 2 needs a FIELD result locating a failure at next-action selection (`M3`).
From row 2 to row 3 needs `X-0` closed and `D21` Finding 3 decided. From row 3 to row 4 needs a
per-player sample size nothing in this product's trajectory suggests.

---

## M. MINIMUM CURRENT ACTION

**`DOCUMENT_ONLY`, plus one `SMALL_ARCHITECTURAL_PREPARATION` that was already owed.**

`quiet_window_exposure` has been an atom field, a wire field and a MySQL enum since migration
`0019`, and `stratumKeyOf` did not read it. That is the third instance of one defect in one key:
`reveal_timing` was stamped and unread (*"the recording happened; the wall did not exist"*),
`protocol_version` was stamped and unread (`D21` Finding 1), and the product's **only stimulus arm**
was stamped and unread.

It is the preparation every candidate policy in §L requires, and it fails the "unused abstraction"
test in the right direction: it changes a real computation, it is demonstrated red by removing one
line, and no screen moves.

* `StratumKey` gains `quietWindow`; `stratumKeyOf` reads the field; `stratumId` gains a segment.
* `EVIDENCE_POLICY_VERSION` 4 → 5, in the same commit, because a bucket now produces a different
  population — `D21`'s lesson that the axis and the bump belong together.
* `LEGACY_CONTEXT` for pre-`0019` rows. Backfilling to `visible` is tempting here and is refused:
  `features.ts` is the file that says a flag moves without a commit, so nothing in the tree can
  establish what environment a deployment carried.

**The cost is stated rather than hidden.** Rows written between the reveal-timing migration and
`0019` now split off as `legacy`. How many exist on a real record is not knowable from the tree; the
measurement that settles it is a count of `quiet_window_exposure IS NULL` beside
`reveal_timing IS NOT NULL` on the owner's record. The floor is 60, so the split could plausibly
cost a claim.

**Not done:** no `PolicyInput` type, no controller, no registry, no telemetry. Every one of those
would be an abstraction with no runtime consumer, and §20 of the brief and this repository's own
habits agree about what that is worth.

---

## N. WHAT MUST WAIT UNTIL AFTER FIELD

Unchanged from `D26` and `D27`, and this node adds nothing to the frozen stimulus:

* self-initiated reflection on any FIELD-reachable surface;
* `EXPERIMENTAL_LEARNING_ENABLED`;
* the `C-1` two-denominator condition;
* `R-30` on the record page;
* handing a screen to `deriveNextAction`;
* moving run state out of `Home.tsx`;
* any change to `ASK_RATE` or `PROBE_PROBABILITY`, which are stimulus by definition.

Three frozen research snapshots — `research/instrument-telos/CURRENT_STATE.md`,
`research/journey-pass/CURRENT_STATE.md` and `research/player-path/PRODUCT_STATE_WALK.md` — record
`EVIDENCE_POLICY_VERSION = 4`. They are **correct about the builds they name** and are not edited:
each says in its own first lines that it is frozen at a commit.

---

## O. FALSIFICATION CONDITIONS

**What would kill the adaptive-policy idea outright:**

1. A FIELD run where `M1`–`M6` pass at `A0` and `M7` passes too. A product people understand and
   voluntarily continue has no regulation problem to solve, and every knob above becomes
   optimisation without a complaint behind it.
2. A measurement showing the calibration gap does **not** move with exposure (`D21`'s own reversal
   condition). Then the within-player axis is not worth its power, the analysability blocker
   weakens — and so does the reason to vary anything, because variation that changes nothing
   measurable is decoration.

**What would revive it:**

3. `M3` failing while `M1` and `M2` pass: understood, and cannot act. That is the next-action layer,
   and it is the one place a claim-state-conditioned policy has a stated job.
4. `M6` failing with a burden complaint attached and located at a specific moment. That would make
   burden a construct worth the schema it needs.

**What would falsify this node's central claim** — that adaptation is unanalysable rather than
merely premature: a demonstration that a within-player arm can be stratified without a within-player
axis. It cannot, and the reason is arithmetic rather than architectural: `stratumId` is computed
from a row, and an arm that varies inside a build leaves no trace on a row that does not carry it.
