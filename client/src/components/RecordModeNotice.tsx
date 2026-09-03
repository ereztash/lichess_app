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
  /*
   * "הרשומה" AND NOT "המידע", and the difference is now load-bearing. The record -- decisions, reads,
   * confidences, positions -- never leaves. What does leave, on a failure only, is the NAME of the
   * failure: a code from a closed list, the screen it happened on, the build. Saying "nothing leaves"
   * while that is sent would be the product's central honesty claim made false by its own error
   * reporting, so the sentence says exactly what stays and what goes.
   */
  "signed-out":
    "ההחלטות נשמרות בדפדפן הזה בלבד — לא נדרשת התחברות, והרשומה לא עוזבת את המחשב שלכם. אם משהו נכשל, נשלח לשרת רק שם התקלה, בלי תוכן.",
  unknown: "בודקים אם בשרת יש מאגר החלטות זמין. עד שתתקבל תשובה ההחלטות נשמרות בדפדפן הזה.",
  "no-database":
    "אתם מחוברים, אבל בשרת אין מאגר החלטות מוגדר (DATABASE_URL). הרשומה נשמרת בדפדפן הזה במקום — הלולאה עובדת, אבל היא לא תעבור בין מכשירים.",
  "not-this-account": `הרשומה שבשרת שייכת לחשבון שהגדיר את הפריסה, ואתם מחוברים בחשבון אחר — השרת סירב, ולא בגלל תקלה. ${SHARED_BROWSER} הלולאה עובדת, אבל היא לא תעבור בין מכשירים.`,
  "no-owner-configured": `בפריסה הזו לא הוגדר OWNER_OPEN_ID, ולכן אף חשבון לא יכול להגיע לרשומה שבשרת — זו הגדרה חסרה בשרת, לא הרשאה חסרה שלכם. ${SHARED_BROWSER}`,
  unreachable:
    "לא הצלחנו להגיע לשרת, והוא לא אמר למה. ההחלטות נשמרות בדפדפן הזה בינתיים; לא ידוע אם קיימת שם רשומה אחרת.",
  /*
   * NOT A FAILURE, AND IT STILL HAS TO BE SAID.
   *
   * The server is answering again. What this names is that the decisions from this session went
   * into the browser -- under the sentence above, which promised exactly that -- so the record
   * stays here rather than pointing back at the server and leaving them unreadable. Moving
   * silently is what this notice exists to prevent, and it would have taken its own explanation
   * away with it: the component returns null on `usable`.
   */
  "kept-local":
    "השרת חזר לענות, אבל ההחלטות שרשמתם בביקור הזה נשמרו בדפדפן הזה — ולכן הרשומה נשארת כאן לעת עתה. " +
    "הן לא אבדו והן לא בשרת; רשומת השרת היא רשומה אחרת. אין כאן מיזוג אוטומטי בין השתיים.",
  /*
   * Deliberately does NOT say the decisions are being kept here. They are not: the record stays
   * pointed at the server. Saying otherwise would be the reassurance that makes a split record
   * invisible, which is the whole reason this state exists instead of a silent fallback.
   */
  "server-lost":
    "הרשומה שלכם נמצאת בשרת, והשרת הפסיק לענות. לא עברנו לרשומה בדפדפן — היא רשומה אחרת, וההחלטות שכבר רשמתם אינן בה. נסו שוב בעוד רגע; עד אז אי אפשר לרשום החלטה חדשה.",
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
  /*
   * Nothing to explain: the record is where a signed-in person would expect it.
   *
   * `server-lost` is the exception that is NOT local -- the record stays on the server on purpose
   * -- and it still has to be said, or it becomes the one failure the player is told nothing
   * about while every panel shows an error and the reason sits nowhere.
   */
  if (serverStatus === "usable") return null;
  if (!local && serverStatus !== "server-lost") return null;
  const sessionOnly = durability === "session-only";
  return (
    <p className={`record-mode ${sessionOnly ? "session-only" : ""}`}>
      {sessionOnly ? SESSION_ONLY : REASON[serverStatus]}
    </p>
  );
}
