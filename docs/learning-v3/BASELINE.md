# Baseline — the repository as it actually is, 2026-09-02

**Rule this file was written under:** *do not rely on historical descriptions if the current tree
disagrees.* Where a description in the mission that commissioned this work, or in an existing
document, disagrees with the tree, the tree wins and the disagreement is recorded in §8 rather than
quietly resolved.

**Written after** `FROZEN_EXTERNAL_SYNTHESIS.md` and `FALSIFICATION_REGISTER.md` were committed
(`73f4d8e`), and before the Phase 1 crosswalk. That order is the point, and
`scripts/learning-v3/verify_freeze.py` plus `GATE-RESEARCH-RECONCILED` check it.

---

## 1. Repository truth

| what | value |
| --- | --- |
| `origin/main` | `c848f244d380e13a8622c590791b22a2bef7a39b` |
| working branch | `claude/repo-native-os-extraction-o1psvb`, restarted from that SHA |
| open PRs | **none** |
| CI on `main` | `Verify` #391 on `c848f244` **success**; `Deployed` #6 on `c848f244` **success** |
| L6 standing state | green on production. `https://lichessapp.vercel.app/build-identity.json` serves `c848f244…`, `target: production`, `protocolVersion 1.0.0`; the positive control goes red first, then 7/7 assertions |
| gates, local | **31 pass, 0 fail, 0 not-measured** |
| tests, local | **2,931 passed, 33 skipped, 2,964 total** across 266 files; `npm run check` clean. The skips are the three suites that refuse rather than pretend: `tests/deployment/` without `DEPLOYED_ORIGIN` (7), `drizzle-store` and the one-write suite without `DATABASE_URL` (23), and 3 health-check cases. **Reported as skipped, not as passes** |
| levels scan | 19 rows, 0 claiming more than their gate ran against |
| experiment branches | `experiment/n-of-1-timing-policy` at `d1cdc02215ba6c56eb70b81fe4c907fe962793cf` — **untouched, not rebased, not merged.** Its preregistration is frozen and nothing in this cycle reads or writes it |
| other remote branches | 14 `claude/*` and 3 feature/experiment branches, all merged or abandoned; none is a base for this work |

### Repository-native OS / hardening state carried in

The two prior cycles left standing results that this one is bound by rather than free to revisit:

* `docs/consolidation-research/REPO_NATIVE_OPERATING_SYSTEM.md` — verdict `PARTIAL_REPO_NATIVE_OS`,
  methodological score **90.73/100**, WES **96.74**. Below the 95 bar, and recorded as below it.
* `docs/consolidation-research/hardening/FINAL_REPORT.md` — `COHERENCE HARDENING IMPROVED BUT BELOW
  BAR`; `STRUCTURAL CONSOLIDATION LICENSED — scoped`.
* The laws this cycle is most exposed to: `RNL-01` (derive, don't declare), `RNL-05` (one authority
  per question), `RNL-10` (failed history is provenance), `RNL-11` (do not change intervention and
  instrument together), `RNL-18` (refuse rather than skip).

---

## 2. Current product flow

Four routes, `client/src/App.tsx:49-57`:

```text
/        Record.tsx   the record: claims, drills, evidence
/play    Home.tsx     the decision loop
/blitz   Blitz.tsx    blitz + post-game
/404     NotFound
```

The measured loop, as `Home.tsx` runs it:

```text
position
↓
DecisionAtom committed BEFORE engine output   (entry state, stated read, confidence, bounded action,
↓                                              every move physically placed, randomised alt-move probe)
reveal                                        (engine answers; `makingEvidence` boundary ends here)
↓
ReflectionDelta                               (revised read, would-choose-again)
↓
[flagged] LearningRuleComposer                (player authors WHEN/mechanism/missed signal/action/
↓                                              exception/prediction/refutation condition)
[flagged] retrieval at 1, 3, 7, 21 days
↓
[flagged] LearningTransferRunner              (3 unseen positions, rule snapshot preregistered)
↓
ordinary future game                          ← NO rule-specific ecological hook
```

---

## 3. Active feature flags

| flag | default | where | what it gates |
| --- | --- | --- | --- |
| `VITE_EXPERIMENTAL_LEARNING_ENABLED` | **off** (`=== "true"`, so absent means off) | `client/src/lib/features.ts:30` | `LearningRuleComposer` in `Home.tsx:2078`, `LearningQueue` in `RecordExplorer.tsx:157` |
| `LAYER_C_ENABLED` | off | `server/layerC.ts:24` | the Layer C route; returns `{ kind: "disabled" }` unset |
| `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID` | unset | client | auth portal |

**The single most important fact in this section.** `VITE_EXPERIMENTAL_LEARNING_ENABLED` is set
**nowhere in the tree** — not in `vercel.json`, not in any workflow, not in any `.env`. The flag
was deliberately flipped from on-unless-off to off-unless-on when `D25` graded the surface
`CONSTRUCT-UNDERIDENTIFIED`. So:

> **The learning loop ships to nobody. Player-authored rules, the retrieval schedule and the
> transfer runner are code that exists, is tested, and does not run for any user.**

That is not a defect to fix in passing. It is the correct current state given `D25`, and it means
this cycle is designing against **zero installed behaviour** — there is no "current learning
experience" to improve, only one to justify before it is switched on.

---

## 4. Current learning surfaces

| surface | file | reachable today? |
| --- | --- | --- |
| `LearningRuleComposer` | `client/src/components/LearningRuleComposer.tsx` | no — flagged off |
| `LearningQueue` | `client/src/components/LearningQueue.tsx` | no — flagged off |
| `LearningTransferRunner` | `client/src/components/LearningTransferRunner.tsx` | reachable only from a transfer the queue starts, so effectively no |
| `FindingCard` | `client/src/components/FindingCard.tsx` | **yes** — `PostGame`, `WhatIsUnclear`, `ResumeScreen` |
| `ClaimPanel` / `ClaimCard` | `client/src/components/ClaimPanel.tsx` | **yes** — `Record`, `Home`, `OutcomeSummary`, `RecordExplorer` |
| `PostGame` | `client/src/components/PostGame.tsx` | **yes** — `Blitz.tsx` and the blitz analysis runner |
| `RevealPanel` | `client/src/components/RevealPanel.tsx` | **yes** |

So the surfaces a player can actually reach today are the **system-derived** ones — claim, finding,
reveal, post-game. Every **player-authored** one is dark. That asymmetry is load-bearing for the
Phase 5 authority rule (*do not merge system-derived `Claim` with player-authored `LearningRule`*):
today the product is entirely the first kind.

---

## 5. Existing measurement objects

| object | module | what it is |
| --- | --- | --- |
| `DecisionAtom` | `shared/decision-atom.ts` (26 kB) | the unit of evidence: entry state, stated parts, bounded action, result, probe, feedback. Committed before reveal |
| `Claim` | `shared/claim.ts` | **system-derived** hypothesis, grades `hypothesis / replicated / refuted`, with drill spec, external pointers, protocol |
| `LearningRule` | `shared/learning-record.ts` | **player-authored**, grades `hypothesis / replicated / refuted / retired`, mechanism class, refutation condition |
| `LearningTransfer` / `…Result` / `…Observation` | `shared/learning-record.ts` | preregistered 3-position transfer test; `TRANSFER_MINIMUM_SUCCESSES = 2` of `TRANSFER_POSITION_COUNT = 3` |
| retrieval schedule | `RETRIEVAL_INTERVAL_DAYS = [1, 3, 7, 21]` | fixed, not derived |
| `evidence-policy.ts` (26 kB), `evidence-authority.ts` | `shared/` | what a surface is permitted to say, and on whose authority |
| `next-action.ts` (16 kB), `primary-action.ts` | `shared/` | one primary action per state |
| `scoreRecall`, `accurateDecision` | `shared/recall-score.ts`, `shared/detector.ts` | the two halves of transfer success |
| action-set instrument | `research/measurement/action_set.py`, `docs/measurement/ACTION_SET_MODEL.json` | **already implements `B(s)`, `V_B`, `V_notB`, `A_B`, `R_B`** across 17 rule classes |

---

## 6. Field evidence count

**Zero, at `c848f244` — and no longer true on this branch.** See the note below the table.

**Zero.** Not approximately zero.

| statement | source |
| --- | --- |
| `"humans_measured_by_this_execution": 0` | `docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM.json:238` |
| *"Humans measured: 0. Production behaviour changed: none."* | `docs/decisions/D25-evidence-architecture.md:15` |
| *"Zero participants remains the correct cost."* | `D25:132` |
| *"zero participants are the correct cost until Gate A and Gate B are finished"* | `docs/learning-v2/EXPERIMENT.md:244` |
| *"no human has adjudicated a single item"* | `docs/measurement/FALSIFICATION_REGISTER.md:343`, `OT-5` |

> **Superseded on this branch, and the snapshot is kept rather than edited.** Every row above was
> true of `main` at `c848f244`, which is what this file records and why it is not rewritten. Since
> then `docs/learning-v3/HUMAN_CUE_N1_RESULT.md` reports **one participant** measured in an N-of-1
> pilot on a locked item bank — `P4-N1-PASS`, baseline 9/12, unseen test 12/12. That document is the
> authority for what it establishes and for the eight things it lists as not established, among them
> population efficacy, causality against a randomized control, and transfer to ordinary games.

No telemetry, no analytics, no recruited cohort, no production record store with player rows. Every
number in `docs/measurement/` and `docs/evidence-architecture/` is engine-and-corpus, not person.

**Consequence for this cycle, stated now rather than discovered in Phase 8.** Every falsifier in
`FALSIFICATION_REGISTER.md` whose measurement names ΔP(Y|X) is `NOT EXECUTABLE` today, and no
document produced here may report one as anything else.

---

## 7. Open research blockers

From `docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM.json` (`claim_version 2.2.0`, decided
2026-09-01, verdict **`CONSTRUCT-UNDERIDENTIFIED`**, `evidence_level_reached: E1`,
`attempted: E2`, `required_for_production: E5`):

| id | why it is open |
| --- | --- |
| `anchors_under_c11` | neither anchor RC-00 nor RC-01 has been graded for a saturated noise cell, and every published comparison is against them |
| `method_shaped_rules` | RC-11 is method-shaped, does not branch, T− prescription size .175, not re-screened |
| `chose_past_it_base_rate` | the only production observation supporting M1 over M0, and `shared/reveal.ts` says it has never been measured |
| `exchangeability` | max \|SMD\| 0.573, untouched, *"moot while the contrast is void"* |
| `engine_sensitivity` | top-1 `b_valid` agrees between SF16 and SF17.1; action-set **value** stability, node/depth stability and WDL-model sensitivity untested |
| `domain` | no evidence that any of this is separable from general chess strength |
| `reactivity` | untested |

Plus the **identifiability result**, which is the hardest thing in the tree: correct conditional
discrimination and *perform-B-everywhere* response bias are **observationally equivalent under a
saturated noise cell** — a Bayes-optimal classifier handed the true generative model of both
hypotheses separates them at **0.500** on every observation set tried, including move + time +
timed condition + delayed condition + generic cue + candidate set, and at double the items. The
same pair under a **non-saturated** noise cell separates at **0.983**.

That is not a power problem. It is the noise cell.

---

## 8. Where the tree disagrees with the descriptions handed to this cycle

Recorded, not resolved. Each is a Phase 1 re-derivation item.

| # | description received | what the tree says | where |
| --- | --- | --- | --- |
| B-1 | *"only `RC-06 answer-the-mate-threat` survived the current binary eligibility screen"* | **RC-06's eligibility is refuted**, and `eligible_set_after_fifteen_candidates: []` — the eligible set is **empty** | `STRONGEST_PERMITTED_CLAIM.json`, `refuted.rc06_is_eligible` |
| B-2 | *"15 rule classes were screened"* | **17** classes carry rows, anchors included; the C11 screen ran on all 17 | `ACTION_SET_MODEL.json rows`, `c11_screen.classes_screened` |
| B-3 | Gate A-FAIL's remedy: *"the next object becomes process evidence"* | *"the next research object is process evidence"* is a **forbidden claim**. `D25`: *"Not `PROCESS-EVIDENCE-REQUIRED`. Process evidence was tested against the failure and is worth exactly nothing on it"* | `D25:7-9`, `forbidden_claims` |
| B-4 | *"final move may not be a valid direct proxy for rule use"* | *"the final move is insufficient in general"* is a **forbidden claim**; `D25` says *"Not `MOVE-ONLY-SUFFICIENT`"* but locates the failure in the **response predicate**, not the observation channel | `D25:6-11`, `forbidden_claims` |
| B-5 | `RC-21`'s named act is best on ~16.4% of T+ | matches `PRE_HUMAN_GATES.md`, **16.4%** — carried forward unchanged | `docs/learning-v2/PRE_HUMAN_GATES.md` |
| B-6 | — | `D24` is superseded in part by `D25` and **does not say so**; `D24` still reads *"left RC-06 as the only eligible class"*. `PRE_HUMAN_GATES.md` likewise still names RC-06 as the one eligible class | `D24`, `PRE_HUMAN_GATES.md` |
| B-7 | — | `ACTION_SET_MODEL.json` carries a `provenance_warning`: **it ran on Stockfish 16**, while the published screen ran **Stockfish 17.1**. Its anchors are also inverted — ceiling RC-00 at `0.344`, floor RC-01 at `0.564` — which is exactly the `a5_on_expected_score` refutation | `ACTION_SET_MODEL.json` |

`B-3` and `B-4` matter most: the mission's own A-FAIL branch prescribes a remedy the repository has
already tested and forbidden. That contradiction is reported rather than followed.

---

## 9. Currently authoritative learning documents

Authority as the tree currently stands, most recent first. `⚠` marks a document that is current for
some questions and superseded for others.

| document | authority for | state |
| --- | --- | --- |
| `docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM.json` | what may be claimed at all; the refuted and forbidden lists | **current**, v2.2.0 |
| `docs/decisions/D25-evidence-architecture.md` | whether the evidence architecture can support the claim | **current**, `CONSTRUCT-UNDERIDENTIFIED` |
| `docs/evidence-architecture/C11_SCREEN.md` | the noise-cell criterion; 7 MEASURABLE / 8 VACANT / 2 SATURATED | **current** |
| `docs/evidence-architecture/ANCHOR_REBUILD.md` | corrected anchors and separations | **current** |
| `docs/decisions/D24-learning-architecture.md` | the claim under examination; the `mayPrescribe` finding; the two pre-human gates | ⚠ verdict `NARROW` superseded by D25; the rest survives |
| `docs/learning-v2/PRE_HUMAN_GATES.md` | the Gate A / Gate B **specifications** | ⚠ specs current; its "RC-06 is the one eligible class" is not |
| `docs/learning-v2/BARRIER_MODEL.md` | the barrier decomposition (`R4`) | to be re-derived in Phase 1 |
| `docs/learning-v2/{THEORY_EVIDENCE,INTERVENTION_COMPARISON,CRITERION_CHANNEL,EXPERIMENT,FALSIFICATION_REGISTER,KNOWLEDGE_MAP}.md` | mechanism candidates, criterion channel, experiment design | to be re-derived in Phase 1 |
| `docs/VERIFIED_LEARNING.md` | what the shipped loop does, step by step | **current** for the code; the code is flagged off |
| `docs/INERTIAL_UX_LAWS.md` | the UX laws (`R1`) | to be re-derived in Phase 1 |
| `docs/measurement/*` | the item bank, screens, analysis plan, GO/NO-GO | **current**; `GO_NO_GO.md` §7 superseded in part |

---

## 10. What is executable in this session

Recorded because it decides which parts of Gate A are measurement and which are re-reading.

| resource | state |
| --- | --- |
| games corpus | `lichess_db_standard_rated_2013-01.pgn.zst`, **17,761,302 bytes, md5 `46fa4bf93894234017be96eed030e7b2`** — **byte-identical to the published corpus** |
| engine | **Stockfish 17.1**, `stockfish-ubuntu-x86-64-avx2`, the exact published build — *not* the Stockfish 16 that produced `ACTION_SET_MODEL.json` |
| python | 3.11.15 with `chess 1.11.2`, `numpy 2.4.6`, `scipy 1.17.1`, `zstandard` — the versions in `research/measurement/environment.lock` |
| puzzle corpus | not fetched (304 MB); only needed for puzzle-derived items |
| humans | none, and none may be recruited by this cycle |

**So Gate A can be re-run as a measurement rather than re-read as a document, and re-run on the
published engine for the first time.** That is the single largest thing this baseline establishes.
