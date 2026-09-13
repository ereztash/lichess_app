# What looking at it found

§16 requires real frames, not numbers about frames. `npm run contact-sheet` drives the journey at
390×844, `deviceScaleFactor: 2`, touch on, `isMobile`, against the shipped build, and writes 20
frames with nothing attached. The import panel is not on that path, so it was rendered separately
from the component's own markup and the shipped stylesheet and measured in the same engine.

## What was looked at

| frame | what it is |
| --- | --- |
| `01-front-door` | arrival, cold |
| `04-decide`, `05-decide-whole` | the core move, the screen two of three cold testers could not complete |
| `15-reveal`, `16-reveal-whole` | the n=1 payoff |
| `19-returning-front-door-whole` | the screen a player returns to after one decision |
| the import panel, before and after | the surface this lane changed |

## One defect found, and repaired

The import panel's unmeasurable row read as "החלטות אחרי … יותר משתי … דקות" with the reason
interleaved into the scope. Measured: **73.59px** against the **90px** floor this repository already
holds the other screen to. Cause, repair and the instrument that now holds it are in
`FALSE_GREEN_NOTES.md` §4 and `IMPLEMENTATION_REPORT.md` §4b.

The eye found it. No number in the repository was red.

## Three things that were already right, and are worth recording as such

**The arrival frame is already an exchange, not a promise.** The front door reads:

> מה קרה בההחלטה, לפני שהמנוע דיבר
> מנוע יכול להגיד לכם איזה מהלך היה טוב יותר. הוא לא יודע מה קרה אצלכם בדרך לבחירה.
> כאן ההחלטה נרשמת לפני שהמנוע מדבר.

That is P0 of `PLAYER_PATH.md`, already shipped, with no outcome promise in it. It is a large part of
why the run's bound on the front-half build to "a sentence" was the right size: the frame was there,
and what was missing was the same fact at the import's scale.

**The core move names the act.** "אתם לבן. בחרו מהלך על הלוח." sits directly under the board, and
the missing-step chip repeats the act rather than the position. This is the repair for the n=3
failure, and it looks repaired. It is still **not revalidated with a cold user**, which is row 0 of
`FIELD_TEST_PROTOCOL.md` and is a stop condition rather than a finding.

**The reveal labels its own evidence kind honestly, including when the answer is unflattering.**
On the frame captured, the payoff reads:

> יצא מהשוואה למנוע בלבד. לזה גם ניתוח משחק רגיל היה מגיע.

That is `EVIDENCE_LABEL.engine`: the product saying, on its own payoff screen, that an ordinary
analysis would have reached the same place. It is the correct label for that decision and it is a
real M1 risk, because a cold player's **first** reveal can be the one that says so. The protocol's
`T_payoff` asks exactly that question ("would a normal game analysis have told you the same
thing?"), so the risk the screen actually carries is the risk the field test measures.

## One candidate recorded and deliberately not built

`19-returning-front-door-whole` shows "מה עדיין לא ברור?" as eleven rows, five of which end in the
identical quantity "עוד 30 החלטות". The rows differ in the bucket and the question they name, so
`GATE-SAID-ONCE` is correct not to fire: they are not the same sentence. What repeats is the
**number**, and this repository already has a written position on that — `bucket-absent-note` exists
because "a value that is the same on every row is not data, and rendering it per row is the
redundancy effect with the volume turned up".

It is not built here, for three reasons and none of them is that it does not matter:

1. The run bounded the front-half build to naming an existing payoff, and this is not that.
2. It is mechanism **M2**, journey legibility, which `FIELD_TEST_PROTOCOL.md` is built to identify
   and which `T_journey` decides. Repairing it now on my own reading is the encodability-bias move
   the kernel's gate names: "we can build it" is never sufficient permission.
3. A wall of readiness rows and a legibility failure look identical from here. If `T_journey` comes
   back `neither` with `T_payoff = yes`, this is the first place to work, and the protocol will have
   said so rather than a screenshot having said so.

Recorded here so that the next lane does not have to find it again, and so that nobody reads its
absence from the diff as its absence from the screen.
