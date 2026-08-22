/**
 * The page a typo lands on.
 *
 * `vercel.json` rewrites every unmatched path to index.html, so this is reachable from any URL a
 * visitor mistypes -- and it shipped in English on a light slate gradient, inside an app that is
 * Hebrew, RTL, and themed. It was the one screen in the build that did not look like the build.
 *
 * Every colour here comes from the token set the rest of the app uses, so it follows the theme
 * instead of pinning one palette. `tests/client/not-found.test.tsx` asserts that: a literal hex,
 * a Tailwind palette class or a bare colour name in this file fails the suite.
 */
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <main className="not-found" dir="rtl">
      <div className="not-found-card">
        <AlertCircle className="not-found-mark" size={44} aria-hidden="true" />
        <p className="not-found-code" dir="ltr">
          404
        </p>
        <h1>הדף הזה לא קיים</h1>
        <p className="not-found-body">
          הכתובת שהגעתם אליה לא מוכרת לאפליקציה. שום דבר לא נשבר, ושום החלטה שרשמתם לא אבדה.
        </p>
        <button type="button" className="not-found-home" onClick={() => setLocation("/")}>
          <Home size={16} aria-hidden="true" />
          חזרה ללוח
        </button>
      </div>
    </main>
  );
}
