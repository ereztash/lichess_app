/**
 * What the front door says when a sign-in did not complete.
 *
 * The OAuth callback used to leave the visitor on `/api/oauth/callback?code=…` reading English JSON,
 * with no control on the page. It now sends them here with a reason, and this renders that reason
 * as a sentence that names whose problem it is -- the deployment's, the portal's, or nobody's (an
 * attempt that expired) -- and what to do.
 *
 * THE REASON IS MATCHED, NEVER ECHOED. The query string is the one input on this route an outside
 * party controls, so an unknown reason gets the generic sentence and nothing of itself on screen.
 */
import type { AuthFailureReason } from "../../../server/_core/oauth";

const SENTENCE: Record<AuthFailureReason, string> = {
  "oauth-malformed":
    "ההתחברות לא הושלמה: הפורטל חזר בלי הפרטים שהיה אמור להחזיר. אפשר לנסות שוב. ההחלטות שנרשמו בדפדפן הזה לא נגעו.",
  "oauth-state-rejected":
    "ההתחברות לא הושלמה: הניסיון פג תוקף (יש לו עשר דקות) או שהגיע ממקום אחר. אפשר להתחיל התחברות מחדש.",
  "oauth-not-configured":
    "ההתחברות לא זמינה בפריסה הזו: חסרה הגדרה בצד השרת. זה לא משהו שאתם יכולים לתקן. הרשומה ממשיכה לעבוד בדפדפן.",
  "oauth-portal-unreachable":
    "ההתחברות לא הושלמה: שרת ההתחברות לא ענה או סירב. אפשר לנסות שוב בעוד רגע. ההחלטות שנרשמו בדפדפן הזה לא נגעו.",
  "oauth-no-openid":
    "ההתחברות לא הושלמה: שרת ההתחברות לא החזיר זהות. זו תקלה בצד השרת, לא משהו שעשיתם.",
};

const GENERIC = "ההתחברות לא הושלמה. אפשר לנסות שוב. ההחלטות שנרשמו בדפדפן הזה לא נגעו.";

export function authFailureSentence(search: string): string | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  if (params.get("auth") !== "failed") return null;
  const reason = params.get("reason") ?? "";
  return reason in SENTENCE ? SENTENCE[reason as AuthFailureReason] : GENERIC;
}

export function AuthFailureNotice({ search }: { search: string }) {
  const sentence = authFailureSentence(search);
  if (!sentence) return null;
  return (
    <p className="record-mode auth-failure" role="alert">
      {sentence}
    </p>
  );
}
