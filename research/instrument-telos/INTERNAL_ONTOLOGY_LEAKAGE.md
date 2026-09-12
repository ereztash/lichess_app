# Internal ontology leakage

Scientific separation is not in question. The question is whether a separation that must exist
**internally** must also become **user work**.

| Internal distinction | Where it reaches the player | What user decision it changes | Classification |
|---|---|---|---|
| `decisions` vs `blitzGames` as two populations | two denominators on one record page: `0 מתוך 60 החלטות שהחיפוש הזה סופר` and `עוד 30 משחקים לפחות יאפשרו בדיקה ראשונה` | **none.** Both are answered by the same act, playing chess in the product. No screen asks the player to choose a lane | `MUST_EXIST_BUT_NEED_NOT_BE_VISIBLE` |
| `purpose` refusals: `first`, `import`, `anchor`, `drill`, `transfer` inadmissible to discovery | `החלטה אחת שלך נרשמה ונקראת בחלק אחר של ההיסטוריה` | **none**, and the sentence is careful: it says where a decision is read, not that it was wasted | `USER_RELEVANT_ONLY_AT_RESULT` |
| Scored vs recorded, that is, `ASK_RATE` | `1 החלטות מדודות · חסרות עוד 59`, with a separate sentence saying the question is sampled | **yes, and this is the one that should.** It governs how much play the next reading costs, and the player cannot compute it | `MUST_BE_VISIBLE`, and it is visible only as a qualitative "sometimes" |
| `MIN_BUCKET_N` on both sides of a split | `צריך 30 החלטות מדודות בתוך הסוג ו-30 מחוצה לו — 60 בסך הכול` | none directly, but it explains the floor | `USER_RELEVANT_ONLY_AT_RESULT`, and it is stated well |
| Probe arms, probed vs not-probed | never named | none | `INTERNAL_ONLY`, correctly |
| Six detector buckets | `מה עדיין לא ברור` lists which splits cannot yet be read | none; it is a status list | `USER_RELEVANT_ONLY_AT_RESULT` |
| Quiet-window exposure stamp | never rendered, flag off | none | `INTERNAL_ONLY` |
| Engine identity and depth | `עומק 14 בלבד: הפרשים מתחת ל-0.30 רגלים לא אומרים כאן כלום` | **yes.** It tells the player when a difference is not a difference | `MUST_BE_VISIBLE`, and it is |
| Hypothesis vs finding | `ואפילו אז זו תהיה השערה, לא ממצא` | yes, it sets expectation for the payoff | `MUST_BE_VISIBLE`, and it is |

## The finding

**One distinction leaks and costs cognition without changing any decision: the two denominators.**
A player reading the record page meets two numbers, in two units, with two floors, and no statement
that they are two populations. Neither number tells them to do anything different, because the same
act feeds both.

**One distinction that should be visible is under-specified: the conversion rate.** `ASK_RATE` is
the only internal constant that genuinely governs a user decision, how much chess the next reading
costs, and it is the one expressed qualitatively.

That pairing is the shape of the leakage: the distinctions the player does not need are shown as
numbers, and the one they do need is shown as an adverb.

## What must not be simplified away

The population separation itself. `shared/evidence-policy.ts` refuses a drill's output from
discovery so that an attempt to fix a weakness cannot manufacture the next one, and refuses
retrospective imports because nothing can show they were not interventions. Removing that would
remove the reason the product's claims are worth anything. The classification above says the
separation must exist; it does not say the player must carry it.
