# EXPERT_BLIND_RUBRIC

## Blinding

Outputs עוברים הסרת מותג, timestamp, UI labels וסגנון קבוע: move, reason, proposed rule/advice, boundary. אסור לשנות תוכן. Raters אינם רואים arm, participant, rating change, time או engine score.

שני raters עצמאיים לכל output; שלישי מכריע disagreement של 2+ נקודות.

## Rubric (0–8; לא outcome ראשי ולא composite מוצרי)

| ממד | 0 | 1 | 2 |
|---|---|---|---|
| Diagnostic accuracy | סיבה שגויה/לא רלוונטית | חלקית | מזהה את הגורם המכריע |
| Causal adequacy | תיאור התוצאה בלבד | קשר סביר אך חסר | מסביר כיצד ההחלטה יצרה/מנעה תוצאה |
| Boundary condition | כלל מוחלט/ללא גבול | גבול עמום | trigger וגם exception ניתנים לזיהוי |
| Actionability | לא משנה החלטה | הנחיה כללית | פעולה ספציפית שניתנת להפעלה |

**Overclaim flag (0/1):** output טוען לשיפור, אישיות, סיבתיות או generality מעבר לראיה. מדווח בנפרד ואינו מחוסר מ-8.

## Reliability gate

ב-pilot: weighted kappa/ICC לכל ממד ו-Krippendorff alpha כולל.

- alpha ≥0.80: pass.
- 0.67–0.79: clarification + retraining על examples שלא במדגם; re-pilot once.
- <0.67: rubric invalid; אין data collection confirmatory.

אסור לשנות rubric לאחר arm unblinding. אם reliability נכשל במדגם המאשר, expert outcomes מסומנים unresolved; outcome האובייקטיבי נשאר תקף.
