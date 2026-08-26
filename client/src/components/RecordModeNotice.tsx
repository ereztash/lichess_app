/**
 * Why the record is in this browser, said in the words of the cause that put it there.
 *
 * This is one paragraph on the board screen, and it is the only place the product explains where
 * a person's decisions are being kept. It used to have two sentences for six situations, so four
 * of them were described by a sentence about something else -- most damagingly, a visitor who had
 * been REFUSED by the owner gate was told the server had no database.
 *
 * THE ORDER IS NOT COSMETIC. `session-only` comes first for every cause, because it is the only
 * state in which the record is about to be LOST. Whose record it is matters less than whether it
 * will exist after a refresh.
 */
import type { RecordDurability } from "@/lib/local-record-store";
import type { RecordServerStatus } from "@/lib/record-api";

/**
 * A browser record is per-browser. Anyone else on this machine opens the same one.
 *
 * Said only where the alternative was a record scoped to an account, because there it is a
 * correction: the person had reason to expect their own, and got something else.
 *
 * WHY THIS IS A SENTENCE AND NOT A FIX. Keying the local store by account would look like the
 * fix and would not be one -- localStorage is readable by anything running on this origin no
 * matter what the key says, so a per-account key buys a claim of separation the storage cannot
 * back. Saying what the store is beats implying what it is not.
 */
const SHARED_BROWSER = "הרשומה נשמרת בדפדפן הזה, והיא של הדפדפן — לא של החשבון שלכם.";

const REASON: Record<Exclude<RecordServerStatus, "usable">, string> = {
  "signed-out": "ההחלטות נשמרות בדפדפן הזה בלבד — לא נדרשת התחברות, והמידע לא עוזב את המחשב שלך.",
  unknown: "בודקים אם בשרת יש מאגר החלטות זמין. עד שתתקבל תשובה ההחלטות נשמרות בדפדפן הזה.",
  "no-database":
    "אתם מחוברים, אבל בשרת אין מאגר החלטות מוגדר (DATABASE_URL). הרשומה נשמרת בדפדפן הזה במקום — הלולאה עובדת, אבל היא לא תעבור בין מכשירים.",
  "not-this-account": `הרשומה שבשרת שייכת לחשבון שהגדיר את הפריסה, ואתם מחוברים בחשבון אחר — השרת סירב, ולא בגלל תקלה. ${SHARED_BROWSER} הלולאה עובדת, אבל היא לא תעבור בין מכשירים.`,
  "no-owner-configured": `בפריסה הזו לא הוגדר OWNER_OPEN_ID, ולכן אף חשבון לא יכול להגיע לרשומה שבשרת — זו הגדרה חסרה בשרת, לא הרשאה חסרה שלכם. ${SHARED_BROWSER}`,
  unreachable:
    "לא הצלחנו להגיע לשרת, והוא לא אמר למה. ההחלטות נשמרות בדפדפן הזה בינתיים; לא ידוע אם קיימת שם רשומה אחרת.",
};

const SESSION_ONLY =
  "הדפדפן חוסם אחסון קבוע (חלון פרטי, חסימת נתוני אתר, תוסף פרטיות או מכסה מלאה). הלולאה עובדת וההחלטות נרשמות — אבל לכרטיסייה הזו בלבד: סגירה או רענון ימחקו אותן.";

export function RecordModeNotice({
  local,
  durability,
  serverStatus,
}: {
  local: boolean;
  durability: RecordDurability;
  serverStatus: RecordServerStatus;
}) {
  // Nothing to explain: the record is where a signed-in person would expect it.
  if (!local || serverStatus === "usable") return null;
  const sessionOnly = durability === "session-only";
  return (
    <p className={`record-mode ${sessionOnly ? "session-only" : ""}`}>
      {sessionOnly ? SESSION_ONLY : REASON[serverStatus]}
    </p>
  );
}
