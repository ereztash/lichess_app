# D24 — can the Insight → Action → Uncued Transfer layer be evaluated at all?

**Verdict: `NARROW`.** The learning target survives as a research programme, but the human study is
now explicitly blocked behind two pre-human validity gates.

> **This decision has changed twice because the evidence changed.** It first reached
> `MEASUREMENT-BLOCKED`. The rule-class search then found one class with an observable action
> signature (`RC-06`) and moved the verdict to `NARROW`. PR #50 subsequently expanded the search to
> **15 rule classes across 8 families and 3 selection strategies**, retracted the round-2
> `noise-cell decides` story, and left RC-06 as the only eligible class. This file is reconciled to
> that later evidence rather than preserving the story that produced the earlier draft.

**Evidence level:** E0 for a learning layer — nothing built and no person measured by this work. E1
for candidate mechanisms with verified external literature. E1–E2 for the domain/measurement work
that produced RC-06.

**Supersedes:** [D23](D23-insight-to-action.md)'s choice of first experiment, and corrects two factual
errors in D23.

**Depends on:** [`docs/learning-v2/`](../learning-v2/), all of [`docs/measurement/`](../measurement/),
`shared/learning-record.ts`, `shared/recall-score.ts`, `shared/record-service.ts`,
`shared/evidence-authority.ts`, `client/src/components/FindingCard.tsx`, and `LearningRuleComposer`.

---

## CLAIM UNDER EXAMINATION

> After receiving valid evidence and an intervention, when a new situation occurs in which the
> learned trigger is genuinely present, the player independently recognises its relevance and changes
> their decision process/action in the direction of the learned policy, without a rule-specific cue
> from the system. When the trigger is absent, the behaviour does not appear merely because the
> player was trained to perform it.

Both halves are required. The trigger-negative half is part of the construct, not a safety footnote.

---

## WHERE THE CURRENT PRODUCT MEASURES

| measurement in the repo | highest level it can support |
| --- | --- |
| `scoreRecall` lexical floor | **L0** — its own docblock says it is not a memory measure; no reliability coefficient exists |
| `accurateDecision` on a transfer position | **L4 at most**, and only if the act is rule-specific |
| transfer `successes` = recall floor AND accuracy | **L0 ∧ L4**; no validation supports interpreting the conjunction as learning |
| `grade: replicated` | a repeated pass rule with no empirically estimated learner null |
| drill | **L4** — the rule under test is explicitly cued |
| ordinary Blitz | no learning inference; there is no uncued-transfer hook |

**Nothing in the repository measures L5–L6, which is the target.**

---

## TWO CORRECTIONS TO D23

1. **`replicated` is not reached 47–81% of the time from the same base-rate assumptions.** That was
   the one-sitting probability. The grade requires two separate passing days, so the corresponding
   null is `P(pass)^2`, approximately **9–65%** over that range.
2. **The recall scorer is materially better than D23 described:** stop-list, Hebrew normalisation, a
   two-word absolute floor, `isScoreable`, symmetric refutation, and an adversarial rate the repo
   reduced from 6/8 to 2/8.

The correction narrows the criticism but does not remove it: the shipped measures still do not reach
uncued conditional transfer.

---

## WHAT THE RULE-CLASS PROGRAMME ESTABLISHES NOW

Under the **current binary action signature** (`engine best move satisfies B`), `RC-06
answer-the-mate-threat` remains the only eligible class after fifteen candidates:

- `B_valid | T+ = .968`
- `B_valid | T− = .200`
- separation `+.768`
- where the rule prescribes at least one move, the engine's best satisfies it on 242/242 items
- following the rule loses ≥100 cp on 2.9% of T+ items
- base rate ≈1.24% of not-in-check positions

The player data also leave headroom: pooled trigger-positive rule-consistent action is **.716**
[.696, .735], from .63 at 1200–1400 to .83 at 1800+.

### What PR #50 removes

The programme no longer supports a general mechanism such as:

- `severity predicts a usable rule class`, or
- `the noise cell decides`, or
- `narrow prescriptions predict separation`.

Five candidates deliberately selected from the round-2 noise-cell story were enough to reverse the
correlation pattern that motivated that story. **No design rule extracted so far predicts which
rule class will be usable.** RC-06 is an observed survivor, not an explained family.

This matters because the final line of the old D24 described the surviving construct as a
"severity-protected defensive rule class". That wording is now too strong and is withdrawn here.

### What remains unresolved even for RC-06

1. **Action-model validity.** `B_valid` is binary: whether the single engine-best move is inside B.
   Round 3 provides a direct warning that true chess knowledge need not imply one unique best action:
   `RC-21 push-the-unstoppable-passer` is based on exactly defined chess knowledge, while the named
   act is the engine's best on only 16.4% of T+ items.
2. **Exchangeability.** RC-06 T+ and T− differ by max |SMD| **0.573**. A player effect can still be an
   item effect.
3. **Cueing.** Every validated chess paradigm found in the literature measures seeing/detection; none
   establishes that seeing governed the move without the measurement cue becoming part of the task.
4. **Product-content mismatch.** RC-06 is researcher-screened; the product rehearses player-authored
   free text. Fourteen of fifteen researcher-designed candidates failed the current screen.

---

## THE ARCHITECTURE FINDING THAT STILL HOLDS

`mayPrescribe` is true for the `tested` authority level and is enforced in `FindingCard`, but the
rehearsal path does not use that authority gate. `formLearningRule` files a player-authored rule as a
hypothesis and schedules retrieval before the content has earned prescriptive authority.

So the sequencing constraint survives every measurement revision:

> **Do not deliberately strengthen a rule before the content is safe enough to strengthen.**

A teaching layer is an amplifier. Its first responsibility is not to amplify an unvalidated sign.

---

## SEQUENCING

The three high-level product sequences remain:

| sequence | verdict |
| --- | --- |
| insight → teach → test | **rejected** — rehearsal precedes content validity |
| insight → behavioural test → teach | **insufficient/circular** when the behavioural signature itself is unresolved |
| insight → content-validity gate → teach → behavioural validation → ecological validation | **preferred target architecture** |

But the measurement work adds two gates **before any human teaching study**.

### Gate A — action-set validity

Re-score the already-screened rule classes using the value of the **set of rule-consistent actions**,
not only whether the single best engine move satisfies B. Define and inspect:

```text
V_B(s)    = best utility among legal B-actions
V_notB(s) = best utility among legal non-B actions
A_B(s)    = V_B(s) - V_notB(s)
R_B(s)    = V*(s) - V_B(s)
```

Use WDL / expected score as the primary utility representation and centipawns as a secondary
engineering diagnostic. Also measure the regret distribution inside B; one excellent B-action does
not make an unsafe action set teachable.

### Gate B — exchangeability / minimal functional twins

After Gate A, attack RC-06 with matched natural items and then Sheridan/Reingold-style minimal
functional pairs in which a small chess-valid transformation flips T while preserving as much of the
decision problem as possible. The action-set contrast must move in the predicted direction on the
pair.

Full specification: [`PRE_HUMAN_GATES.md`](../learning-v2/PRE_HUMAN_GATES.md).

---

## NEXT STEP

**The next overall work is not Study D and not candidate 16.** It is the two pre-human gates above.

If both survive, [`docs/learning-v2/EXPERIMENT.md`](../learning-v2/EXPERIMENT.md) becomes the **next
human study**: does detection of the mate threat predict rule-consistent action once strength is
controlled, and how much does asking about the threat itself change the action?

Study D remains useful because its outcomes branch cleanly:

- detection predicts action → recognition/focality becomes the first learner barrier to target;
- detection does not predict action → action selection / if–then compilation becomes the candidate;
- large order effect → the prompt is an intervention, so prompt-based measurement is inadmissible as
  a neutral baseline;
- hits and false alarms rise together → criterion shift, not discrimination learning.

But **no participant should be recruited until Gate A and Gate B pass**.

---

## STRONGEST PERMITTED CLAIM

> **Permitted:** Decision Lab can state what the current record justifies believing, elicit a
> player-authored if–then rule with exception/falsifier fields, withhold it and later ask for it back,
> and score lexical overlap plus move accuracy under the existing protocol.
>
> **Permitted, narrowly:** under the current binary action screen, `RC-06` is the only one of fifteen
> candidate rule classes whose trigger/action relation beats the refuted incumbent and whose
> trigger-negative cell can be measured. This establishes a promising **cued conditional
> discrimination candidate**, not uncued transfer.
>
> **Not permitted:** that the binary best-move signature is the final domain-valid representation of
> rule use; that T+ and T− are exchangeable; that RC-06 generalises to player-authored rules; that a
> rule was recognised unprompted; or that any measured change transfers to ordinary Blitz.

---

## SOURCE STANDARD

The learning-v2 evidence ledger uses the declared source hierarchy. Load-bearing academic claims are
verified against publisher/DOI/official records where available; unverifiable inherited references
are marked as such. No external effect size is transplanted into chess as a product coefficient, and
user feedback is used for hypothesis generation rather than effectiveness claims.

---

## REVERSAL CONDITIONS

1. **Gate A changes the eligible set.** Then the binary `best move ∈ B` screen was a construct
   bottleneck and the rule-class ontology must be updated before Study D.
2. **Gate A removes RC-06.** Then Study D is cancelled; the apparent signature was an artefact of the
   binary action model.
3. **Gate B cannot produce an exchangeable/minimal-pair contrast.** Then final move is not an
   admissible observation of rule use under this paradigm; move to process evidence.
4. **Study D, once admissible, finds detection predicts action.** Then recognition/focality becomes
   the first intervention target.
5. **Study D finds detection does not predict action.** Then action selection / if–then compilation
   becomes the first intervention target.
6. **Study D finds a large order or criterion effect.** Then prompt-shaped measurement is itself an
   intervention and must not be used as a neutral baseline.
7. **A player-authored rule passes the same content/action-set safety gates.** Then the claim can
   widen toward the product's actual content.

---

# `NARROW`

The target survives as a defensible research programme, not as a validated product claim.

**It currently survives as:** one expert-screened candidate (`RC-06`) with a promising cued
conditional action signature under the current binary screen.

**It does not yet survive as:** delayed, unprompted, context-appropriate transfer of a
player-authored rule.

**Do not build the learning layer yet. Do not recruit for Study D yet. Do not search for candidate
16 yet.** First test whether the action model itself survives a set-valued decision analysis, then
whether the surviving contrast survives exchangeability/minimal-pair construction. Only after both
pass does the human detection → action study become the highest-value next uncertainty.
