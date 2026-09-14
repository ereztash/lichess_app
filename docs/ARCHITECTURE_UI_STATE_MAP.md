# Architecture → UI: the state map

What the canonical policy reads, where each input comes from, and what happens when it cannot be
read. Companion to `ARCHITECTURE_UI_CURRENT_STATE.md` (the before) and
`ARCHITECTURE_UI_AUTHORITY_MIGRATION.md` (what moved).

---

## 1. The chain, as built

```text
RecordStore  ──►  continuationReading / blitzReading / claimView / recordReading
                        │
                        ▼
                  productStateFor            assembles ProductState, marks what was not read
                        │
                        ▼
                  proposeNextAction          ONE ladder, 12 branches, 11 kinds + blind list
                        │
                        ▼
                  useCanonicalAction         unknown | unsound | sound
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
   presentOnResume  presentOnPostGame  (future surfaces)      wording, per surface
          │             │
          ▼             ▼
   useCanonicalRouting                                        destination, shell-owned
```

Four owners, one job each. The policy ranks; the presenter words; the shell routes; the surface
draws. None of them ranks anything another has ranked.

---

## 2. Every input the policy reads

| Input | Source | Unavailable is represented as | Fabricated? |
| --- | --- | --- | --- |
| `drill` | `listOpenDrills` → `continuationReading` | `UNOBSERVED` → proposal unsound | no |
| `transfer` | `getOpenLearningTransfer` per rule | `UNOBSERVED` → proposal unsound | no |
| `untestedRule` | `listLearningRules` + grade/retrieval step | `UNOBSERVED` → proposal unsound | no |
| `unseenEvent` | **nothing produces it** | `UNIMPLEMENTED` → branch skipped, **not** charged as blindness | no |
| `pendingAnalyses` | `StoredBlitzGame.analysisState === "pending"` | counted, never inferred | no |
| `analysisRunning` | the page-level queue runner | passed in, never hard-coded | no |
| `claimState` | `claimStateOf(useClaimView())` | `{ kind: "unread" }` | no |
| `blitzStanding` | `blitzReading.standing` | `null`, and the ladder answers `none` | no |
| `decisionsOnRecord` | `countDecisions` | `0` only when the query answered `0` | no |
| `anchor` | `recordReading.anchorAnswered` vs `ANCHOR_POSITIONS` | `0` of the current set | see note |

**Note on `anchor.total`.** It is the size of the *current* anchor set, and a record answered under
an older `ANCHOR_SET_VERSION` would be measured against a set it never saw. This was acceptable in a
shadow and is less so now that the value can route a player. It is recorded here rather than fixed,
because fixing it means versioning the answered set and that is a record change, not a wiring one.

---

## 3. The three answers, and what a surface may do with each

| `useCanonicalAction` | Meaning | Surface may | Surface may **not** |
| --- | --- | --- | --- |
| `unknown` | readings have not settled | render its description, draw no primary control | substitute a product act of its own |
| `unsound` | a readable input that could have **outranked** this went unread | as above | act on the action anyway |
| `sound` | every input above the branch that fired was read | render the presenter's offer | rename the act |

`unsound` is the one that matters. It is not "the policy failed"; it is "the ranking was computed
without a competitor that might have won". Acting on it would be acting on a ranking that was never
complete, and substituting the surface's old default would reintroduce the parallel policy through
the error path.

---

## 4. `unseenEvent`: unimplementable, not unread

This is the single modelling change that made the rest possible, and it is worth being exact.

`unseenEvent` sits at **branch 4**. Nothing in this repository produces it: no seen-set, no writer,
no reader, no storage. It was modelled as `UNOBSERVED` — *"a surface did not read this"* — which put
`blind: ["unseenEvent"]` on every branch below it.

Consequence: `soundProposal` was **false for 8 of the 11 kinds, permanently, for every surface, in
every state**. `soundProposal` is the predicate authority transfer is gated on. The gate could
never open, and the cause was recorded in `D22` as "the event set is unbuilt" when it was really
"the ladder asserts that an impossible state might have outranked this one".

`Observed<T>` now carries `unimplemented?: true`, and `proposeNextAction` skips those rather than
charging them. **No seen-set was built. `review-event` is still unreachable and is reported as
unreachable.** What changed is that its unreachability stopped being charged to the branches
beneath it.

`GATE-NO-FABRICATED-STATE` holds both directions: an unread input must still be unsound, and an
unimplementable one must not be blindness. Its control inverts exactly that one line.

---

## 5. What survives which boundary

| State | Survives reload | Survives navigation | Where it lives |
| --- | --- | --- | --- |
| open drill + progress + cursor | **yes** | **yes** | `drills` table + atoms bound by `drill_id` |
| open transfer + observations | **yes** | **yes** | `learning_transfers` + per-position observations |
| abandoned drill | **yes** | **yes** | `drills.abandoned_at` |
| untested rule | **yes** | **yes** | `learning_rules` grade + `retrieval_step` |
| claim under test | **yes** | **yes** | `claims` + `drill_results` |
| blitz record, analysis backlog | **yes** | **yes** | `blitz_games.analysisState` |
| in-run cursor within a position | no | no | `Home.tsx` / `useDrillRun`, deliberately |
| which surface the player came from | no | no | not stored, and not needed |

The last two are the line §5 of the mission draws. A drill's *identity and progress* cross every
boundary because the product needs them there. Which half-move of position 4 is on screen does not
cross, because nothing outside that screen asks.

---

## 6. The same act, two voices

Proof that centralising policy did not homogenise the interface. Same record, same action, two
surfaces:

| Canonical action | Resume says | PostGame says |
| --- | --- | --- |
| `continue-drill` (4 of 8) | *"חזרה לסט"* — "התחלתם לבדוק את זה ועניתם על 4 מתוך 8 עמדות. סט חלקי לא בודק כלום." | *"חזרה לסט שהתחלתם"* — "יש סט פתוח, 4 מתוך 8 עמדות. הוא נרשם מראש, ולכן חצי ממנו לא בודק כלום." |
| `play-blitz` | *"שחקו משחק קצר"* — "עוד החלטות מדודות הן מה שמאפשר את הבדיקה הראשונה." | *"משחק חדש"* — "עוד משחק מוסיף החלטות חדשות, וזה מה שמאפשר לבדוק אם משהו חוזר." |
| `test-hypothesis` | *"בדקו את הכלל שכתבתם"* — "כתבתם כלל ואף פעם לא נבדק קדימה." | *"בדקו את הכלל שכתבתם"* — "הכלל שכתבתם עדיין לא נבדק על עמדות חדשות." |
| `wait-analysis` | no control; the waiting sentence | no control |

The act is identical in every row. The sentence never is. A returning player is being told what is
waiting; a player who just finished a game is being told what this game changed.

`GATE-SEMANTIC-PRESERVATION` holds the left column equal across surfaces and says nothing about the
right.
