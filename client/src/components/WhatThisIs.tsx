/**
 * HELP (Nielsen heuristic 10), and the reason it is the last thing this product got.
 *
 * There was none. A new player met a board, a form demanding a "read" they had not been asked for
 * before, and a rail saying "another 60 revealed decisions" -- with no sentence anywhere saying
 * what the thing measures or why it refuses to speak. The one place "calibration gap" is defined
 * is `RecordDashboard`, a panel reached only after there is a record to look at, which is weeks in.
 * The explanation arrived after the thing it explains.
 *
 * WHAT THIS IS ALLOWED TO BE. Reachable at any time from the header, closable, and identical every
 * time it opens. Not a tour, not a dismissable coach-mark, not a checklist that congratulates
 * anyone for reading it. Section 4.5's rule about states applies to help as well: a screen that
 * changes what it says depending on how far along you are is a screen that is managing you.
 *
 * WHAT IT MUST NOT DO. It must not promise improvement, name a rating, or claim the product knows
 * anything about the reader -- it has measured nothing about them at the moment they open it. The
 * last section is the one that matters most and is the one a help screen normally omits: what this
 * will never tell you. A product that lists its own limits before it has any findings is making a
 * commitment it can be held to later.
 */
import { X } from "lucide-react";
import { MIN_BUCKET_N, PREREGISTERED_THRESHOLDS } from "@shared/detector";

export function WhatThisIs({ onClose }: { onClose: () => void }) {
  return (
    <section className="what-this-is" aria-label="מה זה המקום הזה">
      <header className="what-heading">
        <h3>מה נמדד כאן</h3>
        <button type="button" onClick={onClose} aria-label="סגור">
          <X size={16} />
        </button>
      </header>

      <p>
        זה לא מאמן שחמט ולא מנתח משחקים. הוא מודד דבר אחד: <strong>הפער בין כמה שהיית בטוח לבין
        מה שקרה בפועל</strong> — האם ידעת מתי אתה כנראה טועה, והאם היית בטוח גם בהחלטות
        שהתפרקו.
      </p>

      <h4>למה המנוע שותק עד שאתה מחליט</h4>
      <p>
        אם המנוע מדבר ראשון, אין מה למדוד — הביטחון שלך כבר מושפע ממה שראית. לכן הסדר הפוך מכל כלי
        אחר: קודם אתה בוחר מהלך, מסמן מה אתה קורא בעמדה ומה אתה לא מצליח להעריך, ואומר כמה אתה בטוח.
        רק אז המנוע עונה. זה לא סגנון — בלי זה אין מדידה.
      </p>

      <h4>למה זה לוקח זמן</h4>
      <p>
        דפוס אחד דורש {MIN_BUCKET_N * 2} החלטות מדודות, ואם ייבאת משחקים ונמצא בהם סוג אחד שנבדל
        מהשאר — {PREREGISTERED_THRESHOLDS.minBucketN * 2}. הסף הזה קיים כדי שלא נדווח על רעש: בבדיקה
        עם תוויות מעורבבות, ספים נמוכים יותר ייצרו "דפוסים" ברוב הריצות. עד שהסף נחצה המסך יגיד שאין
        מה לומר, ויגיד למה. <strong>שתיקה עם סיבה היא תשובה, לא מסך ריק.</strong>
      </p>

      <h4>מה נשאר אצלך</h4>
      <p>
        בלי התחברות, ההחלטות נשמרות בדפדפן הזה בלבד והרשומה לא עוזבת את המחשב. המנוע רץ מקומית. אם
        הדפדפן חוסם אחסון קבוע, המסך יאמר את זה — ולא יעמיד פנים שנשמר. הדבר היחיד שנשלח לשרת בלי
        שביקשתם הוא שם של תקלה, כשיש אחת: קוד מרשימה סגורה, בלי מהלך, בלי עמדה ובלי מילה שכתבתם.
        שם המשתמש שאתם מקלידים בייבוא נשלח למקור שבחרתם, Lichess או Chess.com, כי משם מגיעים המשחקים.
        מה נשמר, איפה, ואיך מוחקים או מורידים — <code>docs/RETENTION.md</code>, ובמגירת הבדיקה העצמית.
      </p>

      <h4>מה זה לעולם לא יגיד לך</h4>
      {/*
        * The constraints of the product, published to the person they protect. Each line is a
        * refusal that is enforced somewhere in the code, not a promise of restraint.
        */}
      <ul className="what-never">
        <li>לא ייתן ציון, דירוג, רצף ימים או תג הישג.</li>
        <li>לא ימליץ מה ללמוד — הוא מודד, לא מאמן.</li>
        <li>לא יגיד עליך יותר ממה שמדד, וכל מספר כאן נושא את מקורו ואת ה-n שלו.</li>
        <li>לא ידרג את עצמו כמצליח.</li>
      </ul>

      <h4>מה שעדיין לא נבדק</h4>
      {/*
        * The honest half. Every number this product shows was measured against synthetic records
        * and a stub engine; nobody has completed the loop. Saying so here costs nothing and makes
        * the rest of the page believable.
        */}
      <p className="what-unverified">
        אף שחקן עדיין לא השלים לולאה מלאה בכלי הזה. הספים נבדקו מול רשומות מלאכותיות, לא מול רשומה
        אמיתית. שיעור הדיוק על משחקים מיובאים סופר גם מהלכי ספר ולקיחות-חזרה, ולכן הוא מנופח — זה
        פגם ידוע במספר שמופיע על המסך, לא פיצ׳ר חסר.
      </p>
    </section>
  );
}
