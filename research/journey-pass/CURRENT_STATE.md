# CURRENT_STATE, frozen before implementation

Read at `2afb7a2` (`origin/main` after PR #102 and PR #103 merged). Branch restarted from that
commit, because the previous branch carried only merged history.

Nothing below is proposed. Every line is something the tree does today.

---

## 1. The journey as it actually runs

Driven at 390×844, `deviceScaleFactor: 2`, touch, against the shipped build (`npm run contact-sheet`,
20 frames).

```
/  (Record)                    /play  (Home)                     /blitz
empty ─► "front door" ──────►  decide ─► commit ─► reveal ─► next position
   ▲                                                              │
   └──────────  /  returning, the long surface  ◄─────────────────┘
```

**THERE IS NO `/record`, AND THE MISTAKE IS RECORDED BECAUSE IT NEARLY BECAME A FINDING.**
`App.tsx` routes `/` to `Record` and `/play` to `Home`. What the contact sheet calls "the front
door" is the Record page in its empty state, and "the returning front door" is the same route with
a record behind it. A first draft of the walk in
`tests/layout/a-walk-the-derivation-can-be-wrong-about.layout.test.ts` navigated to `/record`,
read a 404 as a surface offering nothing, and reported a screen/derivation disagreement that was a
typo. The walk now names the two routing surfaces it actually visits.

**Front door, cold.** Headline `מה קרה בההחלטה, לפני שהמנוע דיבר`, then the exchange stated
plainly: an engine can tell you which move was better, it does not know what happened to you on
the way to choosing. Then `ההחלטה הראשונה`, a source toggle, a username field, one primary act.

**Decide.** `DECIDE`, the ply, whose turn. Board. Under it: *"עמדה ממשחק ששיחקתם — אחרי 12 מהלכים.
אתם לבן. בחרו מהלך על הלוח."* A missing-step chip names the act. A placed move is a **proposal**:
`handleBoardMove` sets `candidateMove`, appends to `candidatesConsidered`, and says
`"{uci} נבחר. אפשר לשנות עד הרישום."` Confidence is asked on a fixed draw, not on request. Commit
is a separate press.

**Reveal.** `inferenceLimits` first, always, before any number. Then the one thing, with its
evidence kind (`process` / `engine`), its basis, and the player's own stated read echoed back.

**Returning front door.** In order: the resume card (`החלטה אחת שלך נרשמה ונקראת בחלק אחר של
ההיסטוריה`, one act, one reason), `נמדד עם ביטחון שהצהרתם מראש`, `מה יצא מזה עד עכשיו?`
(`0 החלטות מדודות · חסרות עוד 60`, with the threshold arithmetic), then `מה עדיין לא ברור?`.

**`/` with a record behind it,** in source order: `ResumeScreen` → `FirstDecision` → `OutcomeSummary` →
`WhatIsUnclear` → `WhatIsUnderTest` → `AnchorRunControl` → `RecordDashboard` → **`GoalNote`** →
`JourneyLedger` → `ImportDiagnosticPanel`.

## 2. State machines, and there are two of them at different levels

**The learning object's lifecycle** (`shared/learning-journey.ts`, nine stages) belongs to a claim
or a rule, never to the player. Unchanged since the previous lane.

**The player's path** (`research/player-path/PLAYER_PATH.md`, P0–P5) is a description, not a
machine. P4 is optional by design: the value is delivered at P1.

**There is deliberately no `GOAL` node and no `OUTCOME` node.** `shared/goal.ts` carries the
argument: a goal inside a state machine either advances, and then something measures distance to
it, or it does not, and then it is decoration inside a machine whose shape promises progression.

## 3. Data objects

| object | where | note |
| --- | --- | --- |
| decision atom | `shared/decision-atom.ts` | `ATOM_FIELDS` is the canonical order, asserted by `GATE-ISO` across screen, event and report |
| `bounded_action.candidate_moves_considered` | same, `max(8)` | every move **placed on the board** before commit |
| `feedback.would_choose_again` | same | written after the reveal |
| `probe` | same | present on every decision including unprobed ones, so the control group has a denominator |
| blitz game + decisions | `shared/blitz-record.ts` | **a separate store**. Blitz never calls `commitDecision` and carries no `purpose` |
| learning rule | `shared/learning-record.ts` | player-authored |
| player goal | `shared/goal.ts` | one sentence, `GOAL_MAX_LENGTH` 140, never parsed for a number |

## 4. Evidence boundaries in force

- **`EVIDENCE_POLICY_VERSION` 4** (`shared/evidence-policy.ts`). `discovery` admits `play` and
  refuses `first`, `import`, `anchor`, `drill`, `transfer` and unlabelled legacy rows. The module's
  own words: *"a source does not become eligible because excluding it leaves too little data."*
- **The claim ceiling.** `CAUSALITY`, `INTERVENTION`, `OUTCOME` unreachable by the discovery
  pipeline under any result.
- **`MIN_BUCKET_N` 30**, needed inside and outside a bucket, so 60 measured decisions precede any
  claim.
- **The published refusal list** (`WhatThisIs`): no score, no rating, no streak, no badge; *"לא
  ימליץ מה ללמוד — הוא מודד, לא מאמן"*; nothing said beyond what was measured; the product never
  grades itself a success.
- **42 gates**, each with a positive control that must go red.

## 5. What is built and owns nothing

`shared/next-action.ts` derives the whole next-action union from record facts, with `agreesWith`
mapping each kind onto the closed primary-act vocabulary. `client/src/lib/next-action-shadow.ts`
runs it beside the screen and writes the comparison to the trial ledger.

It decides nothing, **deliberately and under test.**
`tests/client/a-record-of-the-trial-not-of-the-player.test.tsx` asserts that the set of callers is
exactly `["client/src/components/ResumeScreen.tsx"]`, that the screen does not bind the return
value, and that the shadow reads no more of the ledger than idempotency needs. The stated reason is
§23's coaching rule applied to the product's own navigation: a claim of that shape may not act on a
player until something could have shown it wrong.

`SURFACE_BLIND_SPOTS` names three surfaces. One is wired.

## 6. Bottlenecks, as observed rather than as assumed

1. **The instrument's needs are first and the player's purpose is last.** `WhatIsUnclear` is high on the record
   page; `GoalNote` is below every count. The ordering was chosen to keep the goal away from a
   denominator, and it also means the player's own reason for being here is the last thing they meet.
2. **A recorded decision produces a shortfall.** One decision recorded, and the next number the
   screen shows is `0 החלטות מדודות · חסרות עוד 60`. The two registers already use different verbs
   (`נרשמה` against `מדודות`) because this exact collision was found and fixed once. What is still
   missing is any statement of what the one recorded decision **did** produce.
3. **The strongest "why" in the product is behind a help control.** `WhatThisIs` holds it, including
   the refusal list, and nothing on the journey carries it.
4. **A placement on the board is treated as consideration in one direction only.** See §7.

## 7. The P0 asymmetry, which is the sharpest thing in this reading

`candidate_moves_considered` records every move **placed on the board** before commit. Two different
mechanisms produce the same entry: a move weighed and rejected, and a move dragged to look at, or a
mis-drag corrected before commit.

The repository already knows this and has acted on it **once, in one direction**:

- the copy was weakened from `ראית את המהלך` to `כבר היה בין המהלכים שהנחת על הלוח`, with the
  reason written down: *"A player who drags a piece to test a square and drags it back has recorded
  the move without having judged it."*
- `inferenceLimits` states the **absence** direction: *"רק מהלך אחד נרשם כנשקל, ולכן אי אפשר לדעת
  אם מהלך המנוע נשקל ונדחה. מהלכים שנשקלו בלי להניח אותם על הלוח אינם נרשמים."*

The **presence** direction is not stated anywhere, and it is the direction on which a mechanism
claim is actually made. `theOneThing`'s `chose-past-it` branch fires on
`candidatesConsidered.includes(bestMove)` and carries the note:

> כאן הקושי לא היה למצוא את המהלך, אלא לבחור בינו לבין האחר.

That is a claim about which cognitive difficulty the player had, generated by a sign a mis-drag
produces equally well. It changes intervention: it sends the player to practise choosing rather
than to practise seeing.

**What is NOT contaminated, checked rather than assumed:** blitz decisions never enter the decision
record, so the gesture-committed regime and the confirmed-before-commit regime are not pooled;
`EVIDENCE_POLICY` already refuses imports, drills, transfers and the bank for discovery; and the
executed move is never rewritten anywhere.

## 8. What this pass intends to change

**Will change.**

- The presence direction of the placement ambiguity: state it where the claim is made, and stop
  asserting the mechanism. Test it with a positive control.
- Put something on the journey where a shortfall currently stands alone, so a recorded decision
  leads somewhere other than to a number it did not move.

**Will not change, and why.**

- **The derivation stays in shadow.** Promoting it means editing a test whose purpose is to hold
  that promotion back until a person could have seen the derivation be wrong. No shadow ledger
  from a real visit exists. Marked `DEFERRED` with its unblocker named, not quietly relaxed.
- No progress score, no rating denominator, no goal node, no outcome node, no coaching.
- No new telemetry, no pointer-event capture, no per-candidate timing. The discriminator this pass
  needs is a claim boundary, and a claim boundary costs no fields.
