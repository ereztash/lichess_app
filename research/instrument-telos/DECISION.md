# Decision

## Verdict

**`PARTIAL_ROOT_CAUSE`**, scoped. The Calibration Loop's own term is `SCOPE_LIMITED_PARTIAL` and it
is the more precise one: this is a bounded region claim, not a weaker version of the whole claim.

| Region | Verdict |
|---|---|
| Per-decision loop | **Refuted.** The core loop repays every decision, immediately and differentiably, and is about four fifths of the taps |
| Record page, two denominators | **Category error.** Rendering them costs the player nothing, so it is outside the unit this hypothesis is about. It is a trust and ontology defect and belongs to H5 |
| Counterfactual probe, immediate step | **Salience, not beneficiary.** The payoff exists two taps away, behind a disclosure |
| Blitz, all-or-nothing write | **Survives.** A cost that returns nothing if the player stops, with no statement that this is possible |
| Accumulation to 60 | **Survives, and is indistinguishable from H3 and H4 on repository evidence** |
| Flag boundary | **Survives, and is H4 by construction** |

## Why it is not stronger

Six independent counterexamples, in `FALSIFICATION_REPORT.md`. The two that matter most: the
repository already ran this mission's delete test on the read fields and cut them from required to
sampled with the reason recorded, and `nextQuestion` consumes `unknown` on the next screen. The
case the hypothesis most strongly predicts should read as aversive goes the other way.

## Why it is not rejected

Two uncovered costs on independent surfaces share one structure: **the payoff exists and is not
where the cost is paid.** The counterfactual's scored alternative sits behind a disclosure; the
blitz game's reading sits behind finishing, and nothing says an abandoned game stores nothing. That
is a mechanism, and it appears twice.

And one unstated exchange rate governs the longest interval in the product. Derived from the
shipped rules rather than guessed:

```text
decision 1 of a game is `first`: confidence always asked, and refused by discovery
every later decision draws at ASK_RATE = 0.15
60 counted decisions  =>  60 / 0.15 + 1  =  401 decisions
```

Both walks land in the body of that distribution, `P(>= 1)` of 0.556 and 0.386. `1 of 6` is the
designed rate. The product states the floor twice in plain words, states that even at 60 the result
would be a hypothesis, and never states that 59 more counted decisions is roughly 390 more
decisions.

## The product principle, conditional and not a gate

H1 survives in a bounded region, so the principle is stated for that region only:

> **Where a user cost's payoff exists but is not delivered at the point of payment, the product must
> either move the payoff to the point of payment or state the exchange rate.**

This is narrower than the principle the mission proposed, deliberately. "No meaningful user effort
should exist solely to improve system knowledge" would classify the confidence draw as a defect,
and the confidence draw is the one cost in this product that is irreplaceable, honestly
parameterised, and already the subject of a recorded delete test.

### How the principle would have to be tested before becoming a gate

It is not a gate and must not become one until it discriminates a real defect with a positive
control. The control it would need:

* **Positive control, must go red:** a costly action whose only payoff is gated behind a disclosure,
  a threshold or a completion, with no exchange rate stated. The counterfactual probe and the blitz
  write are the two live instances, so the control can be built from the product as it stands.
* **Negative control, must stay green:** the confidence draw. Its payoff is genuinely at n, the
  product says so, and a rule that reddens it is a rule that has confused necessary scientific
  burden with tax. **A principle that cannot keep the confidence draw green is the wrong
  principle**, and that is the specific way this one could fail.

Until both controls behave, this is a finding and not an invariant.

## Limitations that travel with this decision

* **All nine `context_refs` failed delivery to the Calibration Loop.** It read the signals prose,
  not the artefacts. Its disposition is an independent reading of the same evidence rather than a
  review of this audit's reasoning, which is in some ways better and must not be reported as
  agreement.
* **NETA ran on the same model lineage as RND.** Agreement between them is role-conditioned
  execution, not triangulation.
* **Both walks were performed by someone who knows the refusal and sampling rules.** The tap counts
  transfer. The felt meaning of `1 מתוך 60`, of the disclosure and of per-decision repayment does
  not, and these walks may not stand in for stranger behaviour.
* **Zero humans have used this build.** Every claim about comprehension, felt repayment and pull is
  FIELD-owned.

## What was implemented

One correctness defect, decidable from REPO authority. `shared/confidence-asked.ts` stated that
*"nothing downstream reads either one"* of the read fields. That is false of `unknown`:
`shared/reveal.ts` `nextQuestion` reads it on the next screen and `Home.tsx` feeds it there. The
measurement claim in the same sentence is true and is kept; the verb is corrected and the
distinction is written out, because this audit believed the comment and initially classified the
reads as uncompensated burden on the strength of it.

Nothing else. No orchestration surface, no merged denominator, no onboarding, no flag, no
threshold, no sampling rate, no progress bar, no rating, no coaching claim. The FIELD stimulus is
untouched.

## Smallest next intervention

**State the exchange rate where the shortfall is rendered.**

One sentence, on the surface that already says `חסרות עוד 59`, converting counted decisions into
decisions at the product's own `ASK_RATE`. It is the smallest change that addresses the longest
interval in the product, it is decidable from the repository, it requires no new surface and no
architectural decision, and it is the intervention the Calibration Loop's own analysis pointed at
when it concluded that the discovery-counter complaint is an unstated exchange rate rather than a
beneficiary mismatch.

It is **not implemented here**, because the mission forbids a wording pass and because the frozen
FIELD stimulus must not move. It is the candidate to run after FIELD, and FIELD may kill it: if
participants fail M6 while correctly naming the payoff, the problem is the distance and not the
disclosure of the distance, and a more honest number will not help.
