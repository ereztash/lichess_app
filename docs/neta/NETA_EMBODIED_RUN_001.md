# Neta embodied run 001

**What this is.** One session of `ereztash/Product-Perception-Sensemaking-Architect` run as a live
instrument against `https://lichessapp.vercel.app`, at the build production reported for itself, `gitSha 9d03bbb`, on 2026-09-03. Neta's
files were read in the order its `CLAUDE.md` mandates and `prompts/SYSTEM.md` was executed as system
behaviour rather than paraphrased. `scripts/check_contract.py` was run first and reports
`Neta v0.1 contract: PASS` with all four positive controls red.

**The limitation, stated first because it changes how everything below should be read.** I am not a
source-blind reader of this product. I wrote parts of it earlier the same day. I cannot buy back
naivety by claiming it. What I did instead: recorded every raw signal in ordinary language before
reaching for any explanation, wrote sections 1 through 6 without opening `client/src`, and separated
what I saw from what I know. Where my prior knowledge is doing work, the finding says so. A reader
should treat sections 1 through 6 as an experience log by someone who cannot forget, and every
`FIELD_REQUIRED` row as a place where my reading is worth nothing.

**Quoting.** Every indented quote and every backticked Hebrew string below is the product's
own text, character for character, including its punctuation. Nothing in a quote is my wording.

**Conditions.** Fresh Chromium context per run: no `localStorage`, no cookies, no prior session, no
DevTools open, viewport 1440x900 and 390x844, locale `he-IL`. Production bytes and production
headers, relayed byte-for-byte through Node because the sandbox browser cannot complete a TLS
handshake to the origin directly. The engine reaches `uciok` under that relay on production assets,
so the relay is not standing between the product and its own engine.

---

## 1. What happened, in order

| | | |
| --- | --- | --- |
| 1 | front door, 1440x900 | four ways in, three of them above the fold |
| 2 | pressed `עמדה מהסט המשותף` | board in view, position `11. O-O-O`, black to move, black at the bottom |
| 3 | clicked `e8`, an empty square | it acquired a gold selection ring and offered zero destinations |
| 4 | clicked `b5`, a pawn | ring on `b5`, ring with a centre dot on `b4`, its one legal destination |
| 5 | clicked `b4` to choose the move | the board did not change. The panel now read `b5b4` |
| 6 | four commitment steps | reading, cannot-assess, confidence. The button relabelled to the next missing item at each step |
| 7 | pressed `רשמו את ההחלטה` | button went to `רושם החלטה…` and disabled at **+31 ms**, then vanished at **+133 ms** |
| 8 | the reveal | label `REVEAL` at **+36 ms**, `המנוע מחשב את העמדה שהחלטת עליה…` at **+139 ms**, the engine's sentence at **+2,185 ms** |
| 9 | pressed `לעמדה הבאה` | new position ready to decide at **+144 ms**, URL unchanged at `/play`, commit button reset to `חסר: בחרו מהלך על הלוח` |
| 10 | second decision | same four steps. Press to answer **333 ms**, the engine being warm |
| 11 | second reveal | different in shape from the first, and carrying `שאלה אחת, פעם אחת` |
| 12 | return through the front door | `עוד לא שיחקת כאן משחק, אז אין עדיין מה למדוד` |

On 6 of 15 clean first decisions, step 7 did not lead to step 8. The panel replaced itself with a
second question, `אם לא היית עושה את זה, מה כן היית עושה?`, and the reveal waited behind it.

`O-1` and `O-3` both hold as lived experience and not only as assertions in a test. One press, no
navigation, a position I could immediately move in. The question after the second reveal and not the
first.

---

## 2. Raw signals

Kept in the words they were written in, before any of them had an explanation.

> אני צריך לקרוא ארבע פסקאות לפני שמותר לי לעשות משהו.

> יש פה שלוש הצעות שונות ואני לא יודע איזו מהן שלי.

> לחצתי על ריבוע ריק והוא נדלק כאילו בחרתי משהו.

> רשמתי מהלך והלוח לא זז. הכלי עדיין במקום שלו, והריבוע השני נראה בדיוק כמו לפני שלחצתי.

> המהלך שלי כתוב `b5b4`. ההיסטוריה כתובה `10.Bb3 b5`. אף אחת מהשתיים היא לא איך שהייתי אומר את זה בקול.

> יש עיגול בכפתור. אני לא יודע אם המערכת עובדת או שהיא מחכה לי.

> לחצתי `רשמו את ההחלטה` וחיכיתי למנוע ארבעים וחמש שניות. הוא לא דיבר, כי איפשהו במסך חיכתה לי שאלה שלא ראיתי.

> הוא אמר לי גם אין פה כלום וגם צדקת, בשתי שורות אחת מתחת לשנייה. אני לא יודע איזה מהם התוצאה.

> כתוב `לבן` ומינוס. אני שחור. לא ברור לי אם המספר הזה טוב לי או רע לי.

> אותו מסך אומר לי גם `1 נמדדו` וגם `0 נמדדו`. אני לא יודע מי משניהם עלי.

> עשיתי החלטה שלמה. המספר הגדול נשאר 60.

> לחצתי, המסך אמר `REVEAL`, וראיתי בדיוק אותו לוח. הייתי צריך לגלול פעם וחצי כדי למצוא מה הוא אמר לי.

> עשיתי שתי החלטות שלמות. חזרתי לדלת הראשית, והמסך אמר לי שעוד לא עשיתי כלום.

---

## 3. Experience moments

Six transitions, each with what I saw first, what I expected, what happened, and what was odd.

### 3.1 The front door

Saw first: a heading, `מה קרה בהחלטה, לפני שהמנוע דיבר`, then three paragraphs. Expected: one thing to
press. Happened: four entry controls, at y=432, y=553, y=798 and y=940 on a handset. Odd: the two
that need an account come first, and the one that works without an account is introduced by a
sentence about not having an account.

### 3.2 The deciding screen

Saw first: the board, 632x632 in the centre. Expected: to move a piece. Happened: I clicked an empty
square and it lit up the same way a piece does. Odd: the commit button carries the error state of a
form whose four steps, on a handset, are below it.

### 3.3 Choosing a move

Saw first: a ring on the piece and a ringed dot on its one destination. Expected: after clicking the
destination, the piece to be somewhere different, or the destination to look decided. Happened: the
board is byte-identical before and after the choice. Odd: `b5b4` appearing in a 291px column while
616x616 of board says nothing.

The live region does carry `המהלך שהצעתם: b5 אל b4.` and `b5b4 נבחר. אפשר עדיין לשנות עד לרישום.` A
screen reader is told plainly what the eye is not.

### 3.4 The press

Saw first: the button darken and read `רושם החלטה…`. Expected: to wait. Happened: at 133 ms the
button was gone from the DOM entirely, and there was no spinner anywhere on the page for the
following two seconds. Odd: the acknowledgement is excellent for 100 ms and then withdrawn.

Five states the user brief asked to be separable, as they actually render:

| state | how I could tell |
| --- | --- |
| I clicked | button darkened, +31 ms |
| the product acknowledged me | label became `רושם החלטה…`, +31 ms, same frame |
| the system is working | `המנוע מחשב את העמדה שהחלטת עליה…`, +139 ms |
| the work finished | the engine's sentence appeared, +2,185 ms cold |
| the state visibly changed | on desktop, at the same moment. On a handset, only after scrolling |

The first two are one event and cannot be told apart. The last two are one event on desktop and two
on a handset. That is the whole of it.

### 3.5 The question that is not a reveal

On the runs where it fired, the press produced a screen still labelled `DECIDE`, correctly, with a
new question in the panel and the same board beside it. It asks for a second move, the one I would
have made instead, played on the same board.

Nothing in the 616x616 region told me its job had changed. I read it as a stall. It is not a stall.
It is the only mechanism that separates "did not see the engine's move" from "saw it and rejected
it", and the second reveal says so itself: `רק מהלך אחד נרשם כנשקל, ולכן אי אפשר לדעת כאן אם לא ראית
את המהלך של המנוע או שראית ודחית.`

### 3.6 The reveal

Saw first: the four blocks, in the frozen order, beginning with what the decision does not say.

The first reveal, where my move matched the engine's:

> אין כאן דבר שהמדידה תומכת באמירתו. בחרת בתוך רעש ההערכה, והביטחון שלך לא היה נמוך ממנו. זו תוצאה תקינה, לא מסך ריק.

and 60px below it:

> בחרת את b5b4, וזה גם המהלך של המנוע.

The second reveal, where it did not match, is a different object:

> d5d4 עלה 436 ס״פ מול d7e5. מה d7e5 עושה בעמדה הזאת ש-d5d4 לא עושה? המשפט הזה יצא מהשוואה למנוע בלבד — לזה גם ניתוח משחק רגיל היה מגיע. מבוסס על: 436 ס״פ בעומק 14.

Eight lines under that last sentence, the one-time question:

> מה קיבלת כאן שלא היית מקבל מניתוח רגיל של המשחק?

Both sentences are honest. Their neighbourhood is the observation.

---

## 4. Cognitive cost and payoff, per step

Cost is what the step asks of a person. Payoff is what they hold afterwards that they did not hold
before. Neither column is a judgement about anyone.

| step | cost | payoff at that moment |
| --- | --- | --- |
| inspect the position | read a board and a header, `11. O-O-O`, no side named except in a 74x24 label | knowing whose turn it is, if the label was read |
| choose a move | two clicks, plus a click on nothing if the first one lands on an empty square | a string in a side panel. The board is unchanged |
| declare a reading | pick from ten chips, at least one required | a vocabulary I did not have. This is the step that most repays its cost |
| declare what I cannot assess | pick from seven, at least one required | the same, and it is the harder question |
| declare confidence | one of seven, 51px wide each | none yet. The payoff is deferred to the reveal, by design |
| wait | 2.2s cold, 0.3s warm, or an unbounded wait behind a question I did not see | none |
| read the reveal | on desktop, none. On a handset, one and a half screens of scrolling | a sentence about my own decision, which is the entire product |

The instrument's friction is in rows three, four and five, and it is earning its keep. Row three is
where a person acquires language they can reuse. The cost that is not earning anything is row six on
the gated runs, and row seven on a handset.

---

## 5. The return session

Two complete decisions in one profile: move placed, reading marked, cannot-assess marked, confidence
declared before the engine spoke, both revealed. The play screen showed `2 נמדדו ונקראות בחלק אחר של
הרשומה` and `0 נמדדו מתוך 2 שנרשמו`, so the record holds them.

Returning through the front door, the surface changes: the marketing introduction is replaced by the
record view, headed `הרשומה` and `ללוח`. Its first sentence is:

> עוד לא שיחקת כאן משחק, אז אין עדיין מה למדוד.

and below it, `0 החלטות מדודות · חסרות עוד 60`. The only wide control above the fold is
`שחק משחק קצר`. There is nothing that names, resumes or acknowledges the two decisions.

**Two controls were run against this.** A profile with zero decisions shows the identical sentence.
A profile with three moves played in an abandoned blitz game shows the identical sentence. So the
sentence is literally true in all three cases, and the surface does not distinguish a person who has
done nothing from a person who has done the thing the product asked for twice.

Below it, a list of partitions each needing `עוד 30 החלטות`, and one that says it will never open:

> אלה לא ייפתחו מעוד משחקים: לא נשמר שעון בהחלטות האלה, ולכן החלוקה הזאת לא תתמלא — לא משנה כמה עוד תשחק.

That sentence is admirable and it is the fourth thing a returning participant reads.

---

## 6. The handset, 390x844

Measured, not estimated.

| | deciding screen | reveal |
| --- | --- | --- |
| page height | 1583 | 1844 |
| board square | 45x45 | 45x45 |
| screen label | `DECIDE` y=200, 74x14 | `REVEAL` y=236, 74x14 |
| the commit button | y=827 | n/a |
| the four commitment steps | y=967, 1076, 1134, 1192, all below the button that reports them | n/a |
| first reveal heading | n/a | y=899 |
| the finding sentence | n/a | y=1133 |
| continuation control | n/a | y=1454 |

Nothing in the reveal's four blocks is inside the first viewport, and the page does not scroll
itself. Above the fold, the screen before the commit and the screen after it carry the same
masthead, the same counter strip, a header, and the same board. The text that changes is six
characters at 14px.

`F-1` in `docs/PRE_HUMAN_CEILING.md` recorded y=893 for this. The measurement here is y=899 for the
heading and y=1133 for the sentence that carries the payoff. The recorded estimate was right and was
measuring the wrong line.

45x45 squares sit exactly at the floor of a comfortable touch target, with the file and rank
coordinates rendered inside the same cells as the pieces.

---

## 7. Findings

Six, each validated against `schemas/finding.schema.json`. Full JSON in [`findings/`](findings/). The instrument that produced every number is in
[`harness/`](harness/), including the two scripts whose own defects produced findings that were wrong.

| | raw signal, short | status | authority | evidence |
| --- | --- | --- | --- | --- |
| `N-1` | the reveal is below every fold on a handset | `DISCRIMINATE_FIRST` | `DESIGN_MECHANISM` | `MEASURED` |
| `N-2` | `1 נמדדו` and `0 נמדדו` on one screen | `BUILD_READY` | `REPO` | `REPRODUCED` |
| `N-3` | the return screen says I have done nothing | `DISCRIMINATE_FIRST` | `DESIGN_MECHANISM` | `REPRODUCED` |
| `N-4` | choosing a move does not change the board | `DISCRIMINATE_FIRST` | `DESIGN_MECHANISM` | `REPRODUCED` |
| `N-5` | a question, not a reveal, on 6 of 15 presses | `DISCRIMINATE_FIRST` | `REPO` | `REPRODUCED` |
| `N-6` | "nothing here" and "you were right", 60px apart | `FIELD_STOP` | `FIELD` | `FIELD_REQUIRED` |

Three things were nearly written as findings and are not, because a discriminator killed them.

| nearly a finding | what it actually was |
| --- | --- |
| the engine does not start on production | my `REVEAL` detector was matching the masthead `COMMIT · THEN REVEAL`. The engine reaches `uciok` on production assets in this same harness |
| the reveal shows a different position than I decided on | my confidence selector, `/^5/`, matched `5.Be3` in the move rail and scrubbed the game. The product said `הבחירה בוטלה.` and I did not read it |
| the counterfactual question fires on engine agreement | it does not. Three moves, one of them the engine's, appeared in both outcomes |

---

## 8. Rubric

Scored against `eval/RUBRIC.md` as a self-report, which is worth exactly what a self-report is worth.

| | criterion | | |
| --- | --- | --- | --- |
| R1 | raw signal preservation | pass | section 2 is verbatim, written before any explanation |
| R2 | observation discipline | pass | every measurement in sections 1, 5 and 6 is a number or a quoted string |
| R3 | hypothesis compression | pass | maximum three mechanisms per finding, schema-enforced |
| R4 | discrimination before redesign | pass | four discriminators were run, three killed a candidate finding |
| R5 | authority assignment | pass | one `FIELD`, two `REPO`, three `DESIGN_MECHANISM` |
| R6 | evidence calibration | pass | allowed states only, no invented percentages. `6 of 15` is a count |
| R7 | instrument protection | pass | every finding carries `must_not_change`, and the two that touch frozen protocol are not `BUILD_READY` |
| R8 | transfer | partial | `N-1` and `N-5` give reusable distinctions. `N-4` mostly restates |

**7.5 of 8.** No critical failure: no metaphor stood in for a mechanism, nothing was asserted about
what external users notice, no fabricated precision, no backlog, no friction removed for being
friction, and no finding framed as a property of a person.

The honest deduction is on R8. Naming a distinction is not the same as making it reusable, and
`N-4`'s "three states share one mark" is closer to a description than to a tool.

---

## 9. `BUILD_READY`

One. `N-2`, and it is small on purpose.

Two lines 19px apart use the verb `נמדדו` with different numbers. Neither number is wrong. One
counts decisions measured anywhere including the shared bank, the other counts decisions inside the
personal 60-decision denominator, where bank decisions do not count. A number that changes and a
number that does not, under one verb, reads as a defect.

The intervention is to give each line its own noun. No counted quantity moves, no denominator moves,
nothing in `ACQUISITION_PROTOCOL_V1` §1 through §6 is touched.

**Done, in `client/src/lib/loop-position.ts`.** `נמדדו` stays with the decisions that were measured.
The line that reports this search now says `נספרות`, which is what it counts. Both colliding
branches were changed, the ordinary one and the narrowed one, because both append the same sentence.

Held by `two registers, never one verb` in `tests/client/loop-position.test.ts`, three cases: the
verb collision, the same collision on the narrowed branch, and neither number moving. Three
deliberate breaks, each red for its own reason: the original wording restored, the narrowed branch
alone, and a rename that moves the denominator's noun.

Walked on the built artefact from an empty profile, one bank decision:

> עוד 60 החלטות מדודות עד שאפשר לומר משהו. 1 נמדדו ונקראות בחלק אחר של הרשומה — הסט המשותף, תרגול או משחקים שיובאו.

> 0 מתוך 1 שנרשמו נספרות בחיפוש הזה

3,025 tests pass, 35 gates pass, 35 positive controls red.

`N-3` is the higher consequence finding and it is deliberately not here. It is one sentence away
from `BUILD_READY` and the sentence belongs to the owner: the record surface counts completed games,
and whether a bank decision should be visible there is a decision about what the record is for, not
a copy fix. The discriminator has already been run twice. What is left is a choice.

---

## 10. `FIELD_STOP`

One. `N-6`, and it is `F-2` under another name.

The reveal tells a person what it claims and what it cannot claim, in the same block. Whether those
land as one coherent message or as a contradiction is not knowable from the screen, is not knowable
from the DOM, and is not knowable by me. It needs a person restating, unprompted, what the reveal
said and what it said it could not say.

What can be done before that person exists, and it is not a redesign: record which reveal shape
preceded each value-reconstruction answer. The commodity disclaimer, `— לזה גם ניתוח משחק רגיל היה מגיע`, appears on some reveals and not others, eight lines above a question asking what this gave
that ordinary analysis would not. If the answers are pooled across both shapes, the pooled number
means nothing.

---

## 11. What this run still does not know

- **Whether anyone reads the reveal.** Measured: where it renders. Not measured, and not measurable
  from here: whether it is read. `F-1`.
- **Whether the vocabulary lands.** `F-2`. My reading is not evidence.
- **Why the counterfactual question fires when it does.** Not the move, not the click count, not the
  elapsed time. `N-5` names the discriminator, which is one read of the source, and it matters more
  than it looks: if it is a randomised arm, then every reveal-to-continuation rate currently mixes
  two different experiences under one number.
- **Which way the evaluation bar reads.** The bar showed `-0.78` labelled `לבן` with the fill mostly
  at the `לבן` end, in a position where the number favours black. I did not run the discriminator, a
  position with a large unambiguous evaluation, so this stays a raw signal and is not a finding.
- **Whether the record surface should show bank decisions.** `N-3`. An owner question.
- **What a person does after the return screen tells them they have done nothing.** They leave or
  they play. `R-23` means the trial cannot tell which, and cannot tell why.

---

## What this run did not do

It did not touch the instrument. Confidence timing, reveal timing, the continuation definition, the
acquisition denominators, `O-1`, `O-2`, `O-3` and the protocol version are exactly where they were.
The one intervention this run authorises is a noun.
