# Value Clarity Constitution

The question this document freezes:

> Can a cold chess player understand what Decision Lab does, why it is different, how their
> actions produce that difference, what they received after a Reveal, and why another decision can
> provide additional information?

Five lenses. A lens is finished when every remaining uncertainty under it is **FIELD REQUIRED**,
a **VALUE QUESTION**, a **LATER CAPABILITY**, or **REJECTED** — not when the copy reads well.

---

## The distinction this whole document rests on

**Product clarity** — can the player understand what is being offered?
**Product value** — does the player actually want it?

These are different questions and they have different authorities. Clarity is largely
repo-solvable. Value is not solvable here at all.

**A product that is fully understood and still unwanted is a valid result, and it is the result
this build exists to be able to observe.** Copy may never be tuned to avoid it. Every sentence
below is judged by whether a player can reconstruct what is true, never by whether they continue.

---

## Lens 1 — Problem Legibility

| | |
| --- | --- |
| **User question** | What problem in my chess is this for? |
| **Current answer** | The front door leads with the problem an engine cannot solve — it can say which move was better, it cannot say what happened on the way to choosing. The construct comes after, and only as a consequence. |
| **Failure condition** | The first viewport leads with a research construct ("calibration", "you did not know that you did not know") before naming a chess problem; or names no problem at all and only describes a mechanism. |
| **Allowed intervention** | Reorder and rewrite the first viewport. Name the problem in board terms. Keep the construct, later and subordinate. |
| **Forbidden** | Promising a finding. Claiming knowledge of what the player thought. Superlatives. A walkthrough. Teaching vocabulary before naming a problem. |
| **Repo-solvable evidence** | The problem sentence precedes the construct in DOM order; no mind-reading verbs; first viewport at 390×844 contains problem + mechanism + action. |
| **Field-required evidence** | Whether a player, shown only the front door, describes the problem as being about their decision rather than "analyse my game". |
| **Pass criterion** | Repo: the ordering and vocabulary tests pass. Field: Arm A ≥ 8/10 coded `decision_process`. |

---

## Lens 2 — Differentiated Promise

| | |
| --- | --- |
| **User question** | Why is this not Stockfish, Game Review, or another accuracy report? |
| **Current answer** | Because the decision is recorded **before** the engine speaks. A retrospective analysis has the moves and the evaluation; it does not have what you could read, what you could not, how sure you were, or which moves you actually put on the board. |
| **Failure condition** | The differentiation is asserted ("no other tool does this") without naming the mechanism that makes it true; or the mechanism is named as a research property rather than as an information difference. |
| **Allowed intervention** | State the information difference in one sentence, on the front door, on the share card, and in the acquisition contracts. |
| **Forbidden** | Guaranteeing any Reveal branch. "We know why you rejected it." Claiming a stronger engine, a better dashboard, or personalisation as the difference — none of those is the difference. |
| **Repo-solvable evidence** | A semantic-continuity test across share metadata → front door → first-decision explanation. Promise contracts per acquisition angle, each with a prohibited row. |
| **Field-required evidence** | Whether a player reconstructs "it records something before the engine" unprompted. |
| **Pass criterion** | Repo: continuity test passes; no surface promises a branch. Field: Arm A ≥ 8/10 coded `pre_engine_evidence`. |

---

## Lens 3 — Action → Payoff Causality

| | |
| --- | --- |
| **User question** | Why do I have to commit before the engine says anything? |
| **Current answer** | Because once the engine has spoken, there is no way to tell what was yours from what came from it. The commitment is what creates the record; it is not a rule for its own sake. |
| **Failure condition** | The product states the rule ("the engine will not speak first") without the reason, so the ordering reads as ceremony. |
| **Allowed intervention** | One sentence of reason, pre-commit, on the commitment screen. Acknowledgement only — never evaluation. |
| **Forbidden** | Any implication that the product knows what was considered mentally. The record holds **moves placed on the board**; absence from that list means the move was not placed, never that it was not seen. |
| **Repo-solvable evidence** | Tests forbidding "ראית / חשבת / ידעת / שקלת" in the causal explanation; the candidate-list asymmetry stated where candidates are shown. |
| **Field-required evidence** | Whether a player can say why the engine waits. |
| **Pass criterion** | Repo: mind-reading vocabulary tests pass and the reason is present. Field: Arm A/B ≥ 9/10. |

---

## Lens 4 — Reveal Salience and Boundary

| | |
| --- | --- |
| **User question** | What did I actually get here — and is it something an engine could not have told me? |
| **Current answer** | The Reveal names which of two things happened: the record contained evidence about the choice that a PGN and an engine could not reconstruct, or it did not and what is shown is the ordinary comparison. Silence remains a third, valid state. |
| **Failure condition** | A generic engine observation is presented in the same frame as a process observation, so the player cannot tell which one they received — and the trial cannot tell either. |
| **Allowed intervention** | Label the block by which evidence it rests on, derived from the branch the product already computed. Weight the finding above the engine's number. Named `ONE_THING_EVIDENCE`, not `ONE_THING_BASIS`: `OneThing.basis` already exists and means the human-readable measurement detail, and two fields called basis is the referent confusion this repo keeps paying for. |
| **Forbidden** | A second classifier. A stored subjective field (`unique_value_delivered`). Calling the generic case a failure, a miss, or apologising for it. Strengthening any branch's language to make it sound more unique. |
| **Repo-solvable evidence** | `ONE_THING_EVIDENCE` labels each branch, and an **ablation** test proves the labelling from the firing conditions rather than restating it: strip `candidatesConsidered` and `confidence` and every `process` branch must stop firing while every `engine` branch is unchanged. Silence renders no label and keeps "זו תוצאה תקינה, לא מסך ריק". |
| **Field-required evidence** | Whether a player who received a process Reveal reconstructs the distinction unprompted. |
| **Pass criterion** | Repo: basis tests pass, no second classifier exists. Field: Arm B ≥ 8/10 among those exposed to a process branch. |

---

## Lens 5 — Continuation Economics

| | |
| --- | --- |
| **User question** | What can a second decision tell me that the first cannot? |
| **Current answer** | One decision says what happened once. Another independent decision is what makes it possible to ask whether the same thing happens again. |
| **Failure condition** | The only stated reason to continue is a measurement floor ("another N measured decisions"), which explains what a *claim* requires and not what the *player* gets; or the reason becomes a streak, a countdown, or an unlock. |
| **Allowed intervention** | One stable, non-adaptive proposition after the Reveal, plus a CTA that names the experiment rather than the navigation. |
| **Forbidden** | Numbers as motivation. Progress bars. "X left". Reward language. Any promise that a pattern *will* appear. Any variation by Reveal kind, acquisition angle, or prior behaviour. |
| **Repo-solvable evidence** | Tests: identical string across all five Reveal outcomes; no digits; no unlock/streak vocabulary; post-commit only. |
| **Field-required evidence** | Whether a player explains the second decision as another independent observation. |
| **Pass criterion** | Repo: invariance and vocabulary tests pass. Field: Arm A/B/C ≥ 8/10 coded `repetition_evidence`. |

---

## The measurement floor is not the continuation reason

Two different things, kept apart on purpose:

- **Measurement requirement** — how much evidence a claim needs before the detector may speak.
  The record layer states this correctly and keeps its denominators. It is not motivational UI and
  must not become one.
- **Marginal user value** — what one more decision adds *before* any claim exists: a second
  independent observation, which is the only thing that can turn "this happened" into "this
  happens".

The first belongs to the record. The second belongs to the Reveal. Neither may borrow the other's
sentence.

---

## Standing constraints this document does not relax

- Acquisition evidence may measure the product; it may never alter the chess decision experience.
  No branching on angle, prior continuation, prior answers, Reveal kind, click behaviour, or an
  inferred user type.
- Pre-commit feedback may acknowledge input and may never evaluate it.
- The value-reconstruction question stays where it is, after the second Reveal, so that
  continuation after the first is measured without it.
- No position is chosen by looking at what the engine will later say about it.
