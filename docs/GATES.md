# Repository gates

This is the canonical human-readable catalog of the gates declared by [`scripts/run_gates.ts`](../scripts/run_gates.ts).

The README is the repository's orientation layer; this document owns the detailed gate inventory. The test [`tests/docs/the-table-that-fell-behind.test.ts`](../tests/docs/the-table-that-fell-behind.test.ts) holds this table against the runner in both directions so a documented gate cannot silently disappear and a running gate cannot go undocumented.

שלושים ושישה שערים, כל אחד נשלח עם בקרה חיובית שחייבת להיות מודגמת **אדומה**. שער שמעולם לא נכשל לא הוכח כשער.

```bash
npm run gates            # must be green on the real repository
npm run gates:controls   # must go red on deliberately broken fixtures
```

| Gate | Rule | Deliberate positive control |
| --- | --- | --- |
| GATE-ISO | 3.1 | אירוע API שהאטום `unknown` הושמט ממנו |
| GATE-NO-FAKE | R2 | הערכת הפתיחה המומצאת `+0.42 @ depth 14`, מוחזרת |
| GATE-DENOM | R1 | `rate(1,1)` שמוצג כ-"100%" חשוף |
| GATE-STALE | 4.3 | לוגיקת ההחלפה שנשלחה, שפתרה בקשה עם מהלך מחיפוש נטוש |
| GATE-MEASURE | R1 | הפיצול כפי שנשלח: זמן חשיבה חסר שנקרא כאפס |
| GATE-GRADE | 3.3 | טענה שמוצגת בלי הדירוג שלה או בלי ה-n שלה |
| GATE-PREREG | R5 | מפעיל דריל בלי בדיקת רישום מוקדם |
| GATE-EXTERNAL | R4 | מסלול קידום מתירני שמאפשר לראיה חיצונית להעלות דירוג |
| GATE-COMMIT | R3 | מטען חשיפה שהוגש לפני שההחלטה נרשמה |
| GATE-SHUFFLE | 6 | ספי הגלאי מהטיוטה הראשונה, שמצאו מבנה ברעש טהור |
| GATE-SHUFFLE-REAL | 6 | אותם ספים, על רשומות בצורה שיש לרשומה אמיתית |
| GATE-WORST-BUCKET | 6 | הבר של שגיאת תקן אחת, שמוצא חולשה בתוצאה מעורבבת |
| GATE-REACHABILITY | 4.6 | דלת כניסה שמייצרת החלטה בלי ביטחון, ולכן בלי מדידה |
| GATE-KEYBOARD | 4.7 | הלוח כפי שנשלח: `role="grid"` בלי מטפל מקשים, ומודאל בלי מלכודת פוקוס |
| GATE-NOTICE | L1 | גופן שנמסר בבנייה בלי שאיש כתב עליו הודעת רישוי |
| GATE-DECISION-FOCUS | LAW 1 | מסך שמראה לשחקן קריאה מהרשומה בזמן שהוא מוסר את ההחלטה |
| GATE-QUIET-WINDOW-LINEAGE | LAW 12 | מסך שמכריע את הזרוע פעם שנייה מתוך דגל הבנייה, ושורה שמצהירה על זרוע שאיש לא צפה בה |
| GATE-ONE-BOARD-ONE-STORY | LAW 11 | שני לוחות במסך אחד, כלומר שתי תשובות לשאלה איפה אני |
| GATE-BOARD-AUTHORITY | LAW 3 | לוח שמקבל מחווה באותו אופן בכל מצב, גם אחרי שההחלטה נרשמה |
| GATE-CONTINUATION-IS-A-MOVE | O-2 | אירוע ההמשכיות של הניסוי נכתב ביותר ממקום אחד, או מסעיף שנקבע קבוע, או בלי להתייעץ עם ההגדרה |
| GATE-REUSE-CONFIG | LAW 8 | מסך שמתחיל משחק בלי לקרוא את התשובה שהשחקן כבר נתן |
| GATE-PENDING-WORK-LIVENESS | LAW 4 | ניתוח שמסך יכול לבטל ביציאה, ושורש שלא יסיים אותו לעולם |
| GATE-NEXT-ACTION-RESOLVES-BLOCKER | LAW 3 | חסם שנענה בפעולה שמגדילה בדיוק את מה שחוסם |
| GATE-ONE-PRIMARY-ACTION | LAW 2 | דלת כניסה שמציעה שני מוצרים במשקל אחד |
| GATE-NO-DUPLICATE-ACTION | LAW 2 | חשיפה שמציעה את אותה פעולה פעמיים |
| GATE-TOOLBOX-OUTSIDE-FOCUS | LAW 2 | ארגז הכלים נטען לכל נכנס ונפתח בלי שאיש לחץ עליו |
| GATE-ENGINE-FAILURE-DISTINCT | R-09 | המסך שנשלח: משפט אחד לשישה גורמים שאין להם תיקון משותף |
| GATE-TWO-HANDS | R3 | פקד שנצבע בצבע של המנוע, והאובייקט הגדול ביותר של המנוע שנצבע בדיו של הדף |
| GATE-CLAIM-ANCHOR | L2 | שורת P0 שההוכחה שלה היא פונקציה טהורה, ורמת בדיקה שנטענת בלי נימוק |
| GATE-SAID-ONCE | LAW 2 | שתי רשימות שכל שורה בהן אומרת בדיוק את אותו משפט — מעל התקרה, ולא מתחתיה |
| GATE-REGISTER-RECONCILED | R-01 | ארבעת הרגיסטרים כפי שהם באמת נסחפו: שער שנטען ולא רץ, ציטוט לקובץ שאינו בעץ, מילת מצב שהומצאה, תקרה שלא ירדה, וטריגר שכבר התקיים ומתויק כאילו לא |
| GATE-RESEARCH-RECONCILED | R-01 | קורפוס המחקר כפי שהוא באמת נסחף: רשומת הקפאה שמצביעה על גיבוב שהמסמך כבר אינו נושא, פלט מחושב שחולק על המחולל שלידו, החלפה שאינה מצביעה על יורש, וטענת גיבוב שאיש לא סיווג |
| GATE-AUTHORITY-RESOLVED | R-01 | מפת הסמכות כפי שהיא נרקבת: תשובה שנמחקה, מתחרה שאיבד את הסימון שתחם אותו, ופער יכולת שנסגר בשקט בזמן שהרישום עדיין אומר שהוא פתוח |
| GATE-FALSIFICATION-INVENTORY | R-01 | מלאי הבדיקות החוסמות מול העבודה שמריצה אותן: שלב חוסם שאיש לא סיווג, ומנגנון הפרכה ששמו נכתב ואינו קיים |
| GATE-CUE-PLAYER-OBSERVABLE | R-01 | טריגר במרשם מחלקות-הכללים שמחשב ממשהו שאינו הלוח: רמז שהשחקן אינו יכול להעריך בעצמו אינו רמז |
| GATE-ROLLBACK-EVIDENCE | R-01 | שרשרת הראיות של החזרה לאחור: ה-workflow מקבל SHA, החבילה נקשרת אליו, הקשירה מודגמת נכשלת, והבנייה מתקינה את קובץ הנעילה בדיוק |

The IDs are the synchronized contract. The prose explains why each gate exists but is not treated as an executable definition; the runner remains the authority for what actually runs.