# GO / NO-GO

**Decision: NO-GO for production. NO-GO for a human pilot of the construct as stated. GO for one
narrow, specified next step.**

> **Superseded in part, 2026-08-31.** §7's proposed next step was overridden by the owner and
> replaced by a rule-class search, which found one eligible candidate. See
> [`RULE_CLASS_SEARCH.md`](RULE_CLASS_SEARCH.md). The NO-GO decisions below are unchanged; what
> changed is what happens next, and §7 now records the override.

Repository state this decision was taken against: `main` at
`68d61c216c6932455cc61bbe33eb65e7042a6bd7`, `npm run verify` clean (2,646 tests, 20/20 gates,
20/20 positive controls red, bundle within budget). PR #45 open, draft, unmerged. **Nothing was
merged and no production behaviour was changed.**

---

## 1. What exactly can we measure?

> **In a set of chess positions selected by a frozen board predicate, we can measure how often a
> player captures a designated opponent piece when it is undefended versus when it is defended, and
> express that as a hit rate, a false-alarm rate, a sensitivity and a response criterion.**

That is a property of a **task**, computed from a preregistered board label and a recorded move. It
is reproducible, it uses no oracle in its scoring, and its arithmetic is pinned to published
formulae in two languages that are differenced against each other on every build.

---

## 2. What exactly can we NOT claim?

- **That this measures use of an unprotected-piece rule.** On **15.0%** of T+ items Stockfish says
  capturing the target loses ≥100 cp — the prescribed act is a blunder. On **22.8%** of T− items the
  scored false alarm is the engine's own best move. In Lichess puzzle positions the predicate calls
  T+, the curated solution is to capture the loose target only **42.4%** of the time.
- **That a difference between players is a difference in knowledge.** T+ and T− items differ before
  any player is involved: material balance SMD −0.487 (games) and −0.724 (puzzles), attacker count
  +0.475, and T+ puzzles are ~125 rating points *easier* than T− puzzles. Exact matching moved *d′*
  by 0.04 and left imbalances of 0.40.
- **That a rise in *d′* is learning.** The criterion, not the sensitivity, is what orders rating
  bands monotonically here.
- **That a pre/post improvement is caused by an intervention.** Simulation with a zero true effect
  produces **+0.2 *d′*** or more from practice alone.
- **That any of it extrapolates to ordinary play.** Puzzle items are selected by an engine-uniqueness
  rule (best beats second-best by > 0.7 win-chance) with no counterpart in real chess.
- **That the instrument is not itself an intervention.** Untested.
- **And accuracy may never be reported alone.** It would have shown a clean monotone .751 → .820
  across rating bands and concealed every finding above.

---

## 3. Which parts come from already validated methodologies?

**Validated, adopted, called rather than reinvented:**

| component | source | tier |
| --- | --- | --- |
| the validity argument's structure | AERA/APA/NCME *Standards* (2014); Kane; Cook et al. (2015) | A |
| *d′*, *c*, β, *A′*, *B″_D* | Stanislaw & Todorov (1999) | B |
| loglinear correction | Hautus (1995) | C |
| Wilson intervals | Brown, Cai & DasGupta (2001) | C |
| causal design standard | WWC Single-Case Design v5 | A |
| transfer-distance taxonomy | Barnett & Ceci (2002) | A |
| representative design | Dhami, Hertwig & Hoffrage (2004) | A |
| reactivity as a real phenomenon | two meta-analyses (QBE, mere measurement) | A |
| single-case effect sizes | `SingleCaseES`, `scan` | D |
| chess state, engine, puzzle corpus | python-chess, Stockfish 17.1, Lichess DB | D/E |

**Newly created here, and therefore unvalidated:**

| component | what it is | what would validate it |
| --- | --- | --- |
| `predicates.py` v1.0.0 | the trigger definition | agreement with human adjudication — **none exists** |
| `B = capture(designated target)` | the behavioural signature | **measured and found invalid** — §2 |
| the T− / noise-trial definition | which non-triggers count | the thing F2 refuted |
| the N3 narrowing | T− restricted to SEE-negative captures | it changes the construct — see below |
| the six-level L0–L5 ladder | a reporting discipline, not an instrument | nothing to validate; it is a rule about not summing |

**The line between them is the deliverable.** The validated parts are arithmetic and design
standards. Every part that touches *what is being measured* is new, and two of the new parts have
been refuted.

---

## 4. Which new inference still requires validation?

| inference | status | blocked by |
| --- | --- | --- |
| Domain — is this a separable component of skill? | `unresolved` | — |
| **Scoring — does B indicate rule use?** | **`refuted`** | — |
| **Generalisation — do items represent the class?** | **`refuted`** | — |
| Explanation — is it knowledge, not bias or item difficulty? | `unresolved`, leaning refuted | scoring, generalisation |
| Extrapolation — does it say anything about ordinary play? | `unresolved` | the three above |
| Utilization — does it justify a product decision? | `unresolved`, **formally blocked** | all of the above |

Full chain with assumptions and falsifiers:
[`INTERPRETATION_USE_ARGUMENT.md`](INTERPRETATION_USE_ARGUMENT.md).

---

## 5. Did the hanging/unprotected-piece hypothesis survive falsification?

## **NARROWED — and the narrowing renames it.**

The **detector** survived. The frozen predicate fires at 20.4% of classifiable positions in 60,000
unfiltered rated games, is 0.9997-recalled by the Lichess `hangingPiece` label, and shifts by only
0.64% under the main alternative definition of "unprotected". It is a real, robust, reproducible
board property.

The **measurement** did not. `capture(target)` is not a valid behavioural signature: the act is
wrong 15% of the time when the rule says to do it, and right 23% of the time when the rule says not
to.

The one narrowing that repairs the rating gradient — **N3**, requiring T− captures to be material
errors — makes covariate imbalance *worse* (0.487 → 0.705), does not improve solution agreement
(0.424 → 0.395), and puts SEE inside the trigger. What it measures is **discrimination between
materially profitable and unprofitable captures**. That is a real construct with a much better
defined B, and it is not the one in the mission statement. Calling it by the old name would be the
substitution the epistemic rule forbids.

### And the inherited 29/29 was reproduced, and explained

It is **not in this repository at any commit** — `git log --all -S hangingPiece`, `-S "29/29"` and
`git grep -il unprotected` all return nothing — so it was reproduced from its design:

| draw | corpus | 29 items | full pool |
| --- | --- | --- | --- |
| selected by `hangingPiece` | 3,998 items | **29 / 29** | **99.97%** |
| selected only by the frozen predicate | 17,521 items | 19 / 29 | **42.4%** |

**The result was real and the corpus was the cause.**

---

## 6. Is an existing validated paradigm superior to our proposed design?

**Partly, and not in a way that rescues this.** Twelve silos were searched
([`EXISTING_MEASURE_AUDIT.md`](EXISTING_MEASURE_AUDIT.md)). **There is no validated instrument for
rule-specific conditional behavioural discrimination in chess.**

The two nearest paradigms — Sheridan & Reingold's relevance-detection tasks and
conditional-discrimination probes from behaviour analysis — both achieve exchangeability by
**removing chess**: 4×4 boards with three pieces, or stimuli with one relevant dimension. That is
the central tension, and it is not solved by better software.

Three things should simply be used, and none of them touches the construct problem: the SDT
arithmetic, `SingleCaseES`/`scan` for any causal design, and jsPsych if a harness is ever built.
**Mistaking their adoption for progress on validity is the specific error this section exists to
prevent.**

---

## 7. Is the measurement good enough to justify a human pilot?

## **NO — for the construct as stated.**

Two inferences are refuted. Recruiting humans now would spend their time producing a number that
[F3](FALSIFICATION_REGISTER.md#f3) and [F2](FALSIFICATION_REGISTER.md#f2) already show cannot be
interpreted.

**This section proposed an item-bank adjudication study — 200–300 T+ items, two strong-player
adjudicators — and the owner overrode it. The override was correct.** Even 95% agreement between
two grandmasters would only have produced a better detector of *when it is worth taking an
unprotected piece*, which is already a different construct, and the effort would have gone into
rescuing a rule class instead of asking whether a sharper one exists.

**What ran instead: a search for behaviourally identifiable rule classes**, reported in
[`RULE_CLASS_SEARCH.md`](RULE_CLASS_SEARCH.md). Seven rule classes on the same 60,000 unfiltered
games, with the prescribed action graded by an engine that never saw the rule. **One candidate
passed: `RC-06 answer-the-mate-threat`**, at `B_valid | T+` = .968 against `B_valid | T−` = .200 —
72% of the way from this refuted incumbent to the sharpest rule class chess allows. Four of the
five candidates scored *below* the incumbent.

**Still NO for a human pilot.** RC-06's T+ and T− items differ by max |SMD| 0.573, so
[F2](FALSIFICATION_REGISTER.md#f2) applies to it unchanged, and a multiple-baseline design needs at
least three independently measurable rule classes where there is currently one.

---

## 8. Is it good enough to justify integration into production?

## **NO. And this bar is higher than the pilot bar, which it did not clear either.**

Nothing in `client/`, `server/` or `shared/` was changed by this work, and nothing should be. In the
vocabulary of `docs/decisions/README.md` this work sits at **E1–E2**: external implementations exist
and a reference has been reproduced locally. Production-visible requires **E5**, real prospective
validation. **Three evidence levels away.**

---

## The strongest permitted claim

Human-readable:

> Using a board predicate frozen before any label was read, we can identify positions in which an
> opponent piece is capturable and undefended, at a rate of about one in five ordinary game
> positions, and we can record whether the player captured it. We **cannot** currently interpret
> that record as a measurement of whether the player knows or applies a rule about unprotected
> pieces, because on 15% of those positions capturing is a blunder, on 23% of the comparison
> positions capturing is the best move, and the two item sets differ substantially before any
> player is involved.

Machine-readable — `docs/measurement/STRONGEST_PERMITTED_CLAIM.json`.

---

## What happens next, in order

1. ~~Item-bank adjudication study~~ — **overridden by the owner and not run.** See §7.
2. **Search for a rule class with cleaner T and B** — **DONE.**
   [`RULE_CLASS_SEARCH.md`](RULE_CLASS_SEARCH.md): one eligible candidate,
   `RC-06 answer-the-mate-threat`, and a mechanism that says why the capture families failed —
   an offensive rule competes with the whole board, a defensive rule against mate does not,
   because the alternative is losing.
3. **Exchangeability for RC-06.** Max |SMD| 0.573 is now the live blocker, and it is the same
   blocker as [F2](FALSIFICATION_REGISTER.md#f2). Matching, or minimal transformation, measured.
4. **More defensive, severity-protected candidates**, chosen by that mechanism rather than by
   browsing families. Three independently measurable rule classes are the precondition for the
   multiple-baseline design in [`ANALYSIS_PLAN.md`](ANALYSIS_PLAN.md) §2.2.
5. **Simulation of the operating characteristics** of *d′* at realistic per-person trial counts, to
   close the **[NO JUSTIFIED THRESHOLD]** entries simulation can close.
6. **Only then**, a measurement-only reactivity arm ([F7](FALSIFICATION_REGISTER.md#f7)).
7. **Only after all of the above**, a learning study under WWC SCD v5.

**Not on this list, and deliberately:** building a behavioural-transfer feature. The research
artifacts look substantial; that is not a reason, and this document is what stops it from becoming
one.
