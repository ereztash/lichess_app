# Mission ledger — cross-context personal decision mechanism

**Mission.** Earn, or show what is missing to earn, the capability: identify that two or more of
one player's chess mistakes in materially different contexts are manifestations of the same
recurring player-specific decision mechanism, defined from pre-move information, predictive on
held-out decisions, stable, and actionable as one concrete next-game operation whose effect can be
prospectively tested.

**Player.** Lichess `erez281` (the repository owner). The account is the only personal corpus.

**Governing rules.** `docs/decisions/README.md` evidence levels E0–E6; Neta finding contract
(`Product-Perception-Sensemaking-Architect/CLAUDE.md`): claims carry type, evidence, required and
observed reality, resolution authority, requested use, permission; no numeric confidence theater;
`FIELD` outcomes ordinarily require R6.

**Mission levels.** L0 signal · L1 cross-context pattern · L2 predictive candidate · L3 stable
personal mechanism · L4 actionable · L5 prospectively testable intervention · L6 validated.

---

## Environment (recorded before any analysis)

| item | value |
| --- | --- |
| `lichess_app` `origin/main` | `2f3c26139e9bb166e799f2bccf8a75d900f568e1` |
| Neta `origin/main` | `334ae0e606b04598b184aac584713050e43b8c37` |
| work branch (both repos) | `claude/chess-mistake-patterns-stsf7z` |
| date | 2026-09-05 |
| personal corpus | the frozen 2,209-game window of `research/harness-account-full/corpus_manifest.json`, re-fetched by game id (`/api/games/export/_ids`, the by-username export returns 404 for every user today), 2,209/2,209 ids recovered, 2,161 standard-variant games scored (the 47 `fromPosition` and 1 `atomic` games are the same 48 the product drops) |
| post-freeze holdout | games created after the manifest fetch (2026-09-01T21:42Z), admissible under the product's rule, never opened during discovery — see §Preserved compute |
| research engine | Stockfish 17.1 native (avx2), Threads 1, Hash 16, MultiPV 3, `go depth 12`, hash cleared before every position. NOT the product's Stockfish 18 Lite WASM; `ENGINE_PARITY_RESULTS.md` measured 13.61% verdict flips between engines, so the final candidate must be re-checked under the shipped engine before any product claim |
| targets | canonical: `accurate` = winProbabilityLoss(facing, cpLoss) ≤ winProbabilityLoss(15, 30), k = 0.00368208 (`shared/detector.ts`, `shared/win-probability.ts`); continuous: `y_wp_loss` |
| population reference | 600 games from `lichess_db_standard_rated_2026-06.pgn.zst` first 80 MB, 420 × 180+0 and 180 × 300+0, both players 1450–1850, Termination Normal, clocks, no berserk, ≥ 20 plies, one game per player, hash-sampled with seed string `20260905:<gameId>` |

## Frozen design v1 (written before any outcome-bearing run on the real target)

| item | frozen value | reason |
| --- | --- | --- |
| eligibility | the product's rule: not forced, not book, think time and clock present (`shared/import-diagnostic.ts`) | continuity with every canonical number |
| unit | decision; every split, resample and SE is by GAME | D02: decisions in one game are not independent |
| split | chronological by game: DERIVE oldest 60%, VALIDATE next 20%, TEST newest 20%; EXTRA = 12 admissible post-freeze games | prospective direction; TEST is opened once, at Node H, for the frozen candidate(s) only |
| primary target | `err` = 1 − accurate (win-probability loss > 2.76 pp) | the repository's frozen definition |
| secondary target | `blunder10` = win-probability loss ≥ 0.10; `y_wp_loss` for effect size | reported, never used to select |
| search | pysubgroup beam search (D04's oracle), depth 1–3, StandardQF a=0.5, fixed cuts (product thresholds or DERIVE-only tertiles) | E3 method in the repository; cuts never read VALIDATE |
| primary search target | residual `err − p̂` where p̂ is a logistic baseline fit on DERIVE (phase, standing, speed, color, log think time, clock fraction, clock < 60 s, rating diff, legal moves, best-to-second gap, near-equivalent count, ambiguity entropy, edge, in check, material, ply) | a mechanism must exceed generic difficulty, time and context |
| secondary search target | raw `err` | signal only; a raw region fully explained by the baseline is a proxy |
| vocabularies | OBS (player-observable: board relations, opponent's last move, clock, own in-game history, context) and ENG (engine situation, diagnostic only) | GATE-CUE-PLAYER-OBSERVABLE: the trigger must be evaluable at the board |
| freeze | top 3 candidates from DERIVE per (vocabulary, depth) | multiplicity bounded before judging |
| depth rule (Node C) | chosen by 5-fold game-grouped cross-validation INSIDE DERIVE: highest mean held-out clustered z of the residual contrast; ties to the smaller depth | complexity never chosen on VALIDATE |
| judge | on VALIDATE: game-clustered z of (error inside − outside) ≥ 3.5, n_in ≥ 100, and the residual contrast positive | between the shipped 3.25 (one candidate) and 3.75 (six) |
| region size | on DERIVE between 300 and 12,000 decisions (≈1%–40% of eligible) | recurring, not everything |
| functional equivalence | two regions are the same candidate when Jaccard ≥ 0.60 on VALIDATE (D04's line) | stability is measured on sets, not strings |
| null control | shuffle `err` within game on the real table, 100 draws per depth; the chain's validated rate must stay ≤ 0.02 | GATE-SHUFFLE discipline on this pipeline |
| planted worlds | seven truth types planted on the shuffled real table; recovery = Jaccard ≥ 0.60 | Node B |

## Node ledger

| Node | Question | Evidence | Result | What died | What survived | Next branch |
| --- | --- | --- | --- | --- | --- | --- |
| A | Is the current research state coherent? | reader workflow over docs/decisions, discovery-v2, research/*, Neta docs | _pending_ | | | |

## Killed paths

_(none yet beyond the repository's own: see Node A)_

## External resources used

| question | source | resolves | cannot resolve | decision impact |
| --- | --- | --- | --- | --- |
| personal corpus games | Lichess API `POST /api/games/export/_ids` | the 2,209 frozen games, clocks, openings | nothing about decisions before commit | corpus identical to the product's canonical window |
| population reference | `database.lichess.org` 2026-06 monthly dump, 80 MB prefix | whether a region is hard for everyone | anything about this player | discriminator for PERSONAL |
| engine | Stockfish 17.1 GitHub release binary | move quality at depth 12 | agreement with the shipped WASM engine | parity re-check required before product claim |

## Preserved compute

| artifact | where | contents |
| --- | --- | --- |
| scored positions | `research/mechanism/data/scored.jsonl.zst` (to be written) | every position of 2,161 games: FEN, clocks, legal count, three engine lines |
| decisions table | `research/mechanism/data/decisions.parquet` (to be written) | one row per erez281 decision, pre-move features and `y_*` targets |

## Current strongest claim

Nothing beyond the repository's own: the six-bucket detector cannot register a separable bucket on
this account's whole record (`ACCOUNT_BRIDGE_FULL_RESULTS.md`, `not-separable`).

## Current bottleneck

Node A synthesis (coherence map) is pending; no search may start before it and before the
feature-admissibility gate (Node E) is written down.

## Node A — coherence map (from `nodeA/synthesis.json`, verified by three adversarial passes in `nodeA/verification.json`)

Coherence verdict: **PASS** with corrections recorded below.

| claim | current status | superseded by | reversal condition | next open question | authority |
| --- | --- | --- | --- | --- | --- |
| Canonical target: a decision is accurate iff winProbabilityLoss(engineEvalCp, cpLoss) <= ACCURATE_WIN_PROBABILITY_LOSS = winProbabilityLoss(15, 30) = 0.027608582058630926 (k = 0.00368208; ACCURATE_CP_LOSS = 30 kept only  | SHIPPED / SUPPORTED | Supersedes raw cpLoss <= 30 and the non-canonical eval-analysis.ts 0–100 score | Gate fails if a cited constant differs from the build; k fitted on 2300-rated games 'misstates what moves cost' for other populations | Whether a 2300-rated logistic is the right cost scale for the owner; whether accuracy (proxy) tracks calibration gap at all — 'nothing has checked that the buck | REPO |
| Instrument identity is load-bearing: native Stockfish vs shipped Stockfish 18 Lite WASM at depth 12 flips 216/1,587 (13.61%) accurate verdicts, +4.4–4.5 pp one-way; Δ 13.6 pp > T2 13.0 pp → STOP-B1; hash clearing alone f | SUPPORTED; consequence executed (every owner corpus re-scored on shipped WASM, hash cleared) | research/harness (native, warm hash) superseded by research/harness-shipped (X-1 | 'No threshold moves because of this result'; browser behaviour and other depths unmeasured | Any owner mechanism must be shown robust to a label that flips 13.6% under an engine swap; root-minus-child cpLoss noise floor at depth 12 MultiPV 1 never measu | REPO |
| The owner's whole admissible record exists and is scored: erez281, 3,195 rated games → 2,209 admissible (rejected: Abandoned 124, Time forfeit 724, under-20-plies 134, no-clocks 4); blitz 1,899 / rapid 203 / bullet 103 / | SUPPORTED (aggregates only); per-decision rows ABSENT from disk (gitignored; find returned nothing) | Contains the 1,240- and 48-game windows | A re-score on another build/depth is a different instrument (R-03 refuses pooling) | Regenerating the per-decision table (~90.8 min per pass) and with which row schema; scratchpad/account/frozen_2209.ndjson (7.46 MB raw API JSON, 2,209 rows) hol | REPO |
| Owner bridge series (worstBucketVerdict at 2 SE): 48 games not-separable (phase-middlegame 0.6025 n=790 vs standing-losing 0.6163; sep 0.01375, bar 0.06985); 1,240 games REGISTERED on phase-middlegame (0.6024 n=19,577 vs | SUPPORTED; 'This account cannot register this hypothesis' (needs ~4,256 games; 2,209 exist); 'No fourth window' | 2,209 result supersedes the 1,240 registration as the last word | Two of three frozen refuters fired; FULL_PREREG §6 forbids a fourth window, threshold moves, dropping games | The instrument searches downward while the largest structure is at the top (phase-endgame 0.8042 n=2,590; clock-under-1m 0.6938 n=3,752 vs a 0.60–0.64 pack) | REPO |
| Strongest owner-specific L0 signal: accuracy falls monotonically with think time inside fast-under-45s — 0–1 s 71.3% (n=15,421), 2–3 s 63.9% (19,881), 4–7 s 55.2% (11,376), 8–15 s 49.6% (4,647), 16–45 s 48.4% (1,389), 46 | SUPPORTED as OBSERVATION; explicitly NOT causal (TIME_REPRESENTATION_PREREG §2.2: 'hard positions take longer and are played worse') | none | A per-decision difficulty control (candidateGap, legal-move count, \|V−0.5\|) flattening the gradient; never computed for the owner | Player-specific vs population-typical: six-player blitz subset shows the same shape (78.1%→46.3%); B3 population beta +0.01342 — no matched baseline for the own | REPO |
| On the 117-game B2 corpus the think-time separation survives its within-cell random-boundary null in all three middlegame cells (level 13.93 vs 11.69 n=250; losing 11.89 vs 10.45 n=288; winning 12.85 vs 10.57 n=274) and  | SUPPORTED on one corpus (1,308 held-out decisions); B2 verdict OBSERVATION; nothing adopted | Supersedes the 75-game conclusion '8 of 8 collapse' (corpus missing 42 arena gam | STOP-B2 rules; §8 'No threshold moves. Not 45, not 120'; a live record with stated confidence required before any cut moves | What carries the residual middlegame separation once phase×standing is fixed — unmeasured difficulty or a player-specific allocation pattern | REPO |
| The shipped time cut is structurally dead on this account: slow-over-2m holds 0/0/2/4 decisions across 117/48/1,240/2,209 games; fast-under-45s holds 99.7%; raw seconds separates by 0.00 pp; think times are integer secon | SUPPORTED (structural fact); product cut frozen by decision | none | Only if the account's time controls change | Whether thinkFractionOfClockBefore, clockShare or clockBalanceMs (derivable, never written to any evidence row) separate on the owner's real record | REPO |
| D05 relative-time buckets (fast-relative <1/60, slow-relative >1/15) fix readability outright on simulated blitz (usable 0.2725→0.9956; 0.0037→1.0000; false-claim 0/1,600) but were REJECTED twice on recovery: 0.0000 vs b | REJECTED at these cuts; node DEFER; E1 (simulated only) | Q9 supersedes Q8's unanswerable test; D05 supersedes Q6's 'the world is fine, th | (1) a declared choice rule then one run; (2) a real blitz record; (3) vocabulary gains conjunctions (D04); (4) blitz record large enough that 27% usable stops mattering | 'picking a better constant is worth about five points where the search is worth thirty-three' | RESEARCH |
| D00: discovery research runs as a Python PSEUDOCODE_ORACLE (E3); shared/discovery/ holds only contracts; no search algorithm exists in TypeScript; bridge parity 9.7e-17. | DECIDED | D00's 'pysubgroup imported by nothing' is stale relative to q7/D04 (M0 passed) | Oracle stops reproducing a shipped result; a component reaches E4; bridge costs more than the duplication it prevents | Whether pysubgroup earns a port | REPO |
| D01: a feature is admissible only via a point-in-time read — featureAsOf filters observed_at <= commit_timestamp (cutoff is the COMMIT, not the reveal); missing is null never default; DeepGameFeatures (shared/game-featur | DECIDED, E2 ('a contract nothing calls prevents nothing' — no product path reads featureAsOf) | Killed the per-column PRE_DECISION/COMMIT/POST_GAME label alternative | DeepGameFeatures wired without a FeatureSpec; a leaked feature reaching a validated claim → bitemporal rows; event_time unread at first real study → remove | Whether the three timestamps are the right three | REPO |
| D02: unit of inference is the DECISION; game-clustered sandwich SE REFUTED (worse calibrated in 82/84 cells at 20 games; null fire up to 3.9% vs 1.5%); shipped SE understated 0–38% over ICC 0–0.058 but absorbed by the tw | DECIDED (REJECT clustered judge), 'one number open' | none | (1) real ICC > 0.05; (2) 'Records reach roughly 50 games'; (3) chain loses its second stage; (4) cluster bootstrap measured and wins. CONDITION (2) IS MET BY THE OWNER CORPUS (2,209 games ≈ 44×) | D02 explicitly 'does not cover' a 200-game player; comparison 'must be re-run before that is assumed either way' — never done on the owner | REPO |
| D03: three-layer registry measured → discovery_eligible → validation_eligible; searchableFeatures refuses role TARGET, VALIDATION_ONLY (measurement_protocol, time control) and anything undeclared; confidence is 'half the | DECIDED, E2 (no FeatureSpec registry instance exists in product code) | none | A feature declared discovery_eligible without a written argument; semantic_confidence unread at first study → delete; three layers stop being enough | Which semantic_confidence class board-derived constructs (OwnExposure, mobility, ambiguity) carry | REPO |
| D04: fixed-vocabulary pysubgroup beam search (7 selectors over phase/seconds/clock_ms; NumericTarget gap; StandardQFNumeric a=0.5; beam 20; result_set_size 1) on the derivation half, one region frozen, judged on validati | MEASURED, NOT REJECTED; E3; depth is an open trade; never run on a real record | Killed 'accurate as target with confidence as selector' (region 'confidence < 5' | Real-corpus false-claim > 0.02; a depth unchoosable without seeing the outcome; a port disagreeing with pysubgroup; Jaccard ≥ 0.60 doing the work (per-record distribution NOT stored — cannot be evalua | 'Choosing a depth is choosing which world to be right about'; widening the vocabulary is 'a new multiplicity question, not a free improvement' | RESEARCH |
| D06 stability selection, D07, D10, D12, D17 semantic chess features, D18 sequence mining are DEFER with written triggers; none has a file. D06's original trigger fired via D04 and was replaced by 'opens when D04's depth  | DEFER (by decision) | X-08 DIFFERENT_SCOPE | Each opens only on its stated trigger | The mission's L3 'stable under resampling' IS D06 and is gated on D04 depth; opening/colour/material features live under D17 | RESEARCH |
| D08 attribution veto: built (ATTRIBUTION_K=2.5, MIN_SPLIT_N=15), measured (worst false veto 5.6%, caught 9.2%; at k=3.0 caught 0.0000 at 20 validation games, 0.2283 at 60, 0.4729 at 140), NOT wired; q10: once a search ex | DEFER; RC2 fired, evaluated, closed and replaced by RC5 | RC2 as written ('misattribution largely stops') refuted by q10 | (1) a record reaches 60 validation games — MET BY THE OWNER CORPUS; (3) real false-veto > 0.10; (4) claims shown without prospective step; (5) a search is ported | Whether splitBy should become an INPUT to a search; whether a withheld claim should be replaced by the search's region (needs its own pre-registration) | RESEARCH |
| D09: hypothesis_id = SHA256(canonicalJson(manifest)) over canonical predicate (max depth 2), target ('calibration_gap is the only one today'), direction, minimum_meaningful_effect > 0, generator+version, feature_versions | DECIDED, E2 ('nothing has yet been frozen against real evidence') | Killed trusting a declared validation_protocol (INV-10 violation caught by revie | Two hypotheses sharing an id; legitimate re-derivation producing new ids; shared/ ceasing to be isomorphic | An accuracy-only target for the owner does not exist in the manifest vocabulary and must be declared | REPO |
| D20/#42: a claim about the decision environment (clock/time) cannot be closed by a protocol that removes the environment; protocol = UNION of condition kinds a predicate reads (POSITION→match-position-class, ENVIRONMENT→ | CLOSED (owner PR #42) | Fixed classifyKinds precedence bug (conjunction vs priority) | A real subgroup whose class cannot be derived from its features; UNKNOWN firing on obviously testable subgroups | Are 12-second drill decisions and 12-second clock decisions the same event — 'That measurement does not exist' | OWNER |
| D21: within-player feedback exposure has no representation in the record; decisions after 199 reveals and after 0 pool as one population; 'Discovery must not widen on the assumption that exposure is uniform.' | DEFER (Finding 3); Findings 1–2 CLOSED (protocolVersion stratum) | none | 'a measurement showing the calibration gap differs between early and late decisions within a player, at n >= 30 per half' — runnable on the owner record by decision order | Owner exposure to the OwnExposure cue is bracketed to 2026-09-02T16:16–16:35Z (PRE_EXPOSURE_BASELINE §1): all 2,209 games are pre-exposure; the 12 post-freeze a | REPO |
| D25 verdict CONSTRUCT-UNDERIDENTIFIED (claim_version 2.2.0, 2026-09-01): 'the response predicate, not the observation channel, destroys the distinction'; E1 reached, E5 required; humans measured 0. RC-06's +0.768 separat | DECIDED (current); amended in place 2026-09-01 (reversal conditions 2 and 5 fired) | Supersedes D24 NARROW; docs/measurement/STRONGEST_PERMITTED_CLAIM.json 1.3.0 'fo | (1) a fixed predicate giving RC-06 T− rate materially below 1; (2) RC-05 or RC-02 surviving a full screen with a non-degenerate noise cell; (3) every method-shaped class saturating; (4) chose-past-it  | Unresolved 'domain': 'no evidence that any of this is separable from general chess strength'; 'reactivity': untested | RESEARCH |
| Identifiability: under a saturated noise cell, correct conditional discrimination (L1) and perform-B-everywhere response bias (L3) are observationally equivalent — Bayes-optimal C/D accuracy .500 at every observation run | ESTABLISHED (E0 synthetic learners, E1 chance rates); process evidence REMOVED from the architecture | none | An observation collectible in the product whose distribution differs between p_neg .05 and .55 when P(B\|T−)=1 — 'an observation that is not the response' | Any owner 'same mechanism' claim must have a non-degenerate T− cell or it cannot beat 'does this everywhere' | RESEARCH |
| B3 population regularity (2,331 players, 81,624 decisions, 180+0, SF 17.1 60k nodes): beta (quality_loss on unexpected_time_within_rating) = +0.01342 [+0.01243, +0.01431]; positive in 9/9 bands; blunder-concentrated (cap | SUPPORTED (population); forbidden: 'causes', 'hesitation', 'confusion', 'A2 excluded'; MODEL_CARD §3 forbids judging an individual | Gate 3/4 corrections replace earlier readings; 300+0 block NOT EVALUABLE (F11) | VERDICT_RULES §2.1 triggers; r_beta upper < 0.5 (observed 1.0146 [0.9528, 1.0753]) | Frozen 180+0 nuisance models drift across months and do not extrapolate to 300+0 (the owner's B2 corpus includes 25×300+0, 8×300+3); human-perceived difficulty  | RESEARCH |
| System-invariant OwnExposure (own non-king pieces with more enemy attackers than own defenders; P3 side_piece_metrics): population Test A +0.1014 [+0.0908, +0.1134] on quality_loss (45,296 decisions, 1,333 players); Test | FROZEN VERDICT (Outcome C); population only; erez281 not in corpus | none; universal cue reading killed (A-11/A-12: 95.42% value-free vs 34.54% engin | 'a different consequence definition or a different scope … is a new preregistration' | Whether OwnExposure is a player-specific mechanism for the owner at all — no document tests the owner's decisions against the construct | RESEARCH |
| P3-PASS (M0 .5000 / M1 .5779 / M2 .6577; M2−M1 +0.0799 [+0.0534, +0.1049]) and PE-EXPOSURE-ONLY (post_own_overloaded_piece_count +5.76 pp [+3.93, +7.68]; opponent-pressure FAILS C2/C3/C4) on RC-07/08/09 valid actions, po | SUPPORTED (population ranking inside B) / P4 DOWNGRADED to non-specific post-intervention evidence; owner has been exposed to the cue | AMENDMENT_01 §A downgrades P4 | P4 needs a sham/attention-matched arm 'no repository asset can supply' | Post-exposure natural-game test frozen (recent-300 blitz window, policy_consistency endpoint, 100 opportunities or 120 days) but UNLICENSED because C9 failed | FIELD |
| Learning-v3 rule-class programme: Gate A A-REVISION (A5_beats_incumbent void on xs scale; 17/17 verdicts identical SF16 vs SF17.1); Gate B B-PASS for RC-05 on 378 minimal twins (regret −0.1088, advantage +0.1485; DoD vs  | CLOSED for RC-05; INTERVENTION_EXPERIMENT and FIELD_PROTOCOL NOT ADMISSIBLE | Sham interval criterion (should include zero) was NOT met for advantage_xs [−0.0 | True per-game opportunity rate scanning every ply (never measured); RC-02 base rate 12.2% | C12 over all 17 classes (~4,000 searches); twin banks for RC-02/03/04 | RESEARCH |
| Neta v0.2 contract: three permissions ALLOW/DENY/DEFER; claim kinds OBSERVATION/MECHANISM/INTERVENTION/OUTCOME; states SUPPORTED/UNRESOLVED/REFUTED/INSUFFICIENT_REALITY; authorities OWNER/REPO/ENVIRONMENT/RESEARCH/FIELD; | BINDING | Supersedes v0.1 shapes (N-1..N-6 all fail the validator: unknown fields authorit | Enum/schema edits; positive control staying green | Validator forces EVERY OUTCOME claim to FIELD/R6 ('third party acted') while the mission's outcomes are the owner's own next games | REPO |
| Pipeline defects bearing on any time/clock mechanism: (a) admissible() drops all 724 Time-forfeit and 124 Abandoned games (selection on outcome for a clock mechanism); (b) no code handles [WhiteBerserk]/[BlackBerserk] —  | OPEN DEFECTS (recorded here, not yet in FAILURE_LINEAGE) | none | Re-running decisionsFromGame on the 146 owner-berserk games with halved base (no engine needed) | Which authority owns the fix: REPO (schema/validator layer) vs a new preregistration (FULL_PREREG §6 forbids dropping games/moving thresholds within that series | REPO |
| Neta has been run on this product four times (embodied run 001 at 9d03bbb; pre-human passes 1, 2, 2/3/4, 3); every remaining material uncertainty was assigned to OWNER or FIELD; Pass 4 answered DEFER to a new candidate-m | RECORDED; none concerns a recurring player-specific decision mechanism | N-5 randomised-arm warning corrected in Pass 4 | 'No further technical work reduces it, which is the authority ceiling' | The mission ledger would be the first v0.2-shaped finding in lichess_app | OWNER |

### Authority conflicts found (unresolved unless stated)

- OUTCOME-claim authority for the owner's own behaviour: RAP §5 law 2 and CLAUDE.md say OUTCOME claims 'about external people' resolve to FIELD/R6, but validate_finding.py forces EVERY OUTCOME claim to FIELD with required_reality >= R6 ('third party acted'); RAP names no authority for 'owner behaviour inferred from owner data'. Unresolved — the mission's L5/L6 outcome (owner's next games, n=1) cannot be typed without either a rule amendment or treating the owner-as-player as FIELD.
- Observed-reality level of the historical 59k-decision engine-scored corpus: R1 (static data exists) vs R5 (owner used the real path with real input). RAP gives no rule for retrospective behavioural logs; this decides whether any L2/L3 MECHANISM claim can ever be SUPPORTED without new games. Unresolved.
- Resolution-authority vocabularies differ between the frozen prompt (OWNER/REPO/DESIGN_MECHANISM/FIELD, prompts/SYSTEM.md §11) and the v0.2 contract (OWNER/REPO/ENVIRONMENT/RESEARCH/FIELD). AUTHORITY_MAP names RAP canonical; the prompt cannot be edited; the disagreement is by design but unrecorded as a defect. N-1/N-4 findings carry authority DESIGN_MECHANISM, invalid under v0.2.
- Gate B B-PASS (RC-05) rests on difference-of-differences after the pre-written sham criterion ('intervals should include zero') failed for advantage_xs CI [−0.0552, −0.0001] and b_valid; no amendment logging the criterion change was found. Population-only, does not change any owner permission, but is a protocol deviation the mission must not copy.
- MEASUREMENTS.md still states 'This product has never been run against a real player's record. Every number … comes from synthetic data' while its own head and research/harness-account-full record real-player and owner readings; and its instrument spec says 'depth 14, MultiPV 8' where the canonical records were scored at depth 12 MultiPV 1 (root-minus-child). Two instruments under one word 'accurate'; owner-side is depth 12.
- Berserk/time-forfeit handling: REPO (repair at the lowest layer per CLAUDE.md) vs RESEARCH (ACCOUNT_BRIDGE_FULL_PREREG §6 forbids dropping games/moving thresholds within that series). Not decided anywhere.
- Pre-named separability multiplier: MEASUREMENTS §5 and D04 say k = 3.25 (PREREGISTERED_SEPARABILITY_K in detector.ts = 3.25) while MEASUREMENTS 'Pre-registration now buys the bar' table shows 3.00 '<- shipped'. Code wins (3.25); the document row is stale.
- The B3 verdict files carry label_means text that is the definition of EXPERTISE_ADAPTATION_SUPPORTED (level 4), a verdict neither file records (Gate 4 F1); REPORT.md refuses to print it. Resolved by REPORT.md but the JSON is unchanged.
- D06 opening: D04 says 'D06 is now unblocked by exactly this result' while README says 'D06's trigger has fired and D06 stays shut … opens when D04's depth is settled'. Resolved by README (later, DIFFERENT_SCOPE, X-08) — the mission's L3 resampling is therefore gated on a depth decision.

### Corrections from adversarial verification (material only)

- preserved_compute: "post_freeze_admissible.ndjson (12 blitz rows, all post-2026-09-02 exposure)"; node_a_table D21 row: "the 12 post-freeze admissible blitz games in scratchpad are post-exposure"; wha → source says: The file's own createdAt timestamps: GqvPZPPf = 2026-09-02T14:36:32Z and lmv1uGMF = 2026-09-02T14:41:11Z, both BEFORE the exposure bracket start 2026-09-02T16:16:05Z fixed in docs/system-invariant/PRE_EXPOSURE_BASELINE.md §1 (bracket 16:16:05Z–16:35:47Z). Only 10 of 12 are post-bracket (earliest 202 (/tmp/claude-0/-home-user/ee69b5a4-c8fc-5a0f-a62b-0e04fcb5bda2/scratchpad/account/post_free)
- node_a_table (Neta runs row): "every remaining material uncertainty was assigned to OWNER or FIELD"; reversal_condition: "'No further technical work reduces it, which is the authority ceiling'" → source says: docs/PRE_HUMAN_CEILING.md: the 2026-09-03 ceiling sentence "was falsified on 2026-09-04"; the file ends "FOUR FAMILIES CLOSED ON f1315d7 — CEILING NOT RE-DECLARED" and "Repeating the declaration from a fourth green tree would be repeating the inference, not the evidence". The remaining items are exp (/home/user/lichess_app/docs/PRE_HUMAN_CEILING.md (sections 'The reopening — 2026-09-04', ')
- current_bottleneck: "No per-decision owner table with pre-move context exists ... not one cross-context pre-move feature can be computed or held out for the owner until the corpus is rebuilt ... and r → source says: True for the committed repository, but stale for the session state the mission is running in: /tmp/.../scratchpad/scored/part00..03.jsonl (2,161 games, all four workers finished 12:31–12:33, e.g. 'worker 0 done: 30063 positions in 42.7 min') hold every position with fen, san, uci, own_before_cs, opp (/tmp/claude-0/-home-user/ee69b5a4-c8fc-5a0f-a62b-0e04fcb5bda2/scratchpad/scored/part00.jso)
- node_a_table D02 row, reversal_condition: "(2) 'Records reach roughly 50 games' ... CONDITION (2) IS MET BY THE OWNER CORPUS (2,209 games ≈ 44×)"; D08 row: "(1) a record reaches 60 validation games —  → source says: No repository document records either trigger as fired: docs/decisions/README.md still lists D02 as 'decided, one number open' and D08 as 'DEFER ... not wired in', and no D02/D05/D08 reference exists in docs/research/ACCOUNT_BRIDGE*.md or TIME_REPRESENTATION*.md. D02's reversal conditions are writte (/home/user/lichess_app/docs/decisions/D02-the-unit-of-inference.md (UNCERTAINTY, REVERSAL )
- neta_compliance_requirements[0]: the ledger must contain contract_version '0.2', raw_signal, candidate_mechanisms, evidence[], claims[], reversal_condition, next_step — "No other top-level keys." → source says: validate_finding.py requires EIGHT top-level keys, including `status` ("missing required field: status"), with status ∈ {DISCRIMINATE_FIRST, BUILD_READY, FIELD_STOP}; allowed_top additionally permits design_distinction, intervention, must_not_change, perceptual_success_criterion, gate, field_require (/home/user/Product-Perception-Sensemaking-Architect/scripts/validate_finding.py lines 150-)
- target_definition: "cpLoss = max(0, signed drop in White-relative eval across the move) from two independent Stockfish 18 Lite WASM depth-12 MultiPV-1 root searches with hash cleared per position; mat → source says: docs/MEASUREMENTS.md (section 'NOT FIXED HERE: the same defect on the import path'): "`analyzePositions` still returns `0` for a position the engine did not evaluate, so the mating move of every imported game that ended in mate is still scored as a blunder — the measurement above was taken against t (/home/user/lichess_app/docs/MEASUREMENTS.md; /home/user/lichess_app/scripts/run_import_har)
- current_bottleneck / what_repo_cannot_answer[0]: "No per-decision owner table with pre-move context exists ... not one cross-context pre-move feature can be computed or held out for the owner until th → source says: The session scratchpad already holds the rebuild: /tmp/claude-0/-home-user/ee69b5a4-c8fc-5a0f-a62b-0e04fcb5bda2/scratchpad/scored/part00..03.jsonl (~69 MB, written 12:31–12:33 today; every position of 2,161 standard games, both sides, MultiPV 3, depth 12, Stockfish 17.1 native, hash cleared, berserk (/tmp/claude-0/-home-user/ee69b5a4-c8fc-5a0f-a62b-0e04fcb5bda2/scratchpad/{scored,pipeline,)

### Killed paths inherited from the repository (do not rediscover)

| path | why | where |
| --- | --- | --- |
| Cluster-robust (sandwich) SE at the game level as the product judge | Worse calibrated in 82/84 cells at 20 games; null fire up to 3.9% vs 1.5%. 'Do not reopen by proposing cluster-robust errors again.' (Cluster bootstrap NOT killed — never measured; D02 RC4.) | docs/decisions/D02; research/discovery-oracle/results/q1_units.json; MASTER_PRODUCT_DEBT R-14 |
| Fixed effect-size floor MIN_GAP_DIFFERENCE = 0.45 | Power fell to 0 as n grew; replaced by SEPARABILITY_K × SE | shared/detector.ts header; docs/MEASUREMENTS.md |
| 'The detector finds structure in noise and needs restraining' | 0/8,000 null validated claims (upper CI 0.00048); the defect is silence, not noise | MASTER_PRODUCT_DEBT R-15; M0_AUDIT §Q4 |
| Lowering the worst-bucket bar to one SE | False-positive 6.7% vs 0.7%; refused | docs/MEASUREMENTS.md 'Is your weakest area calibrated?' |
| Searching `accurate` as the pysubgroup target with confidence as a selector | Winning region 'confidence < 5' — a restatement of the target. (Accuracy-only target with NO confidence available is not intrinsically forbidden, but is undeclared in hypothesis-manifest.) | research/discovery-oracle/q7_candidate_search.py; D04 |
| pysubgroup create_selectors (quantile cuts from the record); top-k candidate lists narrowed on validation | Makes every candidate a function of the data it is tested on; narrowing on validation is the leak the design exists to avoid | q7_candidate_search.py selectors()/search_region() |
| Predicate depth > 2 | 'every extra term multiplies the search space and buys a description no player can act on' | shared/discovery/predicate.ts MAX_PREDICATE_DEPTH |
| Renaming a validated claim to the narrower region attribution found; tightening SEPARABILITY_K to fix misattribution; reporting the interaction to the player | Post-hoc region choice on the judged data (R5); K does not touch it ('the bucket really does separate'); asks the player to do the analysis | docs/decisions/D08 alternatives 1, 3, 5 |
| Wiring the attribution veto at 20 validation games; re-choosing ATTRIBUTION_K=3.0 after the sweep | 'a wash' (7% caught for 6% withheld); choosing from the flattering sweep is the post-hoc move D08 refuses | docs/decisions/D08 DECISION |
| Relative-time buckets fast-relative <1/60 / slow-relative >1/15; moving 45 s to 5 s; per-time-control bucket sets; choosing among D05 alternatives by measuring  | REJECTED twice (0.0000; 0.0475 vs bar 0.2112); post-hoc constant; multiplies search space; four-comparison search with no correction | docs/decisions/D05-blitz-time.md; results/q8, q9 |
| Raw 45 s / 120 s cut as a representation of blitz think time; Lichess encoding sub-second edges; 'time pressure (clock %)' at 25/50/75 | 0.00 pp separation, slow bucket 0/0/2/4; sub-second edges inert on integer seconds; clock % fails its own null and is a phase ordering. Product cut nevertheless frozen ('No threshold moves') | TIME_REPRESENTATION_RESULTS.md §1–§2; research/b2/analysis.json |
| 'The confound grows with more data' (28.5% vs 17.0%); 75-game '8 of 8 cells collapse' | 117-game stratified survival 16.0%; corpus had dropped 42 rated arena games (Event-header substring bug); 3/7 cells survive | TIME_REPRESENTATION_RESULTS.md §3.2, §7; research/b2/as-published-75/ |
| Registering phase-middlegame as the owner's bucket; a fourth account window; fromPosition sensitivity check '463 decisions' | Not-separable at 2,209 (0.622 vs 0.863 pp); 'No fourth window'; the 463 rows were mislabelled standard-game decisions | ACCOUNT_BRIDGE_FULL_RESULTS.md §0–§7 |
| Native Stockfish / warm-hash runs as the product record; inferring start clock from max eligible clock; speed from the Event tag; `seconds ?? 0` for underivable | STOP-B1 (13.61% flips); understated start by up to 86 s; lost class for 1,104 games; fabricated fast-bucket decisions; post-game leakage / second definitions | ENGINE_PARITY_RESULTS.md; research/b2/analyse.py; scripts/build_import_corpus.ts; shared/detector.ts |
| Search-trajectory 'ComputationNeed' construct (rcv, convergenceNodes, moveInstability) and any 'optimal think time' output | STOP-D: no reference budget 25k–1.6M stable at 95%; reference swap flips 5.43% of labels; predictor and outcome share V_deep error; H1/H2 never run | docs/research/BLITZ_COMPUTATION_RESULTS.md §4–§11 |
| Causal reading 'thinking longer makes this player worse'; naming time residuals confusion/hesitation/indecision; 'A2 (unmeasured difficulty) is bounded/excluded | Reverse causation with difficulty (population blunder 1.55%→7.92% with think time); forbidden vocabulary; C9 not firing is not evidence against A2 | TIME_REPRESENTATION_PREREG §2.2; B3 PREREGISTRATION §9; POST_FREEZE_AMENDMENTS A5 |
| voc_z / voc_regret as an instrument for 'value of further human computation' (Time Allocation Efficiency); TAE floor as 20% relative; Metric C as independent; s | 59.4% zero mass, partial r 0.0165, budget reliability 0.62–0.64; degenerate floors; transform of Metric B; tau² clips to 0; opponent_rating ≈ rating; coupled clocks | B3 REPORT.md §5, MODEL_SPEC.md, VERDICT_RULES.md, DATA_PROTOCOL.md §4.3 |
| Frozen 180+0 nuisance models applied to 300+0 as replication | Extrapolation artefact: predicted log-time to −7.35, residual sd 5×, beta equals its destroyed-outcome null; NOT EVALUABLE (F11) | B3 REPORT.md §9; FAILURES.md F11 |
| RC-06 answer-the-mate-threat as eligible / Study D on RC-06 / repairing RC-06; RC-11 method-shaped candidate; RC-01 +0.600 as the bar; A5_beats_incumbent; b_val | Branching predicate (−0.048 symmetric, T− .994); RC-11 VACANT; RC-01 VACANT; anchors invert on xs; false alarm/false comfort; subtraction becomes a bonus on saturated cells; C/D .500 at every rung; 'asks the same broken  | D25; docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM.json forbidden_claims; C11_SCREEN.md; ANCH |
| SDT criterion c as a player parameter (H18/H19/H22) | Move-blind agent scores d′ 0.80, c +0.88 on RC-06; RC-09/RC-11 wording shifts c by +0.524 (71% geometry) | research/learning/criterion_channel.py; docs/learning-v2/CRITERION_CHANNEL.md |
| Lichess hangingPiece theme as a trigger; puzzle-derived item banks for L3+; unprotected-piece 'B = capture(target)' construct; N3 narrowing under the old name | Theme computed from the solution (B inside T); is_valid_attack range restriction; prescribed act loses ≥100 cp on 15.0% of T+; puts SEE inside the trigger | docs/measurement/FALSIFICATION_REGISTER.md F1–F9; CONSTRUCT_DECISION.md |
| RC-05 safe-promotion as an intervention/packet ('ONE THING FOR THE NEXT GAME'); opponent-pressure count as second-stage objective; system-health composite of P3 | ~4.7e-5 decisions worth changing per position; C2/C3/C4 FAIL with sign inversion; unmeasured parameter set; 'advice to play worse moves 61% of the time' without qualifier; C9 failed so gate did not open | docs/learning-v3/BARRIER_DECISION.md; PRESSURE_EXPOSURE_RESULT.md; docs/system-invariant/ADVERSARIAL |
| P4 N-of-1 as cue-specific efficacy; naive whole-account pre/post baseline for the owner; reporting in_check∧endgame (0.8400, 175 pairs) as a finding | CONTROL moved +25 pp too; account-bridge prediction failed across windows; 175 < MIN_REGION_PAIRS 200 → INSUFFICIENT | docs/system-invariant/AMENDMENT_01.md §A; PRE_EXPOSURE_BASELINE.md §2; ADVERSARIAL_PASS A-10 |
| Study 0 response-congruency; four-arm cumulative RCT; presentation improvements as a learning lever; in-game coaching; blitz as primary teacher; teaching before | 'well-designed study of the wrong question'; ~446 participants vs 8–30; H1/H10/H12/H13 REFUTED; prompt is intervention AND measurement; +0.2 d′ at zero effect; scores engine agreement not rule use (L3) | docs/decisions/D24; docs/learning/FALSIFICATION_REGISTER.md L2–L7; docs/learning-v2/FALSIFICATION_RE |
| Pre-decision probe 'Which second move were you considering?' (and any new candidate-move probe) | Encodability bias (FL-005): a cheaper randomised observation already exists (probe.assignment, legal_moves, alternative, candidate_moves_considered); reactivity unmeasured → DEFER | Product-Perception-Sensemaking-Architect/docs/FAILURE_LINEAGE.md FL-005; docs/neta/PRE_HUMAN_UX_PASS |
| New detector/bucket/threshold change; adaptive copy/coach/LLM layer; adding game_id to ScoredDecision; DeepGameFeatures as a feature source; player-relative per | Standing ACTION_PLAN refusals; 'building for an estimator this decision has just refused'; post-game with no consumers; 'leakage wearing a percentile'; INV-6/7/8 and R-03 | docs/ACTION_PLAN.md §6–§8; D02; D01; shared/blitz-features.ts; docs/blitz/ADR-001/002 |
| Editing prompts/SYSTEM.md, adding Source 29/UI/dashboard/DB/telemetry, retroactively rewriting Wave 1, single scalar confidence, >3 mechanisms | Neta freeze and contract; CI blob check; 'no numeric confidence theater'; schema maxItems 3 | Product-Perception-Sensemaking-Architect/CLAUDE.md; docs/V0_1_FREEZE.md; scripts/validate_finding.py |

### Admissible pre-move features per the repository (synthesis list; see design v1.1 for what enters the search)

- **phase** — classifyPhase(fenBefore, ply): endgame if non-pawn material (both sides, N=B=3,R=5,Q=9) <= 13; else opening if ply <= 20; else middlegame (source: shared/phase.ts; shipped bucket keys; condition_kind POSITION; caveats: Documented heuristic (η² 0.0035 vs human difficulty); the 20-pp phase spread is 'almost entirely a property of the rule'; endgame likely inflated by forced-in-all-but-name positions)
- **clockMsRemaining (own clock faced)** — clockTimes[ply−2] × 1000 — 'the clock as the player FACED it'; null for ply < 2 (source: shared/pgn-clock.ts; bucket clock-under-1m (< 60,000); condition_kind ENVIRONMEN; caveats: Berserk games wrong by half at ply 2/3 (146 owner-berserk games, no handling); time buckets read only the dominant speed; not collectible in the live loop (LIVE_DECISION_CARRIES_CLOCK=false); validati)
- **opponentClockMsRemaining; clockBalanceMs; clockShare** — clockTimes[ply−1] × 1000; own − opp; own/(own+opp) (0.5 level) (source: shared/pgn-clock.ts; shared/blitz-features.ts (BLITZ_FEATURE_VERSION 1); caveats: Derivable but NEVER written to any evidence row or scored corpus; must be declared under a FeatureSpec first)
- **clockRemainingFraction / clock_pressure** — clockBefore / initialMs (B2 'time pressure' cut 25/50/75); B3 clock_pressure = −log(clock_frac + 0.01) (source: shared/blitz-features.ts; research/b2/analyse.py; B3 clock_features; caveats: Denominator must be the PGN TimeControl header (not max eligible clock); B2 cut fails its own null and is a phase ordering; region below 25% 'unmeasured, not ruled out')
- **timeControl {initialMs, incrementMs}; speed** — Parsed [TimeControl base+inc]; API `speed` field (blitz/rapid/bullet/…) (source: shared/pgn-clock.ts; scripts/build_account_corpus.ts; caveats: VALIDATION_ONLY under D03 (decides eligibility, never membership); INV-8: 3+0/3+2/5+0/5+5 are four environments; two 'blitz' definitions coexist (B2 header rule vs API field))
- **standing** — Mover-relative eval of the position faced: winning >= +100 cp, losing <= −100 cp, else level (source: shared/import-diagnostic.ts CLEAR_EDGE_CP; IMPORT_BUCKETINGS; classified POSITIO; caveats: Engine-derived at depth 12 (72/1,587 rows changed standing between engines); import-only, cannot be registered for the live loop (R3))
- **evalBeforeCp / wp1 / edge / n_near / gap12 / gap1k / ambiguity_entropy / is_mate_line** — Pre-move search quantities: wp1 = win probability of best line; edge = |wp1 − 0.5|; gap12 = wp1 − wp2; n_near = lines within 0.02761 of best; entropy of softmax((wp − wp1)/0.02761) (source: B3 src/position_features.py (MultiPV 4, 60k nodes); system-invariant score_natur; caveats: Require a MultiPV search — NOT available from the owner's existing MultiPV-1 depth-12 run; population-only today; engine information the player never sees (never a human-observable cue))
- **best_move_changes / eval_volatility / pv_instability / final_depth / nodes_to_depth10; voc_switch / voc_regret / voc_drift / voc_rank** — Engine search-complexity and shallow-vs-deep (D_SHALLOW 8) trajectory features of the pre-move position (source: B3 src/position_features.py, value_of_computation.py; caveats: 'ENGINE search complexity, never human cognitive complexity'; VoC features budget-unstable (0.49–0.64) and killed as an allocation instrument; RCV-style features share V_deep error with the outcome (S)
- **ply / move_number; game_id; colour (side)** — Half-move index; Lichess game id; owner's colour (source: shared/import-diagnostic.ts; research/b2/build_corpus.py (_colour, internal only; caveats: No game or ply selector exists in the search vocabulary (one-game-only and every-game-first-moves plants at 0.0000); colour never analysed in any owner report; game_id is dropped by scoreDecisions)
- **legal_moves; in_check; non_pawn_material; material_balance; piece_count; n_legal_captures; n_checks_available; n_mate_in_1; n_forcing_moves; halfmove_clock; fullmove_number** — Board-only counts on fenBefore (predicates.py::position_features; minimal_twins.py::covariates) (source: research/measurement/predicates.py; research/learning-v3/minimal_twins.py; scrip; caveats: Not computed in the owner import path (only forced = exactly one legal move); exchangeability covariates with '[NO JUSTIFIED THRESHOLD]' for SMD)
- **book; forced** — isBook: FNV-1a(positionKey) ∈ 833 keys (positions reached by >= 0.1% of 2026-03 games within 30 plies); forced: exactly one legal move (source: shared/opening-book.ts; shared/import-diagnostic.ts onlyLegalMove; caveats: Exclusions, not features (owner: book 6,213, forced 325); 'forced-in-all-but-name' recaptures are still counted)
- **ECO / opening name / opening.ply; ratings (own, opponent, rating_diff); berserk flag; arenaTour** — Game-level context from the API JSON and PGN tags ([ECO], [Opening], [WhiteBerserk]/[BlackBerserk]) (source: scratchpad/account/frozen_2209.ndjson; client/src/lib/lichess-public.ts (opening; caveats: Present in raw data, never reach ImportedDecision or evidence rows; opening/material/colour belong to D17 (DEFER); opponent_rating ≈ rating (B3 R5) — use rating_diff)
- **prev_move / prev_was_capture (Context)** — The opponent's last move, available before the player's turn (C1-admissible) (source: research/measurement/rule_classes.py Context; caveats: Must be passed as a parameter; RC-02 recapture depends on it)
- **Rule-class trigger_state (RC-00..RC-21, 17 classes) and prescription_size** — trigger(board, ctx) → positive|negative|None from the board alone; share of legal moves satisfying B (source: research/measurement/rule_classes.py; GATE-CUE-PLAYER-OBSERVABLE (scripts/cue-sc; caveats: Only classes with a MEASURABLE noise cell (RC-00,02,03,04,05,13,21) carry information; RC-06/RC-12 predicates branch on the trigger; T+ and T− not exchangeable (max |SMD| 0.573))
- **OwnExposure pre/post/delta and the 24 P3 relational counts (attack_edges, support_edges, hanging_*, overloaded, redundantly_defended, pinned, king_ring_*), L descriptors, mobility, material_post** — Board-only state before the move and one-ply hypothetical after each candidate move (no engine, no opponent reply) (source: research/learning-v3/p3_system_invariant.py side_piece_metrics; research/system-; caveats: Population-licensed direction only for post_own_overloaded_piece_count within valid actions; opponent-pressure count inverts; 'Does not establish that humans naturally perceive these variables'; the O)
- **secondsTaken / log_time / unexpected_time (NOT pre-move — listed to fix its status)** — clockTimes[ply−2] − clockTimes[ply] + increment; the decision's own duration; B3 residual against frozen T2R models (source: shared/pgn-clock.ts; B3 MODEL_SPEC §2; caveats: Known only at commit; admissible as a behavioural covariate/stratifier of what the player DID, never as pre-decision information; difficulty-confounded; berserk inflates first derivable value by base/)
- **stated read / confidence / candidate_moves_considered / probe fields (product record only)** — Pre-reveal player statements and the randomised post-commit alternative-move probe (source: shared/decision-atom.ts; STRONGEST_PERMITTED_CLAIM.json production_record_conten; caveats: Absent from all Lichess-imported games (owner has recorded zero live decisions); confidence is 'half the target' and never a selector; a ledger key named 'confidence' is rejected by the Neta validator)

### What the repository cannot answer (and therefore what this mission must build)

- Any per-decision or cross-context (opening × colour × material × clock) fact about the owner: the ~59k per-decision rows are gitignored and absent from disk; what was dumped carried only phase, secondsTaken, clockMsRemaining, cpLoss, accurate, standing, forced, book, speed — no fenBefore, move, eval, colour, ECO, rating, opponent clock.
- Whether the owner's think-time gradient survives a per-decision difficulty control finer than phase × standing; whether it is player-specific beyond the population shape (no matched population baseline for the owner's bands).
- The ICC of the owner's accuracy/gap at the game level (never measured; clustering.ts read by nothing); therefore whether decision-level SEs hold on a 2,209-game record (D02 RC2 fired).
- Which search depth a real record resembles (D04 depth trade) — 'cannot be answered from planted worlds'; the real-corpus false-claim rate of the search (D04 RC1); whether Jaccard ≥ 0.60 is doing the work (per-record distribution not stored).
- Whether accuracy-worst = calibration-worst for this player (bridge assumption never checked); anything about the owner's calibration gap (zero live decisions with confidence).
- Whether any board-derived cue (OwnExposure, rule-class triggers) is a player-specific mechanism for the owner: every such result is population-only, and the owner has already been exposed to the OwnExposure cue.
- Human-perceived difficulty (A2) and reactivity of any pre-move probe — 'touched by no measurement here'; whether an authored cue is focal.
- Whether an operation changes the owner's next game: L5/L6 require games played after a frozen manifest; only 12 post-freeze admissible blitz games exist and they are post-exposure for the OwnExposure cue.
- The true per-game opportunity rate of any trigger scanning every ply (never measured — 'no field protocol can size itself without it').
- Whether any of this is separable from general chess strength (D25 unresolved 'domain').
- Engine comparability across the owner's depth-12 WASM labels, B3's 60k-node SF 17.1, and learning-v3's 200k-node SF 17.1 — R-03 refuses pooling; no stated bridge exists.
- Whether the 724 time-forfeit games (excluded by admissible()) change any clock-related finding; whether the 4 slow-over-2m rows are berserk artefacts.

### Neta compliance requirements for the final finding

- The mission ledger must be a contract_version '0.2' finding that passes scripts/validate_finding.py: raw_signal in the owner's words; at most 3 candidate_mechanisms each with explains / does_not_explain / discriminator; evidence[] typed OWNER_SIGNAL / REPO_MEASUREMENT / RESEARCH_SOURCE / ENVIRONMENT_CHECK / FIELD_OBSERVATION with reality_level; claims[] with exactly the ten fields (id, kind, statement, resolution_authority, required_reality, observed_reality, evidence_refs, state, requested_use, permission); reversal_condition; next_step. No other top-level keys.
- No key named confidence, confidence_score, certainty or probability at any depth; held-out AUC / log-loss / stability numbers go into evidence.description text or a separate research artifact referenced by an evidence item.
- Level mapping: L0/L1 = OBSERVATION claims, authority REPO, requested_use HYPOTHESIZE/DISCRIMINATE; L2/L3 = one MECHANISM claim that may be SUPPORTED only if observed_reality >= the floor its statement names, with held-out and resampling artifacts as REPO_MEASUREMENT evidence; L4 = INTERVENTION claim, authority OWNER, requested_use BUILD_REVERSIBLE/PROTOTYPE; BUILD_READY additionally needs intervention, design_distinction, gate.falsifier, gate.positive_control, reversal_condition, must_not_change; L5 = a frozen pre-field record (case_id, exact version, predicted observable outcome, smallest discriminator, population boundary, success criterion, reversal criterion, reactivity risks) with the OUTCOME claim at INSUFFICIENT_REALITY/UNRESOLVED and permission DENY or DEFER; L6 = OUTCOME claim SUPPORTED at observed_reality >= R6 (the validator forces authority FIELD).
- ASSERT_FIELD_OUTCOME may never be ALLOW below R6; a waiver (OWNER only) can accept risk but cannot upgrade evidence/reality/authority; intervention and measurement may not change silently together (must_not_change).
- Population evidence (B3, system-invariant, learning-v3, 2013 corpus, six-player record) is RESEARCH-like: it may inform but never close a player-specific claim (law 8 / CF8 authority laundering). Separate population from owner evidence in the evidence list and never pool depth-12 owner labels with 60k/200k-node population labels (R-03).
- Do not reproduce any of the 18 forbidden sentences in docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM.json; any 'same mechanism' claim must show a non-degenerate T− cell (C11 MEASURABLE) and escape the response-bias/conditional-discrimination identifiability trap (C/D .500).
- Pre-move features must obey D01 (observed_at <= commit_timestamp; missing = null) and D03 (declared FeatureSpec with role, condition_kind, discovery_eligible with a written argument; TARGET and VALIDATION_ONLY never in a predicate); leakage tests in the B3 style (played-move swap; game-suffix replacement) before a search reads a new feature.
- Any new probe/feature/model must pass the encodability gate in writing (live claim, owning authority, information bought, cheaper admissible observation, contamination, removal condition); 'we can build it' = DEFER (FL-005 is literally the chess second-move probe).
- Historical decisions are history: no retrospective case may be relabeled prospective (DQ1); the prospective test must be frozen (hash, verify_freeze.py-style) before the games it scores are played; success criteria may not be rewritten after results.
- Record new failures in docs/FAILURE_LINEAGE.md before hiding them with a rule (berserk clock defect; time-forfeit exclusion; evidence-row absence); repair at the lowest capable layer.
- Vocabulary hygiene: the mission's L0–L6 collides with tests/LEVELS.md L1–L6 and with E1–E7 and R0–R6; the ledger must name its ladder explicitly and never map levels one-to-one.
- Owner exposure: any test of the OwnExposure cue on games after 2026-09-02T16:16Z is post-exposure; the ledger must state this and the frozen PRE_EXPOSURE_BASELINE design (recent-300 blitz, policy_consistency separate from quality_loss) if that cue is ever a candidate.
- Stop rule: once held-out and resampling (REPO) are exhausted, whether the operation changes the next game belongs to FIELD/OWNER — route or stop rather than build.

## Design v1.1 (amendments after Node A review, before any run on the real target)

| change | reason | source |
| --- | --- | --- |
| `seconds` (the decision's own think time) removed from the OBS vocabulary; searched only in a separately declared at-commit vocabulary `TIME`, diagnostically; stays in the baseline as a covariate | known only at commit; a property of the decision process, not of the pre-move state (verifier 3; synthesis feature row) | `analysis/vocab.py` |
| depth 3 allowed in the search only as a diagnostic; a candidate that needs three terms cannot be the product mechanism unless it collapses to ≤ 2 terms with Jaccard ≥ 0.60 | the repository's predicate contract caps depth at 2 ("a description no player can act on") | `shared/discovery/predicate.ts`, killed path |
| final-candidate rule: the highest-DERIVE-quality candidate among those that pass the VALIDATE judge; if several vocabularies pass, OBS wins over OBS+ENG over TIME; no choice by VALIDATE effect size | top-k narrowed on validation is a killed path | D04, `q7_candidate_search.py` |
| engine-artifact control: the whole personal corpus is re-scored under the shipped engine (Stockfish 18 Lite WASM, depth 12, MultiPV 1, hash cleared); a frozen candidate must keep its VALIDATE contrast sign and clear z ≥ 2 under the shipped labels | 13.61% verdict flips between engines (`ENGINE_PARITY_RESULTS.md`) | `pipeline/score_games.py --engine wasm` |
| terminal positions: checkmate scored as −10,000 for the mated side, so a mating move costs 0 | the product's import path scores the mating move of every mated game as a blunder (`MEASUREMENTS.md` "NOT FIXED HERE"); this pipeline does not reproduce that defect and says so | verifier 3 |
| berserk: the berserking side's initial clock is halved and its increment removed (both sides handled) | the product's PGN clock path has no berserk handling (146 owner-berserk games, 133 opponent-berserk) | verifier 3, `pgn-clock.ts` |
| corpus limitation recorded: 724 time-forfeit and 124 abandoned games are excluded by the product's admissibility rule; clock-pressure findings are conditional on games that ended normally; the by-username export is unavailable so the excluded games cannot be recovered now | `build_account_corpus.ts` | ledger |
| owner exposure: on 2026-09-02 (bracket 16:16–16:36 UTC) the owner read a sentence about the OwnExposure cue (`docs/system-invariant/PRE_EXPOSURE_BASELINE.md`); any candidate about hanging/overloaded pieces is post-exposure on games after that bracket (10 of the 12 post-freeze games) | contamination rule for Node K/L | verifiers 1–3 |
| game-level ICC of `err` is computed and reported (D02 reversal condition 2 fired: the record exceeds 50 games) | the SE regime must be stated on a 2,161-game record | D02 |
| authority mapping for this mission's ladder: L0–L1 OBSERVATION (REPO); L2–L3 MECHANISM (REPO, observed reality = retrospective natural-play log); L4 INTERVENTION (OWNER); L5 frozen pre-field record; L6 OUTCOME (FIELD, R6: the owner's new games under a frozen manifest) | validator forces every OUTCOME claim to FIELD/R6 | `validate_finding.py` |

## Design v1.2 (before any VALIDATE judging; after a timing run that exposed the DERIVE search result)

**Disclosure.** At 13:20 UTC a timing run of the residual OBS search on DERIVE (design v1.1) printed
its top candidates at depths 1–3. No VALIDATE or TEST row was read. The result is preserved in
`nodeB/timing_peek.txt`. Nothing below was chosen because of it except the shared-noise rule, which
the peek made visible and which is a leakage rule, not a tuning.

| change | reason |
| --- | --- |
| `eval_trend_2ply` (and every feature computed from the evaluation of the pre-move position: opponent's last-move loss, best-move gap, ambiguity, edge, volatility) moved out of OBS into ENG, diagnostic only | such a feature shares the pre-move evaluation's noise with the target (cpLoss = eval_before − eval_after); conditioning on a favorable "swing" selects positive noise and inflates measured loss (winner's curse). The B3 study flagged the same coupling for `wp1`. A region that needs one of them must survive a deeper re-evaluation of its decisions and matched controls |
| `standing` stays in OBS as the product's own coarse three-way cut, but a candidate that uses it is subject to the same deeper re-evaluation control | canonical bucket; coarse selection |
| history features from EARLIER positions only (`own_prev_wp_loss`, `plies_since_own_error`, `own_errors_so_far`) stay in OBS: they use evaluations of positions i−2 and i−1, never of position i | independent of the target's noise |
| added observable history: `material_change_2ply`, `own_lost_material`, `own_won_material` (material balance now minus at the player's previous decision) | a player can see that material changed; an engine-scored "previous error" cannot be the trigger wording |
| think time clamped at zero before use | the product clamps (`Math.max(0, ...)`); Lichess lag compensation makes a few clocks rise |
| Node G control added: deeper re-evaluation (depth 20) of the frozen region's decisions and a matched sample; the contrast must keep its sign and at least half its size | engine-evaluation artifact |

## Design v1.3 (forced by the null control, before any VALIDATE judging on the real target)

**What fired.** The Node B harness, raw target, depth 1, validated **69 of 100** within-game shuffled
nulls (`nodeB/null_failure_v12.txt`). The shuffle keeps every game's own error rate and destroys only
decision-level structure, so a chain that still validates is finding game composition: a region such
as `own_errors_so_far ≥ 6` or `speed == bullet` selects games that carry more errors, and a
between-game contrast cannot tell that from a mechanism inside decisions.

| change | reason |
| --- | --- |
| search target = residual demeaned WITHIN game (`err_resid_wg`); raw secondary = `err_wg` | a region can score only by decision-level structure inside games |
| judge = game-fixed-effects contrast on VALIDATE: per game d_g = error inside − outside, weight n_in·n_out/(n_in+n_out), games are the independent units; z ≥ 3.5 and n_in ≥ 100 | game composition cancels by construction; the within-game shuffle is then the right null for this judge |
| between-game contrasts reported beside, never deciding | the product's own reading, kept for continuity |
| regions that occupy whole games (time control, colour, opponent) are invisible to the judge by design | they are contexts, not decision mechanisms; they remain Node G strata |

## Node E — feature admissibility (executed 2026-09-05 14:50 UTC)

| check | result |
| --- | --- |
| played-move swap (B3 `test_leakage` style): every non-`y_` column bit-identical after replacing the played move by another legal move | 0 violations, 120 decisions, 40 games (`analysis/test_leakage.py`) |
| game-suffix replacement: every non-`y_` column bit-identical after truncating the game right after the decision | 0 violations |
| shared-evaluation-noise rule (v1.2) | engine-derived pre-move features excluded from the OBS vocabulary |
| think time (at-commit) excluded from OBS (v1.1) | searched only in `TIME`, diagnostically |
| ported construct equivalence: `system_state` vs `research/learning-v3/p3_system_invariant.py` | 0 mismatches on 278 positions × 2 actors |
| canonical counts | 59,419 scored, 52,881 eligible, 325 forced, 6,213 book: identical to `harness-account-full/prereg_report.json` |
| canonical bucket ordering under the research engine | same order as the shipped-engine reading (endgame highest, middlegame lowest); levels ~5–10 pp lower because Stockfish 17.1 native is stronger than the WASM lite build |

## Design v1.4 (after the first DERIVE freeze under v1.3; VALIDATE still unread)

**What was seen.** The v1.3 residual OBS search froze, at depth 2 (Node C: held-out within-game z
2.29 / 5.63 / 4.43 for depths 1/2/3), three DERIVE candidates (`nodeB/discovery_v13_derive_only.log`):
`n_good_captures<1 AND standing=='winning'` (n 7,081, within-game +8.1 pp), `own_errors_so_far<6 AND
recapture_available==0` (n 11,928, +10.5 pp), `opp_hanging_piece_count<1 AND standing=='winning'`
(n 8,361, +7.2 pp). Each is the complement of an easy situation (free material to take, a recapture
to make). Their elevation is at least partly "everything else is harder than taking free material",
which is a simpler alternative the baseline must absorb. The run was stopped before VALIDATE was
judged; no VALIDATE or TEST number has been read.

| change | reason |
| --- | --- |
| baseline gains three engine-free EASE covariates: `free_capture` (a capture with positive static exchange exists), `recapture_available`, `opp_hanging_any`. Threat indicators (own hanging/overloaded pieces, king-ring attacks) stay out of the baseline | a mechanism must beat "there was free material to take"; it must not be denied the chance to be a threat-response structure |
| judge: the deciding statistic is the within-game contrast of the baseline residual (z ≥ 3.5, n_in ≥ 100) with the raw within-game contrast required positive | excess error beyond generic difficulty, time, context and ease, inside games |
| retrieval: the search keeps 40+ candidates before the size cap; beam width ≥ result set | a depth-1 sweep whose best selectors are oversized returned nothing under v1.3 |

## Merge note — 2026-09-05 15:00 UTC

`origin/main` advanced to `f53ade806c567d595fdc0e85da38a1d155277fbb` (PR #88, macro UI audit under
Neta v0.2: record/reveal/bank repairs, findings N-7..N-11, `docs/neta/PRE_HUMAN_UX_PASS_4/5.md`).
Merged into this branch as `d7f118d`. None of the definitions this mission ports changed
(`shared/phase.ts`, `shared/win-probability.ts`, `shared/detector.ts`, `shared/import-diagnostic.ts`,
`shared/opening-book*.ts`, `shared/pgn-clock.ts`, `client/src/lib/engine-line.ts`: empty diff;
`MATE_SCORE` still 10000). PR #88 also records that its own nine falsification agents died on a
session limit and that a green gate is not evidence it discriminates its rule: both are risks this
mission carries too, and the second is exactly what design v1.3–v1.5 below is about.

## Design v1.5 (null control repaired for label-derived history features; VALIDATE still unread)

**What was seen.** Under v1.4 the depth rule chose depth 3 (held-out within-game z 1.65 / 3.15 /
4.36) and every frozen DERIVE candidate used `own_errors_so_far ∈ [1,3)`
(`nodeB/discovery_v14_derive_only.log`; within-game +20 to +22 pp on DERIVE). The run was stopped
before VALIDATE. The Node B null had shuffled the target inside games but left the label-derived
history features (`own_errors_so_far`, `plies_since_own_error`, `own_prev_wp_loss`,
`own_error_rate_so_far`) computed from the REAL labels, so it could not test whether a partition of
the game by the player's own error events produces elevation under independence. The v1.3 Node B
partial results are archived as `results/nodeB_v13_stalehistory/` and are valid only for features
that do not read earlier labels.

| change | reason |
| --- | --- |
| the null and every planted world shuffle the outcome tuple (`err`, `y_wp_loss`) within game and then RECOMPUTE the four history features from the shuffled labels before searching | a history feature must face a null in which it is a function of independent outcomes |
| the same recomputation is applied to bootstrap resamples (labels are real there; features unchanged) | no change needed; recorded for completeness |
| depth 3 remains diagnostic; a depth-3 candidate must collapse to a 2-term sub-conjunction with Jaccard ≥ 0.60 on DERIVE to be frozen for VALIDATE | v1.1 rule, now operational in code |

## Node B verdict rule (written before the v1.5 harness results are read)

At the depth the Node C rule later chooses (and at depth 2, the product cap):

- **null ceiling**: W5-null validated rate ≤ 0.02 (100 draws) for both search targets;
- **expressiveness**: W2 (interaction) and W3 (cross-context conjunction) recovered on target
  (Jaccard ≥ 0.60 on VALIDATE) in ≥ 0.50 of draws at depth 2; W1/W7 (single feature, equivalent
  descriptions) ≥ 0.80 at depth 1;
- **misattribution**: W4 (truth outside the vocabulary) validated in ≤ 0.10 of draws; every
  validation there is a wrong sentence, and this rate is carried into the ledger as the chain's
  known misattribution risk;
- **weak effects**: W1w/W3w (+0.08) recovery is reported, not judged.

PASS on all three bullets → the existing search (D04's oracle, widened vocabulary, within-game
judge) can express a cross-context personal pattern and Node C's depth rule stands. FAIL on the
expressiveness bullet → Node F (external representation search). FAIL on the null bullet → the
judge, not the vocabulary, is the defect.

## Design v1.6 (null repaired again; VALIDATE still unread)

**What fired.** Under v1.5 the raw pipeline validated **72 of 100** nulls at depth 1, and 64 of them
were `plies_since_own_error>=6` (`results/nodeB_v15_hypergeom/`). The v1.5 null permuted labels
within a game WITHOUT replacement: after a run of accurate decisions the remaining error quota is
denser, so a sequence feature validates on pure noise (hypergeometric dependence). The v1.5
discovery run froze three DERIVE candidates, all on `own_errors_so_far`
(`nodeB/discovery_v15_derive_only.log`); it was stopped before VALIDATE.

| change | reason |
| --- | --- |
| null = inside each game, outcomes drawn i.i.d. Bernoulli at the game's own error rate, losses drawn from the label class, history recomputed | independence is the null a sequence feature must beat; a permutation is not independence |
| engine-scored history (`own_errors_so_far`, `plies_since_own_error`, `own_prev_wp_loss`) moved from OBS to a diagnostic vocabulary `HIST` | a player cannot evaluate "you just erred" at the board; a trigger must be observable. Observable history (material changed since the previous decision, material lost) stays in OBS |
| baseline: time in game as five ply bins beside the linear term | a within-game non-stationarity must not be read as a sequence mechanism |
| what the i.i.d. null already shows on the real record: P(error \| ≥ 6 plies since the last error) is 0.347 vs 0.488 elsewhere on the real record and 0.389 vs 0.474 under the null, i.e. accuracy streaks are longer than independence predicts | recorded as an L0 signal about sequential dependence, to be read through the HIST diagnostic search, never as a mechanism |

## Node B — verdict (v1.6 harness, i.i.d. null, OBS vocabulary; raw target complete at depths 1–2, residual at depth 1; remaining cells fill in `nodeB/nodeB_OBS_*.json`)

| bullet | result | verdict |
| --- | --- | --- |
| null ceiling | raw: 0/100 at depth 1 and 0/100 at depth 2; residual: 0/100 at depth 1 | PASS |
| expressiveness | W1 simple 1.00 on target (depth 1); W3 cross-context conjunction 1.00 (J 0.94) at depth 1 (its two terms are individually strong) and 1.00 at depth 2; W2 interaction 0.00 at depth 1, 1.00 at depth 2 (v1.3 harness); W7 equivalent descriptions 1.00 | PASS |
| misattribution | W4 truth outside the vocabulary: validated 0.00–0.10 across harness versions (never on target) | PASS, risk ≤ 0.10 recorded |
| weak effects (+0.08) | W1w 0.95–1.00, W3w 1.00 (J 0.94) | high power at 31,851 derivation decisions |

**Node B = PASS.** D04's oracle with the widened vocabulary and the within-game judge can express and
recover a cross-context conjunction. Node C's depth rule stands.

## Node C/D/H(precursor) — OBS vocabulary, residual target, design v1.6 (`nodeB/discovery_v16_OBS_resid.json`)

| step | result |
| --- | --- |
| Node C depth CV (held-out within-game z of the residual contrast) | 1: 1.71 · 2: 2.13 · 3: 2.86 → depth 3, collapsed to 2 terms |
| frozen | `material_change_2ply>=-1 AND opp_last_capture==1` (n 5,343 on DERIVE; three candidates collapse to the same region) |
| Node D stability (50 game-level bootstraps) | 22% of bootstrap winners share Jaccard ≥ 0.60 with the frozen region; median J 0.14; winners scattered over eight regions |
| VALIDATE (opened once, for the frozen region) | n_in 1,734; raw within-game contrast −3.0 pp (z −2.21); residual within-game z +2.66 → **FAIL** (bar 3.5 and positive raw contrast) |

**Result: under the strict observable vocabulary nothing reaches L2.** What died: the idea that a
depth ≤ 2 conjunction of engine-free, player-observable pre-move features carries an excess-error
region large and stable enough on this record. What survived: the pipeline (nulls hold, planted
truths recover), and the derivation-side signals below, which name where the structure is.

**What the derivation half says (DERIVE only, diagnostic, no permission attached).**
- Sequence: after an own error the next decisions err more than independence and the baseline
  predict (HIST vocabulary, DERIVE: `own_prev_wp_loss>=0.10` within-game +6.6 pp, z 7.7;
  `own_errors_so_far in [1,3)` +7.4 pp, z 8.8). Not observable at the board; L0 signal.
- Engine situation: the v1.1 timing peek found `eval_trend_2ply>=100 AND n_good_captures<1`
  (the opponent just erred, no free capture); shared-noise contaminated until re-evaluated deeper.

**Next branch (Node E → the target, not the vocabulary).** A single error indicator pools
different acts. Holding the response predicate constant (D25) means asking, per error class, which
pre-move condition predicts THAT omission: hung material, missed material, missed mate, missed
check, allowed a check tactic, bad capture, quiet error. The classes are post-move and descriptive;
the trigger stays pre-move and observable. One feature pass, no new engine compute.

## Design v1.7 — error-class targets (declared before any class run is read)

| item | frozen value |
| --- | --- |
| classes (post-move, descriptive, computed from the position after the move and the next ply's already-scored engine lines) | `hung_material` (the engine's reply wins material with positive static exchange), `missed_material` (a winning capture existed and was not played), `missed_mate`, `missed_check` (the best move was a non-capturing check), `allowed_check_tactic` (the reply is a check and the move cost), `bad_capture` (a capture with negative static exchange), `quiet_error` (none of the above); plus `tactical` = union of the first six |
| targets | `cls_<class>` = 1 iff the decision is an error of that class; 0 on accurate decisions and on errors of other classes |
| search / judge / vocabulary | unchanged from v1.6 (OBS, residual within game, z ≥ 3.5, n_in ≥ 100, raw within-game contrast > 0); baseline fit per target |
| null | i.i.d. Bernoulli at the game's own class rate, 30 draws per class at depths 1 and 2 |
| multiplicity | eight targets × three frozen candidates; the final-candidate rule (highest DERIVE quality among those that pass) applies across classes; family-wise false-claim rate is bounded by the per-class null and by z ≥ 3.5 |
| why | a single error indicator pools different omitted acts; holding the response predicate constant (D25) is what lets a region name the distinction a player omits, and the operation that restores it |

## HIST diagnostic (engine-scored own history; not a trigger vocabulary) — `nodeB/discovery_v16_HIST_resid.json`

| frozen (depth 1 by CV) | DERIVE within-game | VALIDATE raw within-game | VALIDATE residual within-game z | verdict |
| --- | --- | --- | --- | --- |
| `own_errors_so_far ∈ [1,3)` | +7.4 pp, z 8.8 | +6.5 pp, z 4.71 (n_in 1,783) | 2.65 | FAIL the 3.5 bar; stable (20/20 bootstrap winners) |
| `own_prev_wp_loss ≥ 0.10` (previous decision was a blunder) | +6.6 pp, z 7.7 | +5.5 pp, z 3.72 | 0.41 | the baseline explains it: after a blunder the position itself is different |
| `own_errors_so_far ∈ [3,6)` | +6.2 pp, z 8.3 | +9.0 pp, z 7.12 | 2.99 | FAIL the bar, narrowly |

**Reading (L1 signal, no permission attached).** The player's errors cluster inside games more
than independence predicts, replicated on games never used to find it, in both colours and every
opening family by construction; most of the clustering is what the baseline already predicts from
the position and the clock, and what remains is below the bar. Not a trigger: the player cannot see
"errors so far".

## Final-candidate rule for class targets (declared 15:50 UTC, before any sub-class run is read)

Quality values are not comparable across targets with different base rates. The final candidate is
therefore the passing candidate of the UNION class `tactical` with the highest DERIVE quality;
sub-class results (`hung_material`, `missed_material`, …) are reported as refinements of the same
trigger and never replace it. Under this rule the frozen candidate is

    R* = material_balance >= -2 AND own_overloaded_piece_count >= 1      target: cls_tactical

(`nodeB/discovery_v17_cls_tactical.json`). TEST is opened once, for R* only.

## R* — results on VALIDATE and TEST (target `cls_tactical`; files in `nodeB/`)

**Node C.** Depth by CV inside DERIVE: 1: 5.88 · 2: 6.81 · 3: 5.83 → depth 2.

**Frozen on DERIVE** (31,851 decisions, 1,297 games, 2021-04 → 2025-01): R* = `material_balance >= -2
AND own_overloaded_piece_count >= 1`, n 8,635 (27% of decisions, 6.7 opportunities per game);
tactical-error rate 24.6% vs 13.9%; within-game +11.2 pp (z 20.0).

**Node D — stability.**
- 30 game-level bootstraps of DERIVE: winner = R* in 15, its sibling `n_good_captures<1 AND
  own_overloaded_piece_count>=1` in 10, `material_balance:[0,3) AND own_overloaded…` in 3; every
  winner carries the core term `own_overloaded_piece_count >= 1`.
- leave-one-context-out re-derivation (`stability_loco_tactical.json`): dropping any opening
  family, either colour, the opening or the endgame, rapid, ultrabullet or any year returns R*
  exactly (Jaccard 1.00); dropping bullet, or halving DERIVE (older half, newer half, random halves)
  returns a sibling with the same core term and a different qualifier (J 0.45–0.54).
- verdict: the core term is invariant; the qualifier (not down material / no free capture / small
  material edge) is not uniquely identified. The mechanism's identity does not depend on one opening,
  colour, phase or historical slice.

**VALIDATE** (10,626 decisions, 432 games, 2025-01 → 2025-11; opened once for the three frozen candidates):

| region | n_in | tactical error in / out | within-game | residual within-game z | pass |
| --- | --- | --- | --- | --- | --- |
| R* | 2,937 | 25.7% / 13.8% | +11.5 pp, z 11.24 | **8.56** | yes |
| `n_good_captures<1 AND own_overloaded_piece_count>=1` | 2,208 | 22.5% / 15.7% | +5.6 pp, z 5.14 | 6.82 | yes |
| `material_balance:[0,3) AND own_overloaded_piece_count>=1` | 1,326 | 27.2% / 15.7% | +11.8 pp, z 7.76 | 6.47 | yes |

Neighbouring definitions on VALIDATE (robustness, not selection): `own_overloaded_piece_count>=1`
alone +8.7 pp (residual z 6.26); `own_hanging_piece_count>=1` (an attacked piece with no defender)
+6.8 pp (z 4.22); `own_attacked_piece_count>=1` (any attacked piece) residual z 2.72. The
distinction that carries the effect is attackers exceeding defenders, not attack as such.

**Node G — cross-context on VALIDATE** (`invariance_tactical_validate.json`): the raw elevation has
the same sign in every stratum with enough decisions: opening families A +10.6 / B +11.4 / C +11.7 /
D +15.1 pp; Black +11.3 / White +12.3; opening +16.7 / middlegame +9.6; blitz +12.1 / rapid +10.4;
level +15.3 / losing +13.1 / winning +9.0; clock ≥ 60 s +11.7, 30–60 s +12.5, < 30 s +15.3; full
material +13.1 / reduced +6.6; after an opponent capture +12.9 / after a quiet move +11.7.
Residual z ≥ 4 in every stratum with n_in ≥ 600. No stratum carries the effect alone.

**Node H — TEST** (10,404 decisions, 432 games, 2025-11 → 2026-08; opened once, for R*):
`predict_tactical_test.json`. Region n_in 2,812; tactical error 24.1% vs 13.6% (z 10.6). Observed
minus baseline-predicted rate: +4.5 pp inside vs −2.9 pp outside (z 7.78). Held-out log-loss /
AUC: history-only 0.4467 / 0.500; six buckets 0.4451 / 0.533; context 0.4454 / 0.538; difficulty
baseline 0.4237 / 0.664; baseline + R* **0.4190 / 0.682**; context + R* 0.4382 / 0.600. The
region's gain over the baseline (+0.0047) exceeds every one of 200 within-game label shuffles (max
−0.0009): shuffled p = 0.000.

**Level reached: L2 (predictive candidate) with L1 (cross-context) and the stability half of L3.**
Still open before L3 is complete: engine-artifact control under the shipped engine; personal-versus-
population comparison.

## Node I — what is omitted inside R* (DERIVE only, descriptive; `nodeB/omitted_check_tactical.json`)

Inside R* on DERIVE (8,635 decisions): the played move leaves the under-defended piece still
under-defended in 69% of tactical errors and 78% of hung-material errors, against 45% of accurate
decisions; the engine's reply captures that very piece in 54% of tactical errors (77% of
hung-material errors) against 21% of accurate decisions. Conditioning on what the move did with the
piece (post-move, so descriptive only):

| the move… | n | tactical-error rate |
| --- | --- | --- |
| left the piece under-defended (neither moved nor covered it) | 3,887 | **33.4%** |
| moved it | 3,136 | 18.6% |
| covered it without moving it (defended, blocked, or answered with a stronger threat) | 1,612 | 15.1% |

Error classes inside R*: hung material 34% of errors (19% outside), quiet errors 49%.

**Permitted wording (Node I).** In decisions where one of your pieces has more attackers than
defenders and you are not already behind by more than two pawns, your probability of a tactical
error (most often losing that piece to the reply) is elevated by about 11 points within the same
games, beyond what position difficulty, time, context and available free material predict, on games
never used to find the region (VALIDATE) and again on the newest 432 games (TEST). The omitted step
is specific: the move commits without resolving the under-defended piece. Not permitted: "tunnel
vision", "you do not see attacks", "you calculate less", any statement about attention or search
depth, and any claim that the operation below changes anything — that is FIELD.

## Node J — competing interventions

| | I1 (targets the measured distinction) | I2 (generic alternative) | I3 (sham, matched form) |
| --- | --- | --- | --- |
| TRIGGER | before committing, whenever one of your pieces has more attackers than defenders (count them) | before every move | before committing, whenever the opponent's last move was a pawn move |
| OPERATION | name the under-defended piece; make sure your intended move moves it, defends it, or creates a bigger threat; if it does none, pick again | "check for hanging pieces" | note the pawn move; make sure your intended move does not weaken a square it attacks |
| TARGET | `cls_tactical` inside R*, especially "left the piece under-defended" | all errors | none (attention control) |
| NON-TARGET | decisions outside R*: rate must not move; quiet errors inside R* need not move | | decisions inside R* |
| PREDICTION if the mechanism is right | tactical-error rate inside R* falls; the share of moves that leave the piece under-defended falls; outside R* unchanged | small, diffuse change | no change inside R* beyond I2's |
| REVERSAL | the policy signature rises (fewer moves leave the piece under-defended) but the tactical-error rate inside R* does not fall → the operation targets the wrong distinction; errors fall equally under I3 → attention, not mechanism | | |

I1 is the candidate; I2 and I3 are the controls a field test must carry. The trigger is evaluable at
the board with no engine: count attackers and defenders (GATE-CUE-PLAYER-OBSERVABLE).

## External resource record (R4)

| question | source | what it resolves | what it cannot resolve | decision impact |
| --- | --- | --- | --- | --- |
| is there a measured effect size for a pre-move "blunder check" routine that could set the field test's minimum effect? | one web search (2026-09-05): chess.com, chessworld.net, chessdock.com, chessmind.ai coaching pages | nothing quantitative: coaching pages assert that a checks/captures/threats/loose-pieces scan "takes weeks to install"; no controlled study surfaced | the minimum detectable effect and the timeline | both are set from the owner's own record below, not from literature; no further reading buys a distinction |

## Node L — field protocol for I1 (instantiated from `FIELD_PROTOCOL_TEMPLATE.md`; all numbers from the owner's record)

| item | value |
| --- | --- |
| TRIGGER (code) | `own_overloaded_piece_count >= 1 AND material_balance >= -2` on the pre-move board (frozen code: `pipeline/features.py`, verbatim P3 construct), evaluated on every eligible decision, fired or not |
| PLAYER WORDING | "Before you move: if any piece of yours is attacked more times than it is defended, your move has to move it, defend it, or make a bigger threat. If it does none of these, choose again." |
| WORDING COVERAGE | the sentence is exactly the code predicate (attackers > defenders on any own non-king piece); the material clause is dropped from the wording because a player already down more than two pawns is not the target and the region without that clause validates too (VALIDATE within-game +8.7 pp, residual z 6.26) |
| DELIVERY | one written instruction read before a session; nothing in-game; nothing on the product surface (D21) |
| SHAM (I3) | "Before you move: if the opponent's last move was a pawn move, make sure your move does not weaken a square that pawn now attacks." Same length and form; a non-trigger situation |
| SCHEDULE | alternating blocks of 10 rated blitz games (3+0, 5+0), instruction ↔ sham, order fixed by a coin recorded before the first block; the owner reads the block's sentence before its first game |
| EXPOSURE LOGGING | date-time of each reading and each game id, by the owner, in `research/mechanism/field/exposure.jsonl`; a game not preceded by a reading is labelled `none` |
| PRE-EXPOSURE BASELINE | the 300 most recent admissible blitz games before the first block (rate 24–26% inside R*, 13–14% outside, 6.5–6.8 opportunities per game); reported beside the whole record |
| PRIMARY OUTCOME | tactical-error rate inside R*, within game, instruction blocks vs sham blocks (game-fixed-effects contrast as in the judge; secondary: vs pre-exposure baseline) |
| POLICY SIGNATURE (adherence) | share of R* decisions whose move leaves the under-defended piece under-defended (baseline 45% on DERIVE); expected to fall under the instruction and not under the sham |
| NEGATIVE ENDPOINT | tactical-error rate and think time outside R* must not move more under the instruction than under the sham (overgeneralisation = failure) |
| DENOMINATOR | eligible R* opportunities per block, identified by the frozen code; games are the clusters |
| MINIMUM EFFECT | inside R*: 25% → 18% (a 7-point drop, about 60% of the measured excess). Sizing at one-sided α 0.05, power 0.80: 423 opportunities per arm ≈ 64 games per arm ≈ 128 games ≈ 13 blocks; at the owner's recent rate (39 games in the last 4 corpus weeks, 50 in the week before freeze) about 3–5 weeks |
| STOPPING RULE | stop at 430 instruction-arm opportunities or 60 calendar days, whichever first; no interim look changes anything |
| CONTAMINATION | the OwnExposure sentence of 2026-09-02 is a prior exposure to the same construct: every game after 2026-09-02T16:16Z is post-exposure and the pre-baseline ends there; games during any other coaching or engine use are labelled and excluded; the label is never changed after a result is read |
| ANALYSIS | paired within-game contrast of the primary outcome, instruction vs sham, game-level cluster bootstrap 5,000 replicates, seed 20260905; the same for the policy signature and the negative endpoint; engine: Stockfish 18 Lite WASM depth 12 (the shipped instrument), Stockfish 17.1 depth 12 beside it |
| FALSIFIER | the instruction-minus-sham drop inside R* is smaller than 4 points, or its bootstrap interval includes zero |
| REVERSAL | policy signature falls but errors do not → wrong distinction; errors fall equally under sham → attention; errors fall outside R* as much as inside → generic slowing |
| INFRASTRUCTURE READY NOW | scoring, feature extraction, the frozen predicate, the judge and the bootstrap are in `research/mechanism/`; `analysis/field_eval.py` (to be added) reads `exposure.jsonl` and the new games and prints the frozen contrasts |

## Node G — PERSONAL: R* against the population (`nodeB/population_tactical_validate.json`)

Population: 600 games of 2026-06 blitz (180+0, 300+0), both sides rated 1450–1850, one game per
player, scored and featured by the same pipeline: 34,794 eligible decisions, 1,200 sides, tactical
base rate 14.4%.

| | raw inside / outside R* | within-population baseline residual |
| --- | --- | --- |
| population | 22.7% / 11.8% (+11.0 pp, z 18.7) | +6.75 pp (z 12.6) |
| erez281, VALIDATE, under the POPULATION baseline | 25.7% / 13.8% (+11.8 pp, z 11.6) | +8.75 pp (z 8.5) |
| per-side elevation, 456 sides with ≥ 8 decisions on each side of R* | mean +5.5 pp, sd 14.4, 5th/50th/95th −14.6 / +5.3 / +28.8 | erez281 at the **62nd percentile** |

**Verdict.** R* is a real, cross-context, predictive region of the owner's decisions, and it is also
the typical structure of a 1,650-rated blitz player: leaving an under-defended piece unresolved
costs material for everyone at this level, and the owner does it about as often as the median
same-rating side. What died: "R* is a player-specific mechanism" in the strong sense. What survived:
R* as an L2 predictive pattern for this player, actionable and field-testable; the population does
not remove it from his record, it removes the word *specific*.

**Next branch (mission §NODE G: "if it collapses, return to NODE E").** Make the population the
baseline. Fit a flexible model of tactical error on the population's pre-move features (OBS + ENG),
predict it for the owner's decisions, and search the owner's residual — the situations where he
errs more than a typical same-rating player would in the same situation — within game, on DERIVE,
frozen, judged on VALIDATE. Blitz only (the population has no bullet or rapid). Design v1.8, declared
before it is run.

## Node K — existing prospective evidence (natural experiment, underpowered)

The owner read the repository's OwnExposure sentence (the same construct as R*'s core term) inside
the bracket 2026-09-02T16:16–16:36Z. Games after the bracket are post-exposure:

| window | games | R* opportunities | tactical in / out | within-game |
| --- | --- | --- | --- | --- |
| pre-exposure, most recent 300 admissible blitz games of the record | 292 | 1,862 (6.4 per game) | 23.9% / 13.9% | +10.1 pp |
| post-freeze, pre-bracket (2026-09-02 14:36–14:41) | 2 | see file | | |
| post-exposure (2026-09-02 16:16Z → 2026-09-05) | 10 | see file | | |

Ten games and about sixty opportunities cannot resolve anything; the read is recorded so that it is
never re-cut after more games arrive. No sham, no logging of the reading, no adherence measure: it
is exposure, not a test.

## Node G — engine-evaluation artifact control (`nodeB/engine_artifact_tactical_validate.json`)

VALIDATE re-scored under the shipped instrument (Stockfish 18 Lite WASM, depth 12, MultiPV 1, hash
cleared; `pipeline/rescore_wasm.py`, 10,626 decisions). Label agreement with the research engine
80.9%; error rate 37.1% (shipped) vs 45.9% (research), the same direction as `ENGINE_PARITY_RESULTS.md`.

| target | in / out R* | within-game | residual within-game (baseline refit in-sample, control only) |
| --- | --- | --- | --- |
| tactical error, research engine | 25.7% / 13.8% | +11.5 pp, z 11.24 | +8.8 pp, z 8.71 |
| tactical error, **shipped engine** | 21.5% / 10.9% | **+10.2 pp, z 10.65** | +7.8 pp, z 8.34 |
| any error, research engine | 50.2% / 44.2% | +5.4 pp, z 4.25 | +1.2 pp, z 1.04 |
| any error, shipped engine | 43.0% / 34.8% | +7.7 pp, z 6.43 | +4.1 pp, z 3.51 |
| loss ≥ 0.10 win probability | 20.7% / 13.2% | +7.0 pp, z 7.52 | +2.9 pp, z 3.35 |

The region keeps its sign and 89% of its size under the other engine: not an evaluation artifact.
The rows for "any error" also show why the class target was necessary: pooled over all errors the
excess beyond the baseline is small; it lives in the tactical class.

## Sub-class refinements (same trigger family; `nodeB/discovery_OBS_cls_*_resid.json`)

| class target | base rate | Node C depth | frozen (top) | VALIDATE in / out | within-game | residual within-game z |
| --- | --- | --- | --- | --- | --- | --- |
| `hung_material` (the reply wins material) | 8.6% | 1 | `own_overloaded_piece_count >= 1` | 14.8% / 5.1% | +9.7 pp, z 13.9 | **13.0** |
| `hung_material` | | | `own_hanging_piece_count >= 1` | 14.2% / 6.4% | +8.0 pp, z 10.5 | 10.1 |
| `quiet_error` (no capture, check or mate involved) | 27.8% | 3 → 2 | `own_castling == 0 AND own_overloaded_piece_count < 1` | 32.2% / 26.5% | +6.9 pp, z 6.1 | 6.8 |
| `missed_material` | 3.8% | 3 | (CV z 1.7–2.7; no candidate passed) | | | |

The sharpest statement is the hung-material one: when a piece of the player's has more attackers
than defenders, the probability that his move loses material to the reply is 14.8% against 5.1%
elsewhere in the same games, and the whole of that excess survives the baseline (residual z 13).
The quiet-error region is the complement: with no under-defended piece and castling rights gone,
quiet errors rise; it is a second structure, not the same one, and it is not pursued further here.

## Design v1.8 — the population as the baseline (declared before its search results are read)

| item | value |
| --- | --- |
| population model | gradient-boosted trees (scikit-learn HistGradientBoosting, 200 iterations, single thread) on the 34,794 population decisions, features = every OBS and ENG pre-move feature plus clock, rating difference, ply and board counts; one model per target |
| sanity | game-grouped holdout AUC on the population: tactical 0.766, hung material 0.765, any error 0.752; applied to the owner's VALIDATE blitz decisions: AUC 0.745 / 0.740 / 0.742 and calibrated (predicted 17.2% vs observed 17.1% tactical; 8.4% vs 8.7% hung material; 45.3% vs 45.9% any error) |
| search target | owner's residual (target − population prediction), demeaned within game; OBS vocabulary; blitz only; depth by CV; freeze 3; judge on VALIDATE with the residual within-game z ≥ 3.5 and raw within-game > 0 |
| null | i.i.d. Bernoulli at the game's own rate, 30 draws, depths 1–2 |
| what R* looks like under this baseline (VALIDATE, blitz) | tactical: residual in R* +1.9 pp vs −0.8 pp outside, within-game +2.8 pp (z 2.66); hung material: +3.2 pp vs −0.7 pp, within-game **+4.3 pp (z 4.78)**; any error: within-game +2.8 pp (z 2.37) |
| reading | most of R*'s excess is what a same-rating player shows in the same situation; a residue survives for the hung-material class: the owner loses the under-defended piece somewhat more often than the population model predicts for the same pre-move situation |
