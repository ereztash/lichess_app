# Where learning currently dies

**The chain, and the current system laid over it.** Each arrow is a place a player can be lost.
For each: the failure mode, what the repository can currently see, and what it cannot.

## CURRENT SYSTEM, as the code actually is

Read from the tree at `3f77a3d`, not from any PR body.

```
decision ──▶ evidence ──▶ finding ──▶ player-authored rule ──▶  ???  ──▶ retrieval ──▶ drill/test ──▶ future game
   │            │            │                 │                  │           │            │              │
 atom        engine     FindingCard     LearningRuleComposer    NOTHING   queue hides   3 unseen      no hook
 stored      scores     states what     6 fields, free text                the rule     positions,    at all
             it         may be                                             1/3/7/21 d   2-of-3,
                        believed                                                        2 days
```

| stage | teaching | rehearsal | discrimination | retrieval | transfer |
| --- | --- | --- | --- | --- | --- |
| finding → rule | **none** | none | none | none | none |
| rule → queue | none | **none** — the rule is authored once and never practised | none | none | none |
| queue → transfer test | none | none | **none** — no negative items exist anywhere | **yes** — the rule is genuinely withheld | none |
| transfer test | none | none | none | yes | **cued** — the position is presented |
| future game | none | none | none | none | **no hook exists** |

**Three of the five columns are empty everywhere.** The product has exactly one learning-relevant
mechanism — withheld-rule retrieval — and one measurement of it.

### What PR #48 got wrong, corrected against the tree

| PR #48 said | the code says |
| --- | --- |
| `replicated` arrives 47–81% from base rates | that is the **one-sitting** figure. `replicated` needs **two separate passing days**, so the null is **P(pass)²** — 9–65% across the same range |
| the recall floor is a bare word-overlap check | it has a stop-list, Hebrew normalisation, a 2-word absolute floor **and** a 0.34 ratio, and an `isScoreable` guard that refuses to create an unwinnable test |
| — | and the repo has **measured its own adversarial rate**: one generic sentence with no rule knowledge beat **2 of 8** realistic rules (down from 6/8 before the stop-list) |
| a failed sitting refutes | **refuting is symmetric with replicating** — two failed *days*, added precisely because the asymmetry was "the most damaging thing in this file" |
| — | transfer positions are **unseen, non-opening, and stride-spread** across the record |

**PR #48 overstated the defect and understated the design.** The corrected picture is *narrower and
worse*: the instrument is more careful than described, and still cannot reach the target construct.

---

## The barrier chain

### VALID INSIGHT → ATTENTION
- **Failure mode:** the finding is read as a number rather than a claim about the player.
- **Repo evidence:** `AUTHORITY` gives five levels with `mayPrescribe` true for exactly one.
- **Measurement available:** none. No player has used this build.
- **Missing:** whether anyone attends. **Contamination risk:** low.

### ATTENTION → COMPREHENSION
- **External:** V3 — feedback is **not one treatment** (d = 0.48 with substantial heterogeneity),
  moderated by **information content**.
- **Product solution elsewhere:** Chess.com Game Review and Aimchess both stop here; the repeated
  VOC verdict on Aimchess is *"a diagnostic tool, not a cure"* — the same diagnosis this repository
  reached about itself.
- **Missing:** any comprehension check. **This is not the binding barrier** (see V5: layout redesign
  changed nothing while the *activity* did).

### COMPREHENSION → RULE / SCHEMA FORMATION
- **Repo:** `LearningRuleComposer` collects six fields — trigger, missed signal, action, exception,
  predicted outcome, refutation condition. **This is the product's strongest single asset**: it is
  an if–then plan with an exception clause and a falsifier, which is the form V6 says works.
- **Failure mode:** the fields are free text with no constraint on what a *trigger* may be.
- **Missing:** any check that the trigger is **focal** (V8). See the two barriers below — this is
  where the chain is decided.

### RULE FORMATION → **CONTENT VALIDITY**
- **Failure mode:** the rule is wrong.
- **Repo evidence:** `docs/measurement/` — on the cleanest rule class anyone found, the prescribed
  act **loses ≥100cp on 15.0%** of the items where the rule says to act; on **22.8%** of negative
  items the scored false alarm is the engine's own best move.
- **Repo evidence, second:** `mayPrescribe` is true only at `tested` — **and is enforced in exactly
  one place**, `FindingCard.tsx:135`, to decide one line of card copy. It **never reaches the
  rehearsal path.** `formLearningRule` files at `hypothesis` and schedules retrieval for +1 day.
- **External:** V11 — FSRS optimises scheduling and **cannot assess content quality, by design.**
- **This is a real gate and it is missing.** A stronger teaching layer is an amplifier applied
  before the sign is known.

### CONTENT VALIDITY → MEMORY ENCODING
- **Repo:** nothing. There is no encoding step; the rule is typed once.
- **External:** V1 (generation/retrieval), V6 (rehearsal is a named moderator of if–then effects).
- **Missing:** the entire step. **This is the gap the brief was pointing at, and it is real.**

### MEMORY ENCODING → DELAYED RETRIEVAL
- **Repo:** `RETRIEVAL_INTERVAL_DAYS = [1,3,7,21]`, rule genuinely hidden.
- **Measurement available:** `scoreRecall` — a lexical floor whose own docblock says it is *"not a
  memory measure"*, with a **measured 2/8** adversarial pass rate and **no reliability coefficient**
  because nothing has been double-scored.
- **What it supports:** L0–L3 at best, and only weakly.

### DELAYED RETRIEVAL → **TRIGGER RECOGNITION**
- **Failure mode:** the player knows the rule and never notices the situation.
- **External, and this is the pivot:** V8. Spontaneous retrieval happens for **focal** cues — those
  the ongoing task already processes. Nonfocal cues need **strategic monitoring**, which under a
  3+0 clock will not happen.
- **VOC, independently converging:** *"in games there is nothing telling you that there is a tactic
  there, whereas in a puzzle you know there is something there"* — the same distinction, arrived at
  by players rather than by theory.
- **Repo:** nothing constrains an authored trigger to be focal. `MECHANISM_CLASSES` is a taxonomy of
  *labels* (`threat_scan`), which is nonfocal by construction.
- **Measurement available: none.** **This is where the chain most plausibly dies.**

### TRIGGER RECOGNITION → CONDITIONAL DISCRIMINATION
- **Failure mode:** the rule fires when it should not.
- **External:** V2 — a contrast set is the right shape *when* the difficulty is discrimination.
- **Repo:** **no negative items exist anywhere in the product.** Every transfer position is drawn
  from the player's own undecided decisions with no trigger-absent counterpart.
- **Consequence:** false application is **structurally unmeasurable today**, and it is half the
  target construct.

### DISCRIMINATION → ACTION SELECTION → ACTION UNDER TIME PRESSURE
- **Repo:** the transfer test is untimed and presented. Blitz is timed and unprompted.
- **External:** V4 — performance under one condition is an unreliable index of learning under another.
- **Missing:** any measurement that spans the two.

### ACTION → UNCUED TRANSFER → ECOLOGICAL BLITZ TRANSFER
- **Repo:** `docs/measurement/ECOLOGICAL_EXTRAPOLATION_GAP.md` places the instrument at **L2,
  aspiring to L3, not reaching L3** — the puzzle bank is selected by engine-uniqueness with no
  counterpart in ordinary play.
- **The target construct is L5/L6.** Nothing in the product observes a blitz game for a rule.

### → RETENTION
- Inherits the status of whatever it delays. Delaying an unmeasurable thing measures nothing.

---

## What `RULE_CLASS_SEARCH` changed, after this file was first written

Two of the four barriers below were revised by
[`docs/measurement/RULE_CLASS_SEARCH.md`](../measurement/RULE_CLASS_SEARCH.md), which merged while
this research was in progress.

- **CONDITIONAL DISCRIMINATION is no longer unmeasurable.** The screen is built on a
  trigger-negative cell; for `RC-06` it measured `B_valid | T−` = **.200** against .968 on T+.
  Negative items exist **in the corpus**. They still do not exist **in the product**.
- **CONTENT VALIDITY has a measured price now.** Following `RC-06` loses ≥100 cp on **2.9%** of its
  trigger-positive items; the refuted incumbent's figure was 14–15%. **That gap is the value of
  screening** — and nine of the ten researcher-designed candidates scored below the incumbent, while
  the product screens nothing at all and accepts whatever a novice types.
- **TRIGGER RECOGNITION → ACTION SELECTION is unchanged and is now the sharpest arrow in the chain.**
  The screen's own literature search reports that validated paradigms exist for check, mate and
  threat *detection*, and that **"every one measures whether the player SAW it. None measures
  whether the seeing governed the move."** Two independent routes — the prospective-memory framework
  and a rule-class search — arrive at the same arrow.

## Where learning dies, in order

1. **TRIGGER RECOGNITION → ACTION SELECTION.** Promoted to first. It is where the prospective-memory
   framework, the repeated player complaint, and the rule-class search's literature review all
   independently point, and **nobody in the field has measured it.** It is the subject of
   [`EXPERIMENT.md`](EXPERIMENT.md).
2. **CONTENT VALIDITY** — no gate. A player-authored rule is rehearsed before its sign is known, and
   the gate that exists in the vocabulary (`mayPrescribe`) is spent on one line of card copy. The
   screen puts a number on what screening is worth: 2.9% versus 15%.
3. **MEMORY ENCODING** — the step does not exist at all.
4. **CONDITIONAL DISCRIMINATION** — measurable in the corpus now, absent from the product.

**Barriers 2 and 3 are build problems. Barrier 1 is a measurement problem and it is the one nobody
has solved. Barrier 4 stopped being a blocker while this was being written.**
