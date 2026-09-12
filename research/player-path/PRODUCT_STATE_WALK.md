# Product-state walk of the shipped build

Audit only. Nothing in this file was repaired while it was being written.

## What was walked, and how

Build: `dist/public` produced by `npm run build` at `4b322f2e78bd41190b91b26021bdd3daeb54c4f6`.
Served from a static file server with `/api/*` answered `503`, which is the deployment the
front door itself describes (*"ההחלטות נשמרות בדפדפן הזה בלבד"*). Chromium at 390x844, one fresh
profile per walk, the shipped Stockfish wasm in a real Worker, no route interception except
`https://lichess.org/api/games/user/**`.

Every row below was produced by pressing controls in that browser and reading the rendered DOM and
`localStorage`. Where a state was not reached, the row says so and says what stopped the walk.
Nothing here is derived from reading the source alone; source is cited only to name the mechanism
behind something that was first observed.

The walks: a cold arrival at `/` and `/play`; the front door's username handoff; a live game in
each of its two reveal timings; the shared bank route; a blitz game played and resigned; the
import room.

## The two evidence lanes, because the table needs them

The shipped product holds **two** populations, with two floors, two denominators and two screens
that report them.

* **The decision lane.** `decisions` in `decision-lab.record.v1`. Written by `/play`. Each row
  carries a `purpose`. `shared/evidence-policy.ts` (`EVIDENCE_POLICY_VERSION = 4`) admits exactly
  one purpose into discovery, `play`, and refuses `first`, `anchor`, `import`, `drill`, `transfer`
  and legacy rows. Floor: `MIN_BUCKET_N * 2 = 60` **scored** decisions. Reported on the record page
  as `0 מתוך 60 החלטות שהחיפוש הזה סופר`.
* **The blitz lane.** `blitzGames` in the same record. Written by `/blitz`, only when a game
  finishes. Its own strata, its own blocker taxonomy (`no-games`, `nothing-scored`,
  `nothing-asked`, `too-few-readable`, `no-split-yet`), its own floor. Reported on the same record
  page as `עוד 30 משחקים לפחות יאפשרו בדיקה ראשונה`.

Observed: a finished blitz game leaves `"decisions":[]` and writes only `blitzGames`. The lanes do
not feed each other.

## §3 State walk

| State | Reachable? | What user sees | What system knows | What system does NOT know | Primary next action exposed | Why that action follows | What it can establish | Authority |
|---|---|---|---|---|---|---|---|---|
| 1. Cold arrival | REACHABLE (`/`) | The value paragraph, then three doors: `קחו אותי לעמדה` (primary), `עמדה מהסט המשותף`, `משחק בליץ קצר` | Nothing. No record key exists | Whether the visitor plays chess, at what level, or why they came | `play-first-decision:קחו אותי לעמדה` | It is the only door that produces a position from the visitor's own play | That a stranger can be moved from a page to a board | REPO |
| 2. Historical import | REACHABLE (front door, and `ייבוא לפי שם משתמש` in the reveal rail) | Five games listed with result, speed, date and opening; one control `נתחו את 5 המשחקים ומדדו את הסוגים` | The game list from the Lichess public API. No evaluation yet | Whether any of those games contains a separable type | `נתחו את 5 המשחקים…` | The list alone is not a reading; the analysis is what turns it into one | That games exist and can be fetched and replayed | REPO |
| 3. Imported history, separated or not | REACHABLE, walked. Five games, 240 positions, ~80s | The finding first: *"הדיוק הנמוך ביותר שנמדד הוא בהחלטות מתוך עמדה מנצחת: 25% n=60 לעומת 43% n=70 בסוג הבא אחריו. החלטה שתרשמו מוסיפה מה שהמשחקים האלה לא מחזיקים: ביטחון שהצהרתם לפני שהמנוע דיבר. משחק שכבר שוחק לא יכול לייצר את זה, בשום כמות."* | Per-decision cp loss over the imported games, bucketed, with both n's | Whether the imported behaviour is the behaviour the player has now, and what the player believed at the time | A live decision | The sentence names exactly what the retrospective games cannot hold | A descriptive contrast inside games already played, and nothing about confidence | REPO |
| 4. First prospective decision | REACHABLE | The board at the handed-over ply, a 2-step commitment (`המהלך שבחרתם`, `כמה אתם בטוחים חובה`), `חסרים 2 פרטים. החלטה חלקית לא נרשמת: זה הכלל, לא תקלה` | The position, the ply, that this is `purpose: "first"`, and that a confidence is always asked here | What the player considered and did not place on the board | `commit-decision` | The commitment is the only thing that can be recorded before the engine speaks | One decision with a stated confidence, recorded pre-verdict | REPO |
| 5. Reveal | REACHABLE | `מה ההחלטה הזאת עדיין לא אומרת`, `מה קרה כאן`, `מה שווה לבדוק`, `מה נצבר`, and the strip `0 מתוך 1 שנרשמו נספרות בחיפוש הזה` | cp loss, the engine's move, search depth, the noise floor and the speaking threshold | Whether the engine's move was considered and rejected. It says so: *"רק מהלך אחד נרשם כנשקל"* | `לעמדה הבאה` (a bank position) and `להיסטוריה המלאה` | The reveal is finished; the next measurement is another decision | That one decision was scored, and its inference limits | REPO |
| 6. Evidence accumulation | REACHABLE, in both lanes, and each lane counts a different thing | Decision lane: `עוד 60 החלטות מדודות עד שיהיה מה לומר`. Blitz lane, after one game: `עוד לא הצטבר מספיק כדי לבדוק משהו. עוד 30 משחקים לפחות יאפשרו בדיקה ראשונה` | How many rows exist, how many carry a confidence, how many the engine has scored, and which stratum each belongs to | Whether the player will produce enough of either | `שחק עוד משחק` / `לעמדה הבאה` | Both counters move only on new evidence | Progress toward a floor, and nothing about skill | REPO |
| 7. Candidate pattern | NOT REACHED IN THIS WALK. Decision lane: blocked, see §7 B-1. Blitz lane: reachable in principle at ~30 finished games, not walked | Unseen | — | — | — | — | — | REPO (decision lane) / FIELD (blitz lane cost) |
| 8. Context rejection / candidate rejection | NOT REACHED. Downstream of 7 | Unseen | — | — | — | — | — | REPO |
| 9. Accepted learning object | `NOT_REACHABLE` | Nothing. `EXPERIMENTAL_LEARNING_ENABLED` is `=== "true"` and no deployment sets it; the composer's strings are absent from the built bundle | — | — | None exposed | — | — | OWNER |
| 10. Player-owned question / rule | `NOT_REACHABLE` in the rule sense, same flag. Partly present as the reveal's `מה שווה לבדוק`, a question addressed to the player and stored nowhere | A question in the reveal, e.g. *"מה היית צריך לדעת כדי לבחור בין a4 ל-e4?"* | That a question was rendered | Whether the player answered it, ever | None | — | — | OWNER |
| 11. Guided practice | `NOT_REACHABLE`. The drill control lives in `ClaimPanel` behind a claim, and no claim is reachable (7) | `מה חוזר` renders `מהלכים שנרשמו` / `מתוכם נבדקו מול המנוע` and no claim | Two counts | — | None | — | — | REPO |
| 12. Prompted check | `NOT_REACHABLE`. Transfer runs are behind the same flag as 9 | — | — | — | — | — | — | OWNER |
| 13. Ordinary / unprompted play | REACHABLE, and only by two routes, neither of them the default: (a) `/blitz`; (b) `/play` → `עמדה אחרת` → `משחק חדש` → **`בסוף המשחק`**. Under the default `אחרי כל החלטה` the game stops after one decision (§7 B-1) | (b) produces `play@2`, `play@4`, `play@6`, `play@8` in the record, walked | The purpose, ply, position and game id of each ordinary decision | Whether a confidence was stated: it is drawn at `ASK_RATE = 0.15` | The board itself; the game advances without a control | Free play is the only stratum discovery admits | Behaviour nothing in the product was trying to change | REPO |
| 14. Recurring / weakened / refuted / retired | `NOT_REACHABLE`. These are `ruleJourney` stages and rules are behind the flag in 9 | — | — | — | — | — | — | OWNER |
| 15. Returning user | REACHABLE | The resume screen above the front door: what is known, one next step, `למה אנחנו אומרים את זה?` | Which blocker is the live one, how many games changed since the last visit, how many decisions are read elsewhere | Whether the player came back for the reason they wrote down | One `kind: "play"` step per blocker | Each blocker has exactly one thing that unblocks it | That the record grew, or did not | REPO |
| 16. Multiple simultaneous learning objects | `NOT_REACHABLE`. Downstream of 9 | — | — | — | — | — | — | OWNER |
| 17. No currently actionable object | REACHABLE, and it is the ordinary state | `לא מצאתי במשחק הזה לבדו משהו שכדאי להסיק ממנו עליך`, `○ אירוע אחד`, `מה זה אומר?`, then `שחק עוד משחק` with `עוד משחק מוסיף החלטות חדשות, וזה מה שמאפשר לבדוק אם משהו חוזר` | That the scan ran and returned nothing at this n | Whether more evidence would separate anything | `שחק עוד משחק` | Nothing else moves the blocker | That the scan ran and was negative at this n | REPO |

## §4 The state machine actually reachable

Owner column: **P** player, **E** evidence record, **L** learning object.

| # | Source | Trigger | Evidence requirement | Destination | Reversible? | Owner | Claim boundary |
|---|---|---|---|---|---|---|---|
| T1 | Cold `/` | `קחו אותי לעמדה` + username | A public game that reached past the opening | `/play`, one position, `source: "finished"`, `firstDecisionPly` set | Yes, back to `/` | P | The position was chosen without looking at what the move produced |
| T2 | Cold `/` | `עמדה מהסט המשותף` | The bank has an unanswered position | `/play`, `source: "finished"`, `purpose: "anchor"` | Yes | E | A bank contrast is a fact about the bank |
| T3 | Cold `/` | `משחק בליץ קצר` | None | `/blitz`, time control chooser | Yes | P | None yet |
| T4 | Any board with a decision open | Legal move placed **and** every required field answered | `חסרים N פרטים. החלטה חלקית לא נרשמת` | `committed` | No. The row is written | E | The confidence was stated before any evaluation existed |
| T5 | `committed` | Counterfactual draw, ~1 in 3 | — | `PROBE_STAGE` | No | E | The alternative named is the player's, not the engine's |
| T6 | `committed` / probe answered, `אחרי כל החלטה` | Engine returns | Search at depth 14 | `revealed` | No | E | cp loss, noise floor 0.30, speaking threshold 100 |
| T7 | `committed`, `בסוף המשחק` | Engine returns | Same search, verdict withheld | `deciding` at the next ply, opponent having replied | No | E | The row exists; the player has not been told its verdict |
| T8 | `revealed` | `לעמדה הבאה` | The bank still has an unanswered position | `deciding` on a bank position, current game abandoned | No | P | Navigation only. Continuation is counted on the next placed move, not on this press |
| T9 | `revealed` | `לבדוק אם זה חוזר` | `continuationAfter` returns non-null | `deciding` at `revealPly + 2` (loaded) or after the opponent's reply (live) | No | E | The next decision is a second observation, not a confirmation |
| T10 | `revealed` | `להיסטוריה המלאה` | — | `/` | Yes | P | — |
| T11 | `/blitz` | A time control | — | A running game, engine silent | No, once a move is played | P | The clock stops for the confidence question |
| T12 | Running blitz | Move placed | Draw at `BLITZ_ASK_RATE = 0.15` | Confidence asked, or not | No | E | An unasked decision is not an unconfident one |
| T13 | Running blitz | Mate, flag or `פרישה` | — | Post-game, then a queued analysis | No | E | Nothing is written to the record until the game is over |
| T14 | Post-game | Analysis completes | Every decision scored | Blitz reading recomputed | No | E | One game alone supports no conclusion about the player |
| T15 | `/` with a record | Page load | `readResume` picks the live blocker | Resume screen with one next step | Yes | E | The blocker names what is missing, not what the player lacks |

Three things the machine does **not** contain, and their absence is what makes several rows above
read `NOT_REACHABLE`: no transition from a finished blitz game into the decision lane; no
transition from any lane into a learning object while the flag is off; and, under the default
reveal timing, no transition out of a live game's opening reveal except by leaving the game.

### The nine possible collapses, inspected

1. **goal <-> progress. NOT COLLAPSED.** `GoalNote` stores the player's sentence and prints beside
   it: *"אף מספר באפליקציה הזו לא מודד כמה התקרבתם לזה. מה שנמדד כאן הוא ההחלטות שלכם, וזה דבר
   אחר."* No counter is scoped to the goal.
2. **evidence accumulation <-> skill improvement. NOT COLLAPSED at the sentence level.** Every
   counter observed names decisions or games, never ability: `עוד 60 החלטות מדודות עד שיהיה מה
   לומר`, `עוד 30 משחקים לפחות`. The published refusal list carries *"לא ימליץ מה ללמוד, הוא מודד,
   לא מאמן"*. **Structural residue:** the only thing that moves on either counter is effort, so
   the sole feedback a continuing player receives is a number rising. That is an honest measure of
   evidence and it is also the only measure of anything, which is a value question and not a
   claim error. FIELD (M6).
3. **practice <-> learning. NOT APPLICABLE in the shipped build.** Drill and transfer, the two
   surfaces where this could collapse, are unreachable (states 11, 12). The separation exists in
   `evidence-policy.ts` and is not currently exercised by anything a user can reach.
4. **prompted success <-> unprompted transfer. NOT APPLICABLE, same reason.** The policy that would
   enforce it (`transfer` refused by discovery, `claim-validation` scoped to a matching test) is
   present and unexercised.
5. **self-report <-> observed behaviour. NOT COLLAPSED.** Confidence is the player's; `accurate` is
   the engine's; `scoreDecisions` excludes any row where confidence is null rather than defaulting
   it, and counts the exclusions separately as `withoutConfidence`. The record page renders both
   `מהלכים שנרשמו` and `מתוכם נבדקו מול המנוע` rather than one number.
6. **rating <-> app-caused improvement. NOT COLLAPSED.** No rating, score, streak or badge exists
   anywhere in the build; the opponent is described as *"עומק חיפוש של Stockfish, לא דירוג"* and a
   test holds the absence.
7. **detector silence <-> absence of weakness. NOT COLLAPSED, and this is the best-defended
   boundary in the product.** `no-split-yet` reads *"בדקנו את כל החלוקות שיש לנו, ואף אחת מהן לא
   הפרידה בין ההחלטות שלך"*, the post-game reads *"לא מצאתי במשחק הזה לבדו משהו שכדאי להסיק ממנו
   עליך"*, and the reveal reads *"זו תוצאה תקינה, לא מסך ריק"*.
8. **executed move <-> intended move. NOT COLLAPSED.** Observed in the live reveal: *"רק מהלך אחד
   נרשם כנשקל, ולכן אי אפשר לדעת אם מהלך המנוע נשקל ונדחה. מהלכים שנשקלו בלי להניח אותם על הלוח
   אינם נרשמים."* The record stores placements and the screen says that is what they are.
9. **system-elicited behaviour <-> natural discovery evidence. NOT COLLAPSED in policy, and the
   policy is currently the whole of it.** `discovery` admits `play` and nothing else, with the
   reason written on each refusal. **Residue:** the one stratum it admits is also the one the
   default live-game route cannot produce (§7 B-1), so the policy is protecting a population that,
   by the default route, stays empty.

**One collapse found that was not on the list, and it is the material one.**

**C-1. Two lanes, two floors, one screen, and nothing says they are two.** The record page renders
`0 מתוך 60 החלטות שהחיפוש הזה סופר` and, from the same visit, `עוד 30 משחקים לפחות יאפשרו בדיקה
ראשונה`. Both are true of different populations. A reader has no way to tell that finishing 30
blitz games moves the second number and not the first, or that the first number is fed only by a
route the default new-game setting does not take. The vocabulary distinguishing `נמדדו` from
`נספרות` was built for exactly this hazard and covers the decision lane only; the blitz denominator
is outside it.

## §5 Six-question orientation audit

Scores: `CLEAR_FROM_PRODUCT` / `PRESENT_BUT_FRAGMENTED` / `ABSENT` / `MISLEADING` / `NOT_APPLICABLE`.

| State | Q1 why here | Q2 what it knows | Q3 what it does not know | Q4 what to do now | Q5 why this | Q6 what becomes knowable |
|---|---|---|---|---|---|---|
| 1. Cold `/` | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT (nothing, said) | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | PRESENT_BUT_FRAGMENTED |
| 2. Import list | PRESENT_BUT_FRAGMENTED | CLEAR_FROM_PRODUCT | PRESENT_BUT_FRAGMENTED | CLEAR_FROM_PRODUCT | PRESENT_BUT_FRAGMENTED | PRESENT_BUT_FRAGMENTED |
| 4. First decision | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | PRESENT_BUT_FRAGMENTED |
| 5. Reveal | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | PRESENT_BUT_FRAGMENTED | PRESENT_BUT_FRAGMENTED | **MISLEADING** |
| 6. Accumulation | PRESENT_BUT_FRAGMENTED | PRESENT_BUT_FRAGMENTED | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | **MISLEADING** |
| 13. Ordinary play, deferred | PRESENT_BUT_FRAGMENTED | PRESENT_BUT_FRAGMENTED | PRESENT_BUT_FRAGMENTED | CLEAR_FROM_PRODUCT | ABSENT | PRESENT_BUT_FRAGMENTED |
| 13b. Ordinary play, blitz | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT |
| 15. Returning | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | PRESENT_BUT_FRAGMENTED |
| 17. Nothing actionable | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT | CLEAR_FROM_PRODUCT |

The four scores that are not routine, each tied to what was observed:

* **State 5, Q6 MISLEADING.** The reveal's `מה נצבר` block ends *"ההחלטה הבאה תראה אם זה חוזר."*
  In the default live game there is no next decision to be had: the only acts offered are a bank
  position in a different game and the record. The sentence describes a continuation the state it
  is printed in cannot supply.
* **State 5, Q4/Q5 PRESENT_BUT_FRAGMENTED.** `לעמדה הבאה` and `להיסטוריה המלאה` are offered
  side by side with no statement that the first abandons the game in progress.
* **State 6, Q6 MISLEADING.** C-1. Two denominators, no statement that they are two populations, so
  "what becomes knowable after I do this" has two answers and the screen picks neither.
* **State 13 deferred, Q5 ABSENT.** Nothing on that screen explains why the verdict is silent, why
  the confidence question appears roughly one time in seven, or that these are the decisions the
  search actually counts. The mode is chosen once in a setup panel and never described again.

## §6 Negative and boring states

| State | Reachable? | What the product says | Is there still a truthful reason to continue? |
|---|---|---|---|
| No personal pattern | REACHABLE (blitz lane) | `בדקנו את כל החלוקות שיש לנו, ואף אחת מהן לא הפרידה בין ההחלטות שלך` | Yes, and it is stated: more decisions can separate what this n could not. The sentence refuses to call the result a shortage |
| Insufficient evidence | REACHABLE, both lanes | `עוד לא הצטבר מספיק כדי לבדוק משהו. עוד 30 משחקים לפחות…` / `עוד 60 החלטות מדודות…` | Yes in the blitz lane, where the floor is named and one action moves it. **In the decision lane the reason is not truthful as shipped**: the default route cannot move that counter at all (§7 B-1) |
| Candidate later rejected | NOT REACHABLE | — | Product-contract gap. The state exists in `JOURNEY_STAGES` (`CONTEXT_CHECKED`) and nothing a user can reach produces it |
| Candidate refuted | NOT REACHABLE | — | Product-contract gap, same cause |
| Prompted success, no ordinary-play evidence | NOT REACHABLE | — | Not a gap: the surfaces that would create the hazard are off. The policy that would govern it is present |
| No observed improvement | NOT APPLICABLE | The product does not claim improvement anywhere and says so | Nothing to repair. It is the deliberate contract |
| Returning user, no active object | REACHABLE, and it is the ordinary case | Resume screen, one blocker, one step, `למה אנחנו אומרים את זה?` | Yes, in the blitz lane |

Nothing was added to fill the two gaps.

## §7a The one repair

B-1 below was repaired in the commit that carries this file, and nothing else was.

`continuationAfter` now takes `revealPly: number | null`, `null` meaning no reveal is open, and
`Home` derives that from `stage === "revealed"` rather than from the ply's sign.
`tests/client/a-ply-that-was-also-a-state.test.ts` holds the truth table;
`tests/layout/a-live-game-that-can-reach-its-second-decision.layout.test.ts` walks the built bundle
from the opening decision of a live game to a `play` row in the record. Its positive control was
measured: restoring the old sentinel turns the walk red at the missing continuation.

It cost 26 bytes of entry chunk, which was 26 more than the raw ceiling had left. No ceiling was
raised. `stage === "revealed"` was written five times in `Home.tsx` counting the new one; folding
the four that already existed into one `const revealed` took back more than the fifth cost, and the
entry chunk came in at 694,247 bytes against a ceiling of 694,272.

What that changes in the rows above, and only this:

* State 5, Q6 was `MISLEADING` because *"ההחלטה הבאה תראה אם זה חוזר"* was printed in a state with
  no next decision available. In a live game there now is one. It stays `MISLEADING` for the
  front-door handoff and the bank, where the sentence is printed on a reveal whose game genuinely
  holds no second decision.
* State 13 is now reachable under the default reveal timing, not only under `בסוף המשחק` and
  `/blitz`.
* C-1 is untouched. Two lanes, two denominators, still nothing saying they are two.

## §7 Remaining problems by authority

**REPO-correctable**

* **B-1. A live game under the default reveal timing is a one-decision dead end.** Observed twice:
  a game started through `משחק חדש` with `אחרי כל החלטה` reaches its opening reveal and offers no
  continuation (`לבדוק אם זה חוזר` absent), the board refuses every move, and the only acts are the
  bank route and the record. Mechanism, from source after the observation: `runReveal` is handed
  `positionPly = currentPly`, and `newGame` sets `currentPly = -1`, so `revealAt.ply` is `-1` at the
  opening decision. `continuationAfter` takes `-1` as its "no reveal is open" sentinel and returns
  `null`, so `canContinue` is false and `RevealNextPosition` takes the slot the continuation would
  have had. One value carries two meanings and the real one loses. **Consequence:** the only
  purpose a default live game can produce is `first`, which discovery refuses, so the decision
  lane's counter cannot leave 0 by the default route. This is the smallest defect that blocks a
  whole lane, and it is the one repaired in the commit that carries this file.
* **B-2. C-1, the two undistinguished denominators.** REPO-correctable in principle. Not repaired
  here: the cheap fix is a sentence, the honest fix is a decision about which lane the product
  leads with, and that is B-3's owner.

**OWNER decision.** Both were subsequently decided, in
`docs/decisions/D26-primary-evidence-path.md`.

* **B-3. Which lane is the product.** Blitz is the only lane a cold user can complete end to end
  today, and it is the record page's own primary action; the decision lane is the one the reveal,
  the policy and the floor are written for. Both ship.
  **Decided:** `decisions` is the long-term user-facing denominator and a blitz game is a context
  in which decisions occur. The consolidation is deliberately deferred until after the FIELD run,
  so `C-1` is observed rather than repaired first.
* **B-4. `EXPERIMENTAL_LEARNING_ENABLED`.** Six of the seventeen states are unreachable because
  this flag is off, which `docs/decisions/D25-evidence-architecture.md` decided on the evidence
  available. It means the product ships an evidence loop with no learning object at the end of it.
  **Decided:** it stays off for the FIELD run.

**RESEARCH** — none open that a repository run could close. The Calibration Loop result on the
orchestration surface stands.

**ENVIRONMENT**

* **B-5. A cold participant could not open the frozen build. RESOLVED by the merge.** Found while preparing the FIELD
  package, by fetching the URL rather than by assuming it worked. The PR #105 preview answers a
  signed-out visitor with `302` to `vercel.com/sso-api`; the open production URL serves `main`,
  bundle `index-D4R4s45s.js`, which is not the stimulus. The project has SSO protection on
  `all_except_custom_domains` and no custom domain. PR #105 merged on 2026-09-12 at 19:53Z and
  `https://lichessapp.vercel.app/` now serves the frozen bundle: verified signed-out at `200`
  loading `assets/index-D_Il6CdA.js`, `gitSha: b2d8865`, `target: production`. The interim repair
  was a protection-bypass share link for the one preview deployment, and it is kept in
  `research/player-path/field/README.md` alongside the rule that produced it: check the URL from a
  signed-out browser, never from the moderator's own.
* The `503` on `/api` is not a blocker: it is the deployment the front door describes.

**FIELD** — everything else, and it is the larger half: whether a cold player understands the value
contract, whether `עוד 30 משחקים` reads as a promise or a wall, whether the negative states land as
answers or as failures, and whether anyone continues without being asked to. That is
`FIELD_RUN_CURRENT.md`.
