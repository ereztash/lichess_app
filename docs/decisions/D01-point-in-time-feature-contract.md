# D01 — how do we know a feature was available when it claims to have been?

**Mode:** `PORT_AFTER_EQUIVALENCE` — the logic of a feature store's point-in-time join, thirty
lines of it, without the feature store.
**Evidence level:** E2 → the contract exists and its mutations go red; no leaked feature has yet
been caught in production data, because there is none.
**Depends on:** `shared/discovery/feature-contract.ts`, `docs/discovery-v2/M0_AUDIT.md` §Q2.

## CLAIM

A search over features finds whatever separates the target best. If a feature carries information
that did not exist when the decision was made, the search finds **that**, every time — and the
result looks exactly like a real finding: large effect, tight interval, replicates on every split
of the same data. It fails only on a decision that has not happened yet, which is the one place
this product makes its promise.

## ALTERNATIVES

1. **A label per column**: `PRE_DECISION | COMMIT | POST_GAME`.
2. **A timestamp per observation**, with reads positioned at a cutoff.
3. **Adopt a feature store** (Feast or similar) wholesale.
4. **Nothing** — rely on review, as today.

## EXTERNAL IMPLEMENTATIONS

**Feast**, and the pattern it standardises: every row carries an event timestamp and a created
timestamp, and a read at time *T* returns what was on record at *T*. This is the industry's answer
to precisely this failure, and it is a **point-in-time join**, not a column label.

## WHAT WAS COPIED

Nothing.

## WHAT WAS WRAPPED

Nothing.

## WHAT WAS ONLY USED AS REFERENCE

Feast's point-in-time semantics. The dependency is not taken: what is needed here is one function
and a rule about who may call it, and a feature store is a service, a registry and an offline store
for a product whose user path is a static bundle.

## LOCAL EVIDENCE

**Alternative 1 was rejected by a case already written down in this repository.**
`shared/blitz-features.ts` documents `playerRelativeThinkPercentile`: it needs a distribution, and
*"a reference drawn from the same decisions being read is leakage wearing a percentile."* That
feature is legitimately available at decision time **and** is recomputed later from better
information. A label on the column cannot see the difference. A timestamp on the observation can:
a recomputation is a new observation with a later `observed_at`, and a reader positioned before it
cannot see it.

**The audit of what ships found no leak.** Every feature reaching `detect()` was traced: `phase` is
re-derived server-side from the entry FEN and refused if the client disagrees; `clockMsRemaining` is
*"the clock as the player FACED it"*; `secondsTaken` is measured at commit and is nullable rather
than zero-filled; `accurate` is the target and is correctly never a predictor.

**The enforcement is what failed.** `shared/game-features.ts` exposes `DeepGameFeatures` —
`totalMoves`, `gameLength`, `result`, `castlingSpeed` and twenty more, every one computed by
replaying the whole game, every one post-game with respect to any decision inside it. It has no
consumers; it arrived in a repository merge. It is one import away from making every claim it
touches a prediction of the past, and nothing in the tree would have noticed.

`tests/discovery/no-feature-from-the-future.test.ts` holds fifteen cases, three of which apply the
mutations that matter — widening the cutoff to the end of the game, dropping the observability
filter, tightening `<=` to `<` — and assert the visible answer changes.

## COUNTEREVIDENCE

- **A contract nothing calls prevents nothing.** No product path reads `featureAsOf` today; the six
  shipped buckets read fields off the atom directly, and those fields were audited clean. Until the
  discovery path is the only way features reach a search, this is a contract for future features
  rather than a wall around current ones.
- **Timestamps can be written wrongly.** `observed_at` is a claim by whoever wrote the row. The
  contract makes leakage *expressible and checkable*; it does not make it impossible.

## UNCERTAINTY

Whether the three timestamps are the right three. `event_time` is currently carried and never read
by any rule here — it exists so that a study can ask questions the cutoff cannot, and if it is
still unread when a real study runs, it should be removed rather than kept for symmetry.

## DECISION

**Alternative 2.** The unit is a `FeatureObservation` with `event_time`, `observed_at` and
`created_at`; `featureAsOf` filters on `observed_at <= commit_timestamp` and then takes the latest
by `created_at` among what survived. Missing is `null` and never a default —
`shared/detector.ts` records what a default costs: an imported first move with no derivable think
time was written out as `0`, which satisfies `secondsTaken < 45`, so every imported game
contributed a fabricated decision to the bucket the product leads on.

The cutoff is the **commit**, not the reveal. Everything between them — the engine's verdict most of
all — is exactly what a predictor may not contain.

## REVERSAL CONDITION

- **If `DeepGameFeatures` is wired to anything** without a `FeatureSpec` declaring its role and
  timing, this contract has failed at the only place it was needed. Either declare those features
  or delete the module.
- **If a leaked feature reaches a validated claim anyway**, the unit is wrong: the next candidate is
  a *bitemporal* row (valid-time plus transaction-time), which is what a data warehouse would use
  and what was passed over here as heavier than the problem.
- **If `event_time` is still read by nothing** when the first real study runs, remove it. A field
  carried for symmetry is a field that will be filled in wrongly.
