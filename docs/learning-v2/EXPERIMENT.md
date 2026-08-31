# The one experiment: does seeing it govern the move?

**Study D — detection → action, on RC-06 items, with order counterbalanced.**

## Why this replaced the experiment this file originally proposed

An earlier draft of this file proposed **Study S** — an item-supply and signature-strength study, to
find out whether any rule class carries an observable signature of rule use. **That study has since
been run**, by the rule-class screen in
[`docs/measurement/RULE_CLASS_SEARCH.md`](../measurement/RULE_CLASS_SEARCH.md), and it returned a
positive: `RC-06 answer-the-mate-threat` is eligible, with `B_valid` **.968** on trigger-positive
items against **.200** on trigger-negative, separation **+0.768** against the refuted incumbent's
+0.600, and the prescribed act is the engine's own best move on **242 of 242** items where the rule
prescribes anything at all.

Proposing it again would be proposing work already done. **The blocker moved**, and this file moves
with it.

## What the screen left open, in its own words

> *"Every one measures whether the player **SAW** it. None measures whether the seeing governed the
> move."*

That is the C8 literature search's verdict on every validated paradigm it found for check, mate and
threat detection (Sheridan & Reingold 2014; Rosch & Vogel 2022; Kuchelmeister et al. 2024 —
`UNVERIFIED` here, cited as the screen reports them). It is also, exactly, the arrow this research
identifies as the place learning dies: **TRIGGER RECOGNITION → ACTION SELECTION**.

**Nobody has measured it. It is now measurable.** That conjunction is what selects this study.

---

## PRIMARY QUESTION

On positions where a mate threat exists (RC-06 T+), does a player's **detection** of the threat
predict **rule-consistent action**, over and above their general playing strength?

## NULL / ALTERNATIVE

- **H₀:** detection and action are independent once strength is controlled — players who see the
  threat are no more likely to answer it than players who do not. The barrier is **action
  selection**.
- **H₁:** detection predicts action. The barrier is **recognition**, and trigger focality is where
  an intervention belongs.

**Both outcomes are informative and they point at different products.** That is the property that
made this study win the comparison.

## UNIT OF ANALYSIS

The **item within participant**. Mixed-effects logistic model of the act, random intercepts for
participant and item, detection as the fixed effect, strength band as a covariate.

## INTERVENTION / CONTROL

**The order manipulation is the experiment**, and it doubles as the reactivity control:

| condition | sequence |
| --- | --- |
| **DETECT-FIRST** | "is there a mate threat here?" → then choose a move |
| **MOVE-FIRST** | choose a move → then "was there a mate threat?" |

Assigned within participant, counterbalanced across items.

## REACTIVITY CONTROL — and this is why the design has two orders

Asking about the threat **before** the move is a cue. It is the intervention and the measurement at
once, which is [F7](../measurement/FALSIFICATION_REGISTER.md#f7) and D21's contamination in its
purest form. So instead of pretending the prompt is neutral, **the difference between orders is the
reactivity estimate**: DETECT-FIRST minus MOVE-FIRST on rule-consistent action is the amount the
question itself moves the behaviour.

**That quantity has never been measured in this repository, and it gates the self-explanation
mechanism entirely** — which is why that mechanism was ranked fourth in
[`INTERVENTION_COMPARISON.md`](INTERVENTION_COMPARISON.md) rather than second.

## BASELINE / BASE-RATE MODEL

- **Chance rate, per item, derived not assumed:** the share of legal moves satisfying B. The screen
  measured mean **.317** on RC-06 T+ — so a rule-consistent act is worth roughly three times chance
  before anything is learned, and the model carries the per-item value.
- **T− cell as the false-application baseline:** `B_valid | T−` = **.200**.
- **The unaided human baseline, which is the one an intervention has to beat.** The screen scored
  the move players ACTUALLY PLAYED against `B` on 2,080 trigger-positive positions: pooled hit rate
  **.716** [.696, .735], running **.63 → .83** across rating bands. Derived in
  [`research/learning/headroom.py`](../../research/learning/headroom.py); see
  [H17](FALSIFICATION_REGISTER.md). **This number was available before this study was designed and
  was not in the design**, which is the kind of omission that produces a ceiling effect and calls
  it a null result.

## OUTCOME

**Rule-consistent action**, hits and false alarms **separately**, with Wilson intervals, and
criterion *c* reported beside any *d′*. **Accuracy alone is never reported**, per
`ANALYSIS_PLAN.md`.

## HARM OUTCOME

Rule-consistent action on items where following the rule **loses ≥100 cp**. The screen measured this
at **2.9%** for RC-06 — against 14–15% for the refuted incumbent — so for this rule class the harm
channel is small but not zero, and it is reported as its own series.

## TRANSFER LEVEL ACTUALLY TESTED

**L3–L4.** The position is presented; no rule is named. This measures the detection→action link in
representative positions, and it is **not** L5 and **not** L6.

## WHAT IS DELIBERATELY NOT CLAIMED

That any of this is uncued transfer. That RC-06 generalises to player-authored rules — it is
expert-screened, and **nine of ten candidate rule classes designed by a researcher failed**. That
the corpus base rate equals the participants' base rate. That detection measured by a forced choice
is the same as detection in a game.

## SAMPLE AND ITEM DESIGN

- **Participants:** 8–30, within-participant throughout. No between-groups comparison is attempted;
  [`INTERVENTION_COMPARISON.md`](INTERVENTION_COMPARISON.md) shows the supply cannot buy one.
- **Recruit at 1200–1600, and report the band.** The miss cell is what this study models, and it is
  **37%** of trigger-positive items at 1200–1400 against **17%** at 1800+. A sample drawn from the
  strong end spends most of its items on the ceiling. This is a constraint the headroom measurement
  imposed on the design after the design existed — stated here rather than folded in silently.
- **Items:** RC-06 T+ and T−, matched on the existing covariate schema. **Residual imbalance must be
  reported, not assumed away:** the screen measured max |SMD| **0.573**, and
  `negative-controls.ts::itemDifficultyConfound` shows an agent with zero discrimination producing a
  large *d′* on unbalanced items. The matched supply and residual SMD are the first numbers out.
- **Base rate constraint, stated because it bounds the design:** RC-06 fires on **1.24%** of
  not-in-check positions. Items must therefore be **constructed from the corpus**, which reopens
  [F9](../measurement/FALSIFICATION_REGISTER.md#f9) — representativeness — and that limitation is
  carried into every conclusion rather than noted once.

## STOP RULE

Item set, model and hypotheses frozen before the first participant. No interim look.

## FALSIFICATION CRITERIA

- **H₀ retained** if detection adds nothing to the model once strength is in it.
- **Reactivity dominant** if the order effect is comparable to or larger than the detection effect —
  in which case *any* prompt-based intervention is measuring itself, and the self-explanation branch
  closes.
- **Confounded** if residual SMD after matching leaves the item-level variance above the
  person-level variance. Then the instrument is discriminating items, not people, and the study
  reports that instead of a result.
- **Criterion-dominant** if the DETECT-FIRST → MOVE-FIRST difference moves hits and false alarms in
  the SAME direction by comparable amounts. That is a bias shift, not a detection effect, and it is
  the failure mode [H19](FALSIFICATION_REGISTER.md) names: the screen's own rating bands move
  **more** by criterion (**+12.3** points of hit rate) than by sensitivity (**+8.1**), so this is
  the expected shape of the data and not a remote possibility. **Reporting the T+ series alone
  would score it as a success.**

## INTERPRETATION

| result | reading | what to build |
| --- | --- | --- |
| detection predicts action | the barrier is **recognition** | trigger focality — intervention **K**, which this research added and which ranked first |
| detection does not predict action | the barrier is **action selection** | if–then compilation and response-congruent rehearsal — **A** and **D** |
| large order effect | the prompt is the intervention | no prompt-based measurement is admissible; D21's exposure problem becomes primary |
| item variance > person variance | the instrument measures items | back to matching, before any human study |
| hits and false alarms move together | the prompt shifts the **criterion** | nothing prompt-shaped — a bias-only gain is a net loss at 34.0% ≥100 cp on T− |

## Cost

8–30 participants, one sitting each, many items. **No product change, no build beyond an item
presenter, no new corpus** — RC-06 items come from the scan already in `research/measurement/`.
