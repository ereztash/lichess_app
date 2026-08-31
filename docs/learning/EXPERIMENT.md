# Study 0 — does the retrieval step practise the wrong response?

**One study. One factor. It can come back saying the current design is fine, and the condition under
which it does is written below before anything runs.**

---

## Why this question and not the one that was asked

The brief asked for a study that would show the current *Blitz + insight* loop is inferior to
targeted micro-training, across four cumulative arms (A: insight as-is; B: + self-explanation and
if–then; C: + contrast; D: + fading and delayed retrieval).

Three things in the tree say that study cannot be the first one.

1. **It cannot be bought.** Four arms at a 0.3 difference needs ~446 participants
   ([L7](FALSIFICATION_REGISTER.md#l7)). The supply is eight to thirty.
2. **The arms are cumulative, so a positive result names no component.** D beating A says the
   bundle works and says nothing about which part earned it — and each part costs a different amount
   to build.
3. **An experiment designed to prove a conclusion is the move this repository refuses everywhere
   else.** `docs/decisions/D05` rejected its own preferred candidate twice on a rule written before
   the run; `docs/measurement/` returned NO-GO on the feature it was scoped to enable. A study
   framed as *show that X is inferior* has already decided. The framing below is symmetric.

**And [L1](FALSIFICATION_REGISTER.md#l1) reframes the comparison honestly.** There is no teaching
step in the product today, so this is not *better teaching versus current teaching*. It is **one
component versus none**, which is a weaker claim than the brief assumed and is the true baseline.

---

## The factor

**Response congruency in the retrieval step**, the strongest moderator in the largest relevant
meta-analysis (Pan & Rickard 2018, 122 experiments, N = 10,382, transfer d = 0.40 [0.31, 0.50]).

The shipped retrieval step demands **two different responses**: reproduce the rule as text, and
choose a move. `record-service.ts` requires both for a success. The criterion the product actually
cares about is the move.

| condition | what the player does at retrieval | time on task |
| --- | --- | --- |
| **INCONGRUENT** (current) | writes the rule from memory, then plays one position | equated |
| **CONGRUENT** | plays diagnostic positions, rule withheld, no text | equated |

**The manipulation is subtractive.** The congruent condition *removes* the text step and spends the
same minutes on more move-choice items. So a positive result cannot be extra effort, and a null
result is informative in its own right: it says the text step costs nothing and may stay.

---

## Design: multiple baseline across rules, within participant

**Not four groups.** WWC Single-Case Design v5 is already adopted at tier A in
[`EVIDENCE_MANIFEST.json`](../measurement/EVIDENCE_MANIFEST.json); this applies it rather than
importing something new.

Each participant authors **three or four rules** in the ordinary way. The congruent retrieval
condition is introduced to their rules **one at a time, at staggered points**, chosen at random per
participant. Every rule is measured on every session from the start.

```
rule 1   ─── baseline ───┤ congruent ─────────────────────────────
rule 2   ─── baseline ─────────────┤ congruent ───────────────────
rule 3   ─── baseline ───────────────────────┤ congruent ─────────
                          ↑         ↑         ↑
                          three demonstrations, three points in time
```

**Why this shape answers [L5](FALSIFICATION_REGISTER.md#l5).** Practice, maturation and regression
act on every rule at once. A rule still in baseline on the day another rule changes is a concurrent
control **in the same person, on the same day, on the same board**. If all three series rise
together, that is practice and the study says so. The design's whole strength is that the
alternative explanation is measured rather than assumed away.

**Phase-length and data-point requirements are `[READ OFF THE STANDARD]`.** WWC v5 sets minimum
observations per phase and minimum demonstrations for each rating tier. Those numbers are taken from
the standard at protocol-writing time and are not guessed here — inventing them is the thing
[`ANALYSIS_PLAN.md`](../measurement/ANALYSIS_PLAN.md) forbids.

---

## The outcome, and why it is not *d′*

[L4](FALSIFICATION_REGISTER.md#l4) rules out sensitivity on the refuted construct.
[L3](FALSIFICATION_REGISTER.md#l3) rules out *recall floor AND accurate move*.

**Primary: rule-consistent action, modelled with item base rate as a covariate.**

For each item, two things are recorded and kept apart:

| recorded | from |
| --- | --- |
| did the player perform the act **their own rule prescribes** | the rule's `action_rule` and the move played |
| what proportion of players at this strength perform that act **unaided** | the corpus scan in `research/measurement/`, 57,504 classifiable positions |

The act is modelled with random intercepts for participant and for item, and **the corpus base rate
as a covariate rather than a filter**. A cut point that called an item "diagnostic" below some
threshold would be an invented threshold; carrying the base rate as a covariate answers the same
question — *did the rule add anything beyond what players do anyway* — with no cut to justify.

**Reported alongside, never instead of:**

- **hits and false alarms separately**, with Wilson intervals. Accuracy alone is forbidden here for
  the same reason [`ANALYSIS_PLAN.md`](../measurement/ANALYSIS_PLAN.md) forbids it: in the corpus
  audit accuracy rose monotonically .751 → .820 across rating bands while *d′* did not.
- **criterion *c* beside any sensitivity estimate**, because
  [F5](../measurement/FALSIFICATION_REGISTER.md#f5) found the criterion, not the sensitivity, is
  what ordered rating bands.
- **the harm series**, below.

**Secondary: rule reconstruction after delay.** Scored against the participant's own authored text.
This is the one of the brief's six outcomes that survives today, and it is L0 on the ladder — *they
can state it* — which licenses nothing about doing it.

---

## The harm series, which is a primary outcome and not an adverse event

From [L8](FALSIFICATION_REGISTER.md#l8): the rule is authored by the player, filed as `hypothesis`,
and rehearsed from day one. On the cleanest rule class anyone found, the prescribed act loses ≥ 100
cp on **15.0%** of the items where the rule says to act.

**So every session includes items where the participant's own rule is wrong**, identified by engine
adjudication, and rule-consistent action on those items is reported as **its own series**.

- If the headline series rises and the harm series does not, the intervention taught a
  discrimination.
- **If both rise, the intervention taught compliance, and that is a negative result** — reported as
  the study's finding, not as a caveat under it.

---

## What would say the current design is fine

Declared before the run, and the study reports whichever of these it lands on:

1. **No separation between conditions** on rule-consistent action once base rate is in the model.
   Then response congruency is not the binding constraint, the text step costs nothing, and the
   retrieval design stays as it is.
2. **Separation that does not survive the concurrent controls** — untreated rules move at the same
   time. Then it is practice, and the result is that the design cannot detect what it was built to
   detect.
3. **Separation on the harm series too.** Then the component works and should not ship, which is a
   result about the *product* rather than about the mechanism.
4. **Rule reconstruction improves and rule-consistent action does not.** Then the intervention
   taught the sentence and not the policy — the sharpest possible version of the brief's own worry
   about insights being good evidence and bad learning objects.

**Only outcome 1 is "the current design is fine". It is a real possibility and the study is powered
to see it**, because a within-participant item-rich design estimates a null far better than a
four-arm comparison at n = 8 could estimate anything.

---

## What this study does not measure

| the brief wanted | status |
| --- | --- |
| trigger sensitivity (*d′*) | **blocked** — [L4](FALSIFICATION_REGISTER.md#l4), refuted upstream |
| false application (*c*, false alarms) | **blocked** for the same reason; the harm series is a narrower substitute |
| uncued transfer in representative positions | **blocked** — the instrument is at L2 and the puzzle bank cannot reach L3 |
| ecological transfer in ordinary blitz | **blocked** — L5, four rungs up |
| retention at 1 / 7 / 21 days | **measurable**, and inherits the status of whatever it delays |
| rule reconstruction | **measurable** — the one that survives |

**Five of the six things anyone would want to know are not available**, and the reason is upstream
of this study in every case. Presenting a learning result while four of its six outcomes are
unmeasurable would be the mistake this whole programme exists to avoid.

---

## Sequencing, and what unblocks the rest

```
Study 0   response congruency, single-case, rule-consistent action
             │
             ├─ null        → the retrieval design stays; spend the effort elsewhere
             ├─ harm rises  → stop; L8 is the finding and it is about the product
             └─ separation  → Study 1 becomes buyable, because an effect size now exists
                                 │
                                 └─ Phase 7 (score validation) still gates any claim about
                                    trigger sensitivity, false application, or transfer
```

**Phase 7 is not this study's to complete and not this study's to skip.** The item bank that
`docs/measurement/ITEM_BANK_PROTOCOL.md` specifies — and that nobody has built — is what would let
outcomes 2, 3 and 4 exist at all. Study 0 is designed to be worth running *before* that bank exists,
which is the only reason it can start.

---

## Cost, honestly

| | |
| --- | --- |
| participants | 6–10, each authoring 3–4 rules |
| sessions | enough for staggered introduction; `[READ OFF THE STANDARD]` |
| items per participant per condition | ~150 to separate 0.60 from 0.75 — a floor, since chess items inside one participant are not independent and the design effect is unmeasured |
| items available | 11,752 trigger-positive before narrowing; the corpus is not the constraint |
| build required | a retrieval mode that omits the text step. **No new measurement machinery**, because the outcome is scored from the rule text and the move, both of which the record already holds |
| **not required** | the item bank, the engine adjudication pipeline for scoring, any change to the detector, any change to the reveal |

**The design effect is the number most likely to make this study bigger than planned**, and it
cannot be estimated until a pilot measures the intra-participant correlation across items. That is
the first thing the pilot is for, and it is stated here rather than discovered halfway through.
