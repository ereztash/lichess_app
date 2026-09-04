# Passes 2, 3 and 4: cost against payoff, accumulation, and whether a new probe is justified

Companion to [`PRE_HUMAN_UX_PASS_1.md`](PRE_HUMAN_UX_PASS_1.md). Method is Neta v0.2 at `5344852`.
No Neta file was changed. Everything here is about Lichess App.

---

## Pass 2: what a decision costs and what it returns

Cost is what the step asks of a person, measured on the built app. Payoff is what they hold
afterwards that they did not hold before.

| step | cost, measured | immediate payoff | durable payoff |
| --- | --- | --- | --- |
| read the position | a board and a 74×24px header naming the move number | knowing whose turn it is, if the header was read | none |
| choose a move | two clicks, plus one on nothing if the first lands on an empty square, which lights the same ring | a string in a 291px side column. The board is unchanged | the move is in the record |
| declare a reading | one of ten chips, required | a vocabulary the player did not have | `known.tapped` is stored and is searchable |
| declare what cannot be assessed | one of seven, required | the same, and the harder question | `unknown.tapped` is stored |
| declare confidence | one of seven, 51px wide each | **none at this moment** | the only field that makes a calibration gap readable at all |
| wait | 2.2 s cold, 0.3 s warm | none | none |
| read the reveal | on desktop none; on a handset one and a half screens of scrolling | one sentence about this decision | **nothing the player can see** |

**The mismatch is concentrated in one place and it is the last row.** Every other row either returns
something immediately or stores something the record will use. The reveal returns a sentence about
one decision and then, from the player's side, the sentence is gone. The most salient element of the
whole reveal is the block that is identical on every reveal:

> החלטה אחת אומרת מה קרה בה, ולא יותר. החלטה נוספת היא עמדה אחרת ורגע אחר.

That is true, it is honest, and it is the product telling a person who has just paid the full
cognitive cost that the thing they paid for does not add up to anything yet. **It is also the
highest-ranked element on the screen** by area × weight × contrast.

This is the measured form of `התמורה מכל החלטה עדיין מקומית מדי`.

---

## Pass 3: what an accumulation surface could say with no new probe

### What the record already holds, per decision

Read from `shared/decision-atom.ts`, not assumed.

| group | fields |
| --- | --- |
| position | `game_id`, `fen`, `ply`, `phase`, `clock_ms_remaining` |
| what was said **before** the engine spoke | `known.tapped` + `known.typed`, `unknown.tapped` + `unknown.typed`, `confidence` with its `confidence_scale` and `confidence_grid_version`, `seconds_taken`, `candidate_moves_considered` (up to 8) |
| the decision | `decision` |
| the engine | `engine_eval_cp`, `engine_best_move`, `engine_depth`, `engine_source`, `engine_build`, `cp_loss` |
| the probe | `assignment` (`probed`/`not-probed`/`ineligible`), `legal_moves`, `alternative`, `answered`, `alternative_cp_loss` |
| afterwards | `revised_read`, `would_choose_again` |
| provenance | `purpose`, `drill_id`, `transfer_id`, `reveal_timing`, `measurement_protocol`, `protocol_version`, `analysis_timing` |

**This is a great deal more than the reveal spends.** Every decision already carries a stated
reading, a stated blind spot, a confidence declared before the engine spoke, the moves the player
actually put on the board, the engine's verdict, and a randomised probe arm with its covariate.

### What that supports saying after one decision, without inventing anything

The shape, using the record's own vocabulary and no arbitrary percentage:

```
מה שנרשם עד עכשיו
  קריאה שחזרת עליה:   "המרכז סגור"        נבחרה ב-  3 החלטות
  מה שאמרת שאינך יודע: "לא מכיר את העמדה"  נבחר  ב-  2 החלטות
  תומכות: 2 · סותרות: 1 · נבדקו: 3
  רמת הראיה: מוקדם מדי לומר משהו
  מה עוד צריך לראות: החלטה אחת נוספת שבה סימנת את אותה קריאה
```

Four rules this design is bound by, and each of them is why it is a design and not a dashboard:

1. **A count is not a claim.** `תומכות: 6 · סותרות: 3 · נבדקו: 14` is legible and does not assert a
   pattern. `73% מדויק` would assert one at n = 14, which the detector's own thresholds refuse.
2. **The 60-decision floor does not move.** This surface reports a balance; it does not grade one.
   `MIN_BUCKET_N` and the detector are untouched.
3. **Bank decisions stay outside the personal denominator** and are labelled, exactly as the
   `N-3` change already does on the record surface.
4. **It reads only what is already stored.** No new event, no new field, no change to what a
   decision costs.

### Why this is specified and not built here

It changes the content of a reveal block, and the reveal's content is what `F-2` is about: whether a
newcomer can tell what the product claims from what it says it cannot claim. Rewriting the block
that currently says `החלטה אחת אומרת מה קרה בה, ולא יותר` is a change to the exact copy whose
comprehension is field-required.

That is not a reason never to do it. It is a reason for it to be its own change, with the owner
deciding whether the accumulation block replaces that sentence or sits beside it, and with the
before/after measured the same way pass 1 was.

---

## Pass 4: is a new probe justified?

The owner named the distinction precisely:

> A. השחקן לא העלה candidate move טוב.
> B. השחקן העלה אותו אבל העריך אותו לא נכון.

**The instrument for that already exists, and it is already randomised.**

| the eight-point test | answer |
| --- | --- |
| are there two live hypotheses? | yes, A and B |
| does the answer separate them? | yes |
| is the information gain significant? | it would be, if it were not already collected |
| is there a cheaper admissible observation? | **yes.** `probe.alternative` is exactly this question, `probe.answered` records whether it was put, `probe.alternative_cp_loss` scores the answer, and `candidate_moves_considered` holds up to eight moves the player placed |
| does it harm measurement validity? | asking on every decision would change the decision task itself, which is why the existing probe is sampled rather than universal |
| is reactivity accounted for? | yes, and better than a new probe would: `assignment` is `probed`/`not-probed`/`ineligible` on **every** decision, so the unprobed arm is a real control rather than the record's own average |
| can we say when to remove it? | not needed |
| what does the feature buy? | nothing the existing probe does not |

**Permission: `DEFER`.** The best remaining argument for a new candidate-move probe is that it could
be built. Under Neta v0.2 §8 that is exactly the encodability bias the check exists to catch.

### And it corrects a finding of mine

`N-5` recorded that the counterfactual question fires on 6 of 15 clean first decisions with no
observable trigger, and warned that if it were a randomised arm then every reveal-to-continuation
rate would pool two different experiences under one number.

It is a randomised arm, and the warning was wrong: `probe.assignment` is on every decision, including
the ones nothing was asked on, and `legal_moves` is stored beside it as a covariate. The record
already separates what I thought it might pool. `N-5` is updated.

What remains true is the screen half: a person whose eye is on the board cannot tell a second
`DECIDE` from a slow `REVEAL`. That belongs to `N-1`, about where a state change is announced.

---

## Stopping decision

- **Pass 1** is built, gated and pushed.
- **Pass 2** identifies one concentrated mismatch, and it is the reveal's durable payoff.
- **Pass 3** shows the record already holds far more than the reveal spends, and specifies the
  smallest surface that would spend it. It is a build, and it needs an owner decision about the
  reveal's copy first.
- **Pass 4** answers no. The probe exists, it is randomised, and it is recorded.

Every remaining material uncertainty is now `OWNER` (which control is primary, whether the
accumulation block replaces or joins the closing sentence) or `FIELD` (`F-1`, `F-2`, `F-3`). No
further technical work reduces either, which is the authority ceiling.
