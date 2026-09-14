# BENCHMARK_PREREGISTRATION_V1

**Status:** DESIGN FROZEN — DO NOT COLLECT DATA  
**Product freeze:** `main@a8e7e69d541c80a7bea9d9fc047745e3e3c1a089` (2026-09-14)  
**Decision:** האם Decision Lab מייצר מספיק incremental decision-learning value ביחס לחלופה הטובה ביותר כדי להצדיק את החיכוך הנוסף שהוא דורש?

## 1. מה באמת נבדק

היחידה אינה "מי אפליקציית השחמט הטובה ביותר". ההשוואה היא בין שני workflows לאחר משחק:

- **DL:** המוצר הקפוא כפי שהוא: commitment לפני feedback כאשר המסלול מאפשר זאת, reveal, review, כלל/השערה, drill/transfer ו-record.
- **BAA — Best Available Alternative:** workflow קבוע עם תוכניות מלאות: Chess.com Game Review/Retry/Insights או Aimchess Premium personalized report/training. הבחירה בין השתיים נעשית בפיילוט qualification על מדגם נפרד ואינה משתנה לאחר פתיחת המדגם המאשר.

Chessable, ChessTempo, DecodeChess, Dr. Wolf ו-Lichess נשארים במטריצת היכולות ובבדיקות Job-specific. הם אינם זרוע מאשרת אלא אם qualification מראה שהם ממלאים את כל contract ה-BAA טוב יותר. מאמן אנושי הוא ceiling comparator במחקר עתידי, לא comparator מוצרי ב-v1.

## 2. ארבע שכבות שאסור לערבב

| שכבה | שאלה | ראיה | אינה מוכיחה |
|---|---|---|---|
| Product performance | האם המשתמש מצליח להשלים את המסלול? | זמן, שגיאות, השלמה, נטישה | למידה |
| Epistemic performance | האם התוצר נכון, תחום וניתן להעברה? | מבחן מושהה, rubric עיוור, calibration | רצון בשוק |
| Behavioral market evidence | האם חוזרים/בוחרים מרצון? | שימוש חופשי לאחר הניסוי | נכונות לשלם |
| Commercial evidence | האם משלמים במחיר אמיתי? | עסקה אמיתית נפרדת | יעילות לימודית |

אין composite score ואין weighting. כל שכבה מדווחת בנפרד.

## 3. אוכלוסייה

- בני 18+; Lichess או Chess.com blitz/rapid rating בין 1200–1800.
- לפחות 80 משחקים מדורגים ב-90 הימים האחרונים ולפחות 3 משחקים בשבוע בארבעת השבועות האחרונים.
- עברית שפת אם; אנגלית ברמה עצמית 4/5 ומעלה, משום שממשקי המתחרים אינם שווי-שפה.
- ללא שימוש קודם ב-Decision Lab.
- ניסיון קודם ב-BAA נמדד לפני randomization ומשמש stratification; אינו עילת exclusion.
- exclusion מראש: מאמן שחמט מקצועי, title רשמי, חשבון שאינו ניתן לאימות, או כשל בהסכמה מדעת.

## 4. מבנה המחקר המינימלי

### Stage Q — Comparator qualification (נפרד; n=18)

Aimchess Premium מול Chess.com Diamond, 9 משתתפים לכל workflow. מטרתו לבחור BAA, לא לאמוד יתרון מול DL. אותו corpus, אותו time budget ואותו delayed test. נבחרת החלופה עם delayed acceptable-move gain הגבוה יותר; tie של פחות מ-5 נקודות אחוז מוכרע לטובת החלופה עם completion גבוה יותר, ואז זמן נמוך יותר. נתוני Q אינם נכנסים לניתוח המאשר.

### Stage P — Pilot apparatus (n=12)

6 לכל זרוע. בודק ביצועיות, difficulty, missingness, technical attribution ו-inter-rater reliability בלבד. אין effect claim ואין שינוי threshold לפי כיוון התוצאה.

### Stage C — Confirmatory (120 completers; 60/arm)

גיוס מתוכנן: 138, כדי לאפשר עד 13% attrition. randomization 1:1, חסום לפי rating (1200–1499/1500–1800), platform, prior BAA use ו-baseline score. ניתוח ITT.

הנחת התכנון: SD של 0.15 בשיעור ההצלחה למשתתף ו-MID של 0.08 נותנים effect standardized בקירוב 0.53; 60 completers/arm מיועדים לכ-80% power דו-צדדי ב-alpha .05. הפיילוט רשאי לעדכן **רק variance באופן blinded**, עד cap של 160 completers; אסור לעדכן MID.

## 5. רצף

1. Baseline: 12 עמדות unseen, ללא feedback.
2. Native use: 7 ימים, שלוש יחידות אימון של עד 25 דקות. שתי הזרועות מקבלות אותו time budget וגישה לתוכנית המלאה.
3. Immediate test: 12 עמדות מקבילות שלא נראו.
4. Delayed test אחרי 72±12 שעות: 24 עמדות unseen — 12 trigger ו-12 matched non-trigger.
5. Prospective play: עשרה משחקים מדורגים חדשים או 14 יום, המוקדם מביניהם.
6. Free-choice period לאחר סגירת endpoint: familiarization של 5 דקות לכל החלופה שלא נוסתה, ואז 7 ימים שבהם המשתתף רשאי לבחור. הבחירה אינה מזהמת את endpoint המאשר.
7. Commercial follow-up נפרד בלבד; אינו חלק מ-v1 confirmatory.

## 6. Primary estimand

הבדל בין הזרועות בשינוי מ-baseline ל-delayed test ב-`acceptable_move_rate` על עמדות unseen, לפי ITT.

**MID:** 8 נקודות אחוז.  
**Primary model:** mixed-effects logistic regression: correctness ~ arm × time + baseline + rating stratum + platform + prior-use, עם random intercept למשתתף ול-item family.

## 7. Decision rule — ללא score

### Decision Lab win

כל התנאים:

1. `Δ delayed acceptable_move_rate` point estimate ≥ +8pp וה-95% CI lower bound > 0;
2. completion difference lower 95% CI > -10pp;
3. median extra active time ≤ 5 דקות ליחידת אימון **וגם** ratio ≤1.5, או שה-free-choice period מראה ≥60% בחירה ב-DL ו-95% CI lower bound >50%;
4. אין invalid-comparison gate.

### Competitor win

אחד מאלה:

- competitor superior by ≥8pp עם CI שאינו חוצה 0; או
- parity epistemic ובמקביל competitor מהיר בלפחות 5 דקות/יחידה ו-completion גבוה בלפחות 10pp; או
- DL technical/product failure rate גבוה ב-15pp ומעלה ללא יתרון epistemic.

### Parity

95% CI של ההבדל הראשי כולו בתוך [-5pp,+5pp], וללא הבדל מהותי בחיכוך (±5 דקות; ±10pp completion).

### Unresolved

CI חוצה גם אפס וגם אחד מספי ההכרעה; או DL טוב יותר אך חורג מ-friction gate וה-free-choice evidence אינו מכריע.

### Invalid comparison

הפרת freeze; item leakage; researcher-induced failure לא סימטרי; comparator plan/feature השתנה מהותית; פחות מ-80% מהמשתתפים קיבלו את exposure שנקבע מסיבה שאינה מוצרית; או reliability gate נכשל. כשל מוצר אמיתי אינו invalid — הוא product performance.

## 8. Claims תחרותיים בני-הפרכה

| Claim | Rival hypothesis | Test | Observable | Metric | Threshold | Stop |
|---|---|---|---|---|---|---|
| C1: המסלול משפר החלטה חדשה | שיפור הוא practice/engine feedback בלבד | DL vs BAA delayed unseen items | מהלך לפני feedback | acceptable_move_rate | +8pp, CI>0 | max N או superiority/futility rule |
| C2: התוצר מסביר מנגנון טוב יותר | הניסוח נשמע עמוק אך אינו מדויק | outputs מנורמלים לרובריקה עיוורת | diagnosis, boundary, overclaim | blind rubric | +0.4/8, Holm-adjusted CI>0 | max N |
| C3: transfer אינו שינון | ההצלחה היא זיכרון של FEN/קו | structurally matched unseen + surface-different items | accuracy by distance | generalization gradient | no collapse >10pp at far items vs BAA | max N |
| C4: הכלל אינו מייצר overgeneralization | המשתמש מפעיל כלל בכל מקום | matched non-trigger items | החלטות שנפגעו מהפעלת יתר | false-application rate | DL ≤ BAA+5pp | max N |
| C5: ידע משנה משחק עתידי | מבחן מעבדה אינו משנה play | 10 rated games/14d | recurrence at eligible opportunities | recurrence rate | ≥20% relative reduction, exploratory | quota/time |
| C6: הערך מצדיק friction | יותר טפסים מייצרים רק יותר נתונים | time/completion + free choice | שימוש ובחירה | active time, completion, choice | gates §7 | end free-choice |
| C7: personalization מוסיף ערך | generic rating-level advice מספיק | personal vs yoked generic sensitivity within arm | delayed outcome | interaction | ≥5pp; secondary | max N |

C5–C7 אינם רשאים להפוך תוצאה של C1. C7 הוא sensitivity test ורק אם המוצר מסוגל לספק את שתי הגרסאות ללא שינוי קוד.

## 9. Freeze

לפני data collection נשמרים: commit hash; גרסאות/תוכניות המתחרים; screenshots; item-bank hash; scripts; randomization seed; rubric; analysis code; exclusion rules. שינוי כלשהו יוצר V2 או amendment מתוארך לפני unblinding.
