# The natural retest — recognising a future opportunity without telling the player

**Status: SPECIFIED, NOT IMPLEMENTED.** Every mechanism this needs exists in the tree except one,
and §6 names it. Nothing here ships until `BARRIER_DECISION.md` chooses a packet.

**Why this is the hardest requirement in the mission and not the last one.** Everything else can be
built and looked at. This one is defined by what the player must **not** see, so it cannot be
verified by looking at a screen — only by a rule that a machine enforces while nobody is watching.

---

## 1. The sequence, and where each arrow already exists

```text
past decision                 DecisionAtom, committed before reveal        SHIPPED
↓
candidate pattern             Claim, or a player-authored LearningRule      SHIPPED
↓
validated cue                 a frozen board predicate, Gate A + Gate B     MEASURED (RC-05)
↓
behavioural packet            BEHAVIORAL_PACKET_SPEC.md                     SPECIFIED
↓
player receives intervention  a surface that does not exist yet             NOT BUILT
↓
new ordinary game             Blitz, or the standard loop                   SHIPPED
↓
matching opportunity occurs   ← THE MISSING MECHANISM. Section 6.           NOT BUILT
↓
no cue is shown before the decision   ModeContract, DECIDE                  SHIPPED
↓
decision is recorded          DecisionAtom                                  SHIPPED
↓
after commit/reveal, classify trigger, action, outcome                      SPECIFIED
↓
update hypothesis             evaluateClaim / gradeLearningRule             SHIPPED
```

**Eight of the ten arrows are already in the tree.** The two that are not are the intervention
surface and the opportunity matcher, and only the second is hard.

---

## 2. The object

```ts
interface NaturalRetest {
  retest_id: string;
  packet_id: string;

  /* THE CRITERION, FROZEN. Everything in this block is written before the decision it judges. */
  target_cue: CueRef;              // the predicate, by name and version
  target_action: ActionSetRef;     // `satisfies`, by name and version
  negative_condition: CueRef;      // the trigger-negative definition. MANDATORY, not optional.
  measurement_protocol: string;    // shared/measurement-protocol.ts, by version
  eligible_context: EligibleContext;
  created_at: string;
  created_before_decision: true;   // asserted, and checkable against the decision's timestamp

  /* THE OBSERVATION, written after. Never earlier, never revised. */
  opportunity_id: string | null;
  decision_id: string | null;      // the DecisionAtom this retest judged
  trigger_classification: "T+" | "T-" | "ineligible" | null;
  action_classification: "in-B" | "not-in-B" | null;
  result: RetestResult | null;

  instrument_identity: InstrumentIdentity;  // engine build, nodes, predicate version, corpus
}

interface EligibleContext {
  time_controls: string[];         // a rule learned untimed is not the same rule at 3+0
  phases: ("opening" | "middlegame" | "endgame")[];
  min_seconds_on_clock: number | null;
  excludes: string[];              // named exclusions, each with a reason
}

type RetestResult =
  | "TRANSFER_SUPPORTED" | "TRANSFER_NOT_SUPPORTED" | "CRITERION_SHIFT"
  | "RECOGNITION_BLOCKED" | "ACTION_SELECTION_BLOCKED"
  | "MEASUREMENT_INVALID" | "INSUFFICIENT_OPPORTUNITIES";
```

**`negative_condition` is not optional and has no default.** A retest that records only trigger-
positive opportunities cannot distinguish a player who learned the rule from one who learned to
perform the action everywhere, and `STRONGEST_PERMITTED_CLAIM.json` says a Bayes-optimal classifier
handed the true generative model separates those at **0.500** when the negative cell is saturated.
The type makes it impossible to write a retest without one.

---

## 3. The criterion may not move after the move

Two mechanisms, because one of them is a promise and the other is a check.

**The promise:** `created_before_decision` and `created_at`.

**The check:** `GATE-RETEST-FROZEN-BEFORE-DECISION` compares `created_at` against the
`DecisionAtom`'s own commit timestamp and fails when the retest is younger. The repository already
holds this shape — `GATE-PREREG` does it for drills, and `research/b3_population_expertise/results/
PREREGISTRATION_FREEZE.json` does it with a hash for a whole study — so the idiom is borrowed rather
than invented.

**And the criterion is a predicate version, not a sentence.** `target_cue.predicate_version` is
hashed in `ITEM_BANK_PROTOCOL.md`. A retest whose predicate changed under it is
`MEASUREMENT_INVALID`, not a result, and `instrument_identity` is what makes that detectable rather
than silent.

---

## 4. What the player may not see while producing the evidence

The contamination list, and what already enforces each. This is the part that is mostly built.

| must be hidden during the measured decision | enforced by |
| --- | --- |
| prior evidence of any kind | `ModeContract.priorEvidence = false` in `DECIDE` |
| engine output | `ModeContract.engineOutput = false` in `DECIDE`, and `engineMayRun` |
| the rule, its text, its cue label | **not yet** — no surface shows it, because none exists |
| the recommendation | **not yet** |
| the weakness graph | `GATE-DECISION-FOCUS` keeps `RecordExplorer` off the deciding branch |
| the learning queue | same gate |
| *"this is one of your weak spots"* | `mayPrescribe`, which is `false` below `tested` |

`shared/interaction-mode.ts` holds ten modes and, for each, whether prior evidence may be on screen,
whether the engine may speak, and **whether the player is producing evidence right now**. `DECIDE`
and `ANSWER_INSTRUMENT` both carry `producingEvidence: true` with both permissions false. The table
is checked against `makingEvidence` and `engineMayRun` — the two functions the product actually runs
on — so a table that agreed with nothing would fail rather than decorate.

**What is missing is one row, not a mechanism.** `ModeContract` needs a `packetVisible` permission,
false wherever `producingEvidence` is true. That is the smallest change that makes the contamination
rule structural instead of a convention somebody remembers.

---

## 5. The primary endpoint, and the term that is not optional

```text
primary     ΔP(Y | X)      the action, given the cue, before and after the intervention
mandatory   ΔP(Y | ¬X)     the same action when the cue is absent
```

**Desired pattern:** `P(Y|X)` rises, `P(Y|¬X)` does not meaningfully rise.

Without the second term, unconditional responding is indistinguishable from learning — and worse
than indistinguishable here, because the repository has measured that a move-blind agent picking
uniformly among legal moves scores *d′* = **0.80** and *c* = **+0.88** on `RC-06`'s own prescription
sizes. **More than half of the lowest rating band's measured *d′* of 1.180 needs no knowledge of
chess.** Any sensitivity a retest quotes is against that floor, never against zero.

### Secondary, reported separately and never bundled into a score

Regret of the chosen action · probability of selecting an admissible action · win-probability loss ·
calibration error where a stated confidence exists · decision time · spontaneous cue detection ·
transfer latency. **None of these becomes a product claim** without its own forward test.

---

## 6. The one thing that does not exist: the opportunity matcher

Everything else in §1 is shipped or specified. The matcher is the mechanism that watches an ordinary
game and notices that the preregistered cue has become true — **without telling the player.**

**It is not hard for the reason it looks hard.** `rule_classes.py::trigger` already decides cue
membership from a board, with no engine and no search, and `RC-05`'s trigger is a legal-move scan and
an attacker lookup. Running it after each ply is cheap.

**It is hard because of when it may speak.** The matcher must:

* run during the game, so the opportunity is identified while it is happening;
* write nothing the player can see, and nothing any surface reads, until the decision is committed
  and revealed;
* record the opportunity even when the player does nothing interesting, because an opportunity that
  is only recorded when the rule fires is a cherry-picked denominator;
* record `T−` opportunities on the same terms, for the same reason.

**Base rates say the denominator is the binding constraint.** From the corpus manifest, per 180,000
sampled positions:

| class | `T+` positions | rate |
| --- | --- | --- |
| RC-05 safe-promotion | **370** | **0.21%** |
| RC-06 answer-the-mate-threat | 2,080 | 1.16% |
| RC-03 capture-the-checker | 2,057 | 1.14% |
| RC-02 recapture | 21,969 | 12.2% |

`ANCHOR_REBUILD` already lists *"that `RC-05`'s base rate of 0.22% permits a within-person study"*
among the things it does **not** establish, and this run reproduces the figure at **0.21%**. At three
sampled positions per game that is roughly **one qualifying opportunity every 160 games**, which is
`INSUFFICIENT_OPPORTUNITIES` unless every ply is scanned rather than three per game — and scanning
every ply changes the denominator, which changes the base rate, which has never been measured that
way.

**That is the first thing to measure, and it needs no engine and no participants:** run
`_promote_trigger` over every ply of the corpus rather than three plies per game, and report the
per-game opportunity rate. Until that number exists, no field protocol can size itself.

---

## 7. Shadow mode first, and what would end it

`INERTIAL_UX_LAWS.md` LAW 3 already prescribes the sequence and already runs one:
`client/src/lib/next-action-shadow.ts` computes what the derivation *would* have said and the screen
ignores it.

The matcher enters the same way:

1. **derive** — run the trigger after each ply, write the opportunity to a shadow ledger, show
   nothing;
2. **inspect** — read the disagreements between what the matcher called an opportunity and what a
   reader would; each shadow row carries `blind`, the inputs the surface could not supply, because a
   disagreement caused by a missing input is not the same finding as one caused by a wrong matcher;
3. **own** — only after disagreements are (a) not explained by a `blind` input and (b) ones a reader
   agrees the matcher got wrong.

**Build judge before contender.** The matcher is a classifier that will control what counts as an
opportunity, so it gets an oracle before it controls anything: the frozen corpus is one — 4,620
labelled trigger-positive and 4,821 trigger-negative items, with 1,100 hard negatives — and a matcher
that disagrees with the predicate that labelled them is wrong by construction.
