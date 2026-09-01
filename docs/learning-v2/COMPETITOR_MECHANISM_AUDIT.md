# What other products actually do

**Method and its limit, stated first.** This audit is built from official product documentation
(tier 4) and, where noted, from open-source implementation detail (tier 5) and repeated user
signal (tier 6). It is **not** a hands-on evaluation: no account was created and no product was
used. Rows marked `THIN` were not researched to the depth the twenty questions ask, and are
labelled rather than filled in with plausible guesses.

**Marketing copy is not evidence.** Chessable's "science-backed" and Aimchess's "personalized
lessons" are recorded as *claims*, separately from mechanism.

---

## The one question that separates every product from the target

**Does anything here test whether the learner acts correctly when nothing points at the
opportunity?**

| product | tests uncued transfer? |
| --- | --- |
| Chessable / MoveTrainer | **No.** The position is presented; the task is "play the move here" |
| Chess.com Puzzles / Lichess Puzzles / ChessTempo | **No.** A puzzle announces itself by existing |
| Chess.com Lessons | **No.** Cued exercises after instruction |
| Chess.com Game Review, Aimchess, Dr. Wolf | **No.** Diagnosis and explanation; no transfer test |
| Anki / FSRS | **No.** Cued recall by construction |
| Duolingo / Khan / Brilliant | **No.** Same-format cued assessment |

**Not one product in the mandatory list measures the target construct.** That is the strongest
finding in this file, and it cuts both ways: it is a real gap, and it is also evidence that the
measurement is hard enough that a large, well-funded field has not done it.

---

## Chessable / MoveTrainer

| # | question | answer |
| --- | --- | --- |
| 1 | learning object | a **move in a position**, inside an authored variation tree |
| 2 | source | expert-authored courses |
| 3 | authored by | expert |
| 4 | validated before strengthening | yes, by authorship — a titled player wrote the line |
| 5 | learner does after feedback | replays the move until correct |
| 6 | explanation | yes, prose attached to moves |
| 7 | generation / self-explanation | no |
| 8 | retrieved later | the **move** |
| 9 | **response-congruent** | **yes** — practice response = criterion response |
| 10 | spaced repetition | yes, SM-2-derived with ease tweaks |
| 11 | positive and negative mixed | no — the tree contains correct lines |
| 12 | guidance faded | partially, via hint levels |
| 13 | remembered vs can apply | not distinguished |
| 14–16 | uncued / ecological / false alarms | **no / no / no** |
| 17 | mastery | scheduler confidence on the item |
| 18 | after a mistake | shorter interval |
| 19 | time to value | minutes |
| 20 | friction | large review queues; the standard complaint |

**PRODUCT CLAIM:** "where science meets chess", spaced repetition is "the optimal way to learn".
**ACTUAL MECHANISM:** SM-2-derived scheduling over expert move sequences.
**INDEPENDENT EVIDENCE:** none found for MoveTrainer specifically. The *general* spacing and
retrieval literature is strong (V1) and is not evidence about this implementation.
**Consequence for us:** the leading chess product is already response-congruent. Testing response
congruency in Decision Lab is therefore **confirmatory of a settled convention**, which lowers its
information value — see [`INTERVENTION_COMPARISON.md`](INTERVENTION_COMPARISON.md).

## Anki / FSRS

| # | | |
| --- | --- | --- |
| 1–3 | learning object | a card, authored by the learner or a deck author |
| 4 | **validated before strengthening** | **NO — and its authors say so explicitly.** FSRS models retrievability and stability; card content is not assessed and is not even collected |
| 8–10 | retrieval | the card's answer; spaced |
| 13 | remembered vs apply | not distinguished |
| 14–16 | uncued / ecological / false alarms | no / no / no |

**This is the cleanest external support for a content-validity gate.** The best scheduler in the
field is content-blind by design, so scheduling quality cannot substitute for content quality.

## Khan Academy Mastery

Mastery levels run *attempted → familiar → proficient → mastered*, decided by percent correct
(≥70% familiar, 100% proficient on an exercise). External validation is by **correlation with MAP
Growth**, a same-format standardised test.
**Consequence:** the most-cited mastery system in edtech validates against a cued assessment of the
same kind. It is not evidence that mastery implies transfer.

## Aimchess

**PRODUCT CLAIM:** personalised training from your own games.
**ACTUAL MECHANISM:** metrics over game history, with drills recommended per weakness. `THIN` on
questions 5–18.
**USER EXPERIENCE (tier 6, repeated):** the recurring verdict is *"a diagnostic tool, not a cure"* —
good at identifying weaknesses, with the improvement still left to the user's own discipline. Some
users report the feedback feels personal rather than generic; others regard the personalisation
claims as marketing.
**Consequence:** this is the closest competitor to Decision Lab's current position, and the market
has already named the failure mode the mission is asking about.

## Chess.com Game Review · Lessons · Puzzles · Lichess Puzzles · ChessTempo · Dr. Wolf · Duolingo · Brilliant

`THIN`. Established for these: all present the opportunity (cued), none tests uncued transfer, none
measures false application. Dr. Wolf draws mixed user reports, with the common criticism that it is
not materially different from engine-assisted review. Duolingo and Brilliant were **not** researched
to the twenty questions in this pass and no claim is made about them.

---

## Cross-product synthesis

1. **Every product's learning object is presented, never detected.** The learner is always told
   *here is a position, act*. The target construct begins where that stops.
2. **Content validity is solved by authorship, not by measurement.** Chessable trusts a titled
   author; Anki trusts the deck maker; Khan trusts a curriculum. **Decision Lab trusts the
   learner**, which is the one source with no external check — and is why the gate question is
   sharper here than for any product audited.
3. **Nobody measures false application.** Not one of the twenty-question rows returned a "yes" for
   question 16.
4. **The review-backlog complaint is universal** wherever spacing is used, which is the adherence
   cost of the mechanism with the best learning evidence. See
   [`VOICE_OF_CUSTOMER.md`](VOICE_OF_CUSTOMER.md).
