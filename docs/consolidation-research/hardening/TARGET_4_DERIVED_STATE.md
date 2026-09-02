# TARGET 4 — derived-state read paths

| | before | after |
| --- | ---: | ---: |
| read sites consuming an unverified projection | **4** | **0** |
| places the fix had to be applied | — | **1** (a service boundary, not a component) |
| disagreement fixture | none | `tests/shared/the-queue-that-showed-a-refuted-rule.test.ts`, 3 cases |

---

## 1. The audit, one row per question the mission asks

| | answer |
| --- | --- |
| **What is stored?** | `grade`, `retrieval_step`, `next_due_at`, `last_evaluated_at` on `learning_rules` |
| **What can be derived?** | all four, by `gradeLearningRule(rule, results)` in `shared/learning-record.ts` — a pure fold that *"starts from what `formLearningRule` wrote and never from what a previous grading left behind"* |
| **What is the write authority?** | `gradeFromRecord` in `shared/record-service.ts`: re-reads the results, folds, and writes back **only when the fold differs**. All three stores refuse to move a rule off `retired` |
| **What was the read authority?** | the stored columns, read raw by `learningRules()` and rendered by four sites in `LearningQueue.tsx` |
| **Can they disagree?** | **Yes.** `gradeFromRecord` runs only when a transfer touches the rule, and the learning queue is precisely the surface that lists the rules nobody is drilling |
| **What prevented stale state?** | on the read path, nothing |

## 2. What the four fields actually are

Not "cached derived state", not "independent state", and not "stale duplication" as a category
error. They are a **materialized projection with an opportunistic repair**, and the repair is
triggered by an event the stale rows do not receive.

`sameLearningRule` names the projection exactly — those four fields and no others — which is what
made the classification decidable rather than a judgement.

**One field is not projected.** `gradeLearningRule` returns a `retired` rule unchanged. Retirement is
an act of the player's and no fold produces it, which is why the stored column still exists and why
all three stores guard it.

## 3. The choice, and why it was A

| option | verdict |
| --- | --- |
| **A. derive on read** | **taken.** The fold is pure and cheap, and the read authority is a *service boundary*, so one change fixes all four sites and any surface added later |
| B. verify the projection on write and read | rejected: it keeps two authorities and adds a third thing that can be wrong, namely the comparison |
| C. declare the projection authoritative | rejected: it contradicts `gradeFromRecord`'s own docblock, which says the grade *is* a function of the record. Two silent authorities would become one wrong one |

**No write-back on read.** A read that repairs is a read that can fail, and this one renders a list.
The projection stays stale in storage until the next transfer runs `gradeFromRecord`; nothing
downstream can see the difference, because nothing downstream reads the columns any more.

**This is not "derive everything".** The mission's own warning, and the `retired` exemption is where
it bites. A read path that derived everything would hand a retired rule back as `replicated` and put
it in front of the player again, which is the write-side defect Cycle 39 closed, reintroduced from
the other end.

## 4. Fixed in one place, not four

The four sites were `LearningQueue.tsx` lines 15, 42, 111 and 120 — the retired filter, the
due-ness computation, the grade badge, and the button hidden on `refuted`.

**None of them changed.** `learningRules()` in `shared/record-service.ts` is the single read
authority: the same function feeds the local store path and the tRPC route, so both get the same
answer, and a fifth surface added tomorrow gets it without knowing to ask.

## 5. The fixture holds the disagreement open

A test that stores `refuted` and reads `refuted` passes whether the read derives or not, and would
have passed for the whole time the defect existed. So the fixture writes a stored grade **the
results contradict**:

| case | asserts |
| --- | --- |
| the row says `hypothesis`, two sittings refute it | the queue shows `refuted` — **the record wins** |
| the row says `retired`, the results would grade it `replicated` | the queue shows `retired` — **the player wins**, the control for the opposite error |
| the row is already correct | the derived values **equal** the stored ones, so this is a repair and not a semantic change |

Verified by running the fixture against the pre-change read path:

```
with the OLD read path:   1 failed | 2 passed
with the new read path:   3 passed
```

The first case fails without the change and passes with it. The other two pass either way **on
purpose**: they guard the two ways this repair could have gone wrong.

## 6. Cost, stated

One result query per rule. The alternative is a batched read the `RecordStore` interface does not
have, and for a queue holding one player's rules the N+1 is smaller than the machinery to avoid it.
If that stops being true the fix is a batch method on the store, not a return to reading a
projection nothing repairs.

## 7. Full suite after the change

```
Test Files  263 passed | 3 skipped (266)
Tests       2931 passed | 33 skipped (2964)
```

## 8. What this does not establish

- **That no other stale-read path exists.** `DERIVATION_AUDIT.md` lists five `DECLARED_UNVERIFIED`
  items and four of them are *a number a person must supply*, which no derivation produces. This
  target closed the one where an authoritative derivation existed and was being ignored.
- **That the stored columns are now correct.** They are still repaired opportunistically. What
  changed is that nothing reads them, so their staleness stopped being visible to a player.
- **That the queue is right.** It establishes that the queue and the record now give the same
  answer, and that a disagreement resolves to the record.
