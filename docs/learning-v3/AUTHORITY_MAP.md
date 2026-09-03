# One authority per question

`RNL-05` says one question has one authority. Phase 9 names six questions a learning loop has to
answer and requires that no UI component re-derive any of them. This file answers, for each, **who
decides today** — derived from the tree, not from what the documents say ought to be true — and what
would have to own it if a behavioural packet ever shipped.

**The finding this file exists for is in row 2.** The product does not decide action-set membership
at all. It substitutes engine agreement, and the repository's own knowledge map lists that
substitution as a named failure mode.

---

## 1. The six questions

| # | question | who decides today | is that one authority? |
| --- | --- | --- | --- |
| 1 | **cue membership** — is *this* position an instance of X? | In research: a frozen board predicate, `research/measurement/rule_classes.py`, no engine, `trigger(board, ctx) -> positive \| negative \| None`. **In the product: nobody.** `LearningRuleComposer` takes `trigger` as free text and nothing ever evaluates it against a position | **No — the product half is missing.** A rule's trigger is a sentence the player wrote and the system cannot read |
| 2 | **action-set membership** — is *this move* in B? | In research: `rule_classes.py::satisfies(board, move, ctx)`, a boolean from the board and the move, no engine. **In the product: `accurateDecision(engine_eval_cp, cp_loss)`**, at `shared/record-service.ts:1178` — win-probability loss against the engine | **No, and worse than missing.** See §2 |
| 3 | **evidence authority** — how much does this count? | `shared/evidence-authority.ts`, `AUTHORITY[level]`, five levels, `mayPrescribe` true only at `tested`. `authorityOf()` takes the whole claim rather than its grade | **Yes.** One table, one function, and `tests/shared/one-word-for-how-much-this-counts.test.ts` proves the vocabulary and the grade words cannot come apart |
| 4 | **intervention status** — is this packet active, weakened, retired? | **Nobody.** There is no intervention object. The nearest things are `ClaimGrade` (3 states, system-derived) and `LearningRuleGrade` (4 states, player-authored) | **N/A until a packet exists** |
| 5 | **next action** — what should the player do now? | `shared/next-action.ts::deriveNextAction`, eleven kinds including a first-class `none`. **It decides nothing**: `client/src/lib/next-action-shadow.ts` runs it beside `ResumeScreen` and the screen ignores the answer. Each surface still decides for itself | **Deliberately not yet.** `INERTIAL_UX_LAWS.md` LAW 3: *"derived, and deciding nothing yet"*, with the condition for ownership written down |
| 6 | **hypothesis status** — did the evidence move it? | Two, by design: `shared/claim.ts::evaluateClaim` for system-derived `Claim`, `shared/learning-record.ts::gradeLearningRule` for player-authored `LearningRule`. `shared/record-service.ts::learningRules` re-derives on read rather than trusting the stored projection | **Two authorities for two different objects, which is correct.** See §3 |

---

## 2. The product scores rule use as engine agreement

`finishLearningTransfer`, `shared/record-service.ts:1173-1179`:

```ts
const successes = atoms.filter((atom, index) => {
  const observation = observations[index];
  const recall = scoreRecall(observation.recalled_rule, transfer.rule_snapshot.action_rule);
  return (
    recall.clearedFloor &&
    accurateDecision(atom!.result!.engine_eval_cp, atom!.result!.cp_loss)
  );
}).length;
```

A transfer position "succeeds" when **the recalled text clears a word-overlap floor** and **the move
the player made was close enough to the engine's**. Nothing in that expression asks whether the move
satisfies the rule.

Three consequences, in order of how much they matter:

1. **A player who plays a good move for an unrelated reason scores a success.** The rule they
   rehearsed is credited with a move it did not cause, and `grade: replicated` follows from two such
   sittings on distinct dates.
2. **A player who applies their rule correctly and loses evaluation scores a failure.** RC-06's own
   numbers say this is not hypothetical: on 84.7% of its trigger-positive items, some move that
   answers the mate threat loses ≥100 cp. A rule can be right and expensive.
3. **`applied_rule` — the player's own report that they used the rule — is stored and read by
   nothing that grades.** `docs/VERIFIED_LEARNING.md` says so explicitly, and it is the correct
   decision (`KNOWLEDGE_MAP` §F: judgments of learning are unreliable), but it means the only two
   inputs to a success are a text overlap and an engine.

The repository already named this failure mode, in `KNOWLEDGE_MAP.md` §H:

> | automation bias / overreliance | deferring to the system | engine agreement as the criterion |
> strongest under load | **scoring rule use as engine agreement** | engine agreement indicating rule
> use | inherited (F3) |

The row was written about a risk. It is shipped code.

**Why this belongs in Gate A's file and not in a defect list.** Gate A asks whether the final action
is a valid observation of rule use. The research half of the repository answers that with a board
predicate that could be wrong and can be checked. The product half does not define B at all. So
whatever Gate A concludes about the research instrument, the product instrument is strictly weaker,
and no packet may be graded by it.

---

## 3. Claim and LearningRule may not merge

Phase 5's critical rule: do not merge a system-derived `Claim` with a player-authored `LearningRule`
because the UI wants one card. The repository already keeps them apart, and the separation is not
cosmetic:

| | `Claim` | `LearningRule` |
| --- | --- | --- |
| module | `shared/claim.ts` | `shared/learning-record.ts` |
| authored by | the system, from the record | **the player, in their own words** |
| grades | `hypothesis / replicated / refuted` | `hypothesis / replicated / refuted / retired` |
| graded by | `evaluateClaim(claim, results)` | `gradeLearningRule(rule, results)` |
| the extra state | — | **`retired`, which no fold produces**: it is an act of the player's, and `learningRules()` on read must return it even when the results would grade the rule `replicated` |

`retired` is the reason the two objects cannot become one. A derivation can conclude that a rule
replicated or was refuted. It cannot conclude that a player stopped caring about it. Merging the two
objects would either lose that state or invent a system-derived version of it, and both are the same
mistake: erasing who said what.

`tests/shared/the-queue-that-showed-a-refuted-rule.test.ts` holds this open in both directions — the
record wins over a stale row, and the player wins on `retired`.

**A behavioural packet may reference both. It may not absorb either.**

---

## 4. What a packet would need, and what would own it

Conditional on the gates. Written now so that a later document cannot invent an authority quietly.

| question | what would own it | what that requires first |
| --- | --- | --- |
| cue membership | a **frozen board predicate**, in the `rule_classes.py` shape, evaluated by the system — never the player's sentence | a cue vocabulary that a predicate can express, and a gate that no cue requires engine-only knowledge at decision time |
| action-set membership | the same predicate's `satisfies`, **not** `accurateDecision` | Gate A: that the permitted set is safe enough to teach |
| evidence authority | `evidence-authority.ts`, unchanged and extended to the packet | nothing — it already exists and already refuses |
| intervention status | one new field on the packet, with `weakened` and `retired` reachable **by counter-evidence** | a reversal condition written before the packet ships |
| next action | `deriveNextAction`, after ownership is granted by LAW 3's own condition | shadow rows whose disagreements are not explained by a `blind` input |
| hypothesis status | `evaluateClaim` and `gradeLearningRule`, unchanged | nothing |

**No new authority is proposed for anything that already has one.** Four of the six questions are
answered today by a single named function, and the two that are not — cue membership and action-set
membership — are exactly the two Gate A and Gate B exist to decide.
