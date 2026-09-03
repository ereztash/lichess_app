/**
 * The last screen before nothing.
 *
 * It shipped in English with the raw stack trace as the second element on the page, above the
 * only control. The trace is genuinely useful -- it is the one artefact that makes a bug report
 * actionable -- so it stays. It just stops being the first thing a visitor reads: it is behind a
 * closed `<details>`, and the copy above it says what happened in the app's own language.
 *
 * Colours come from the token set, like everywhere else, so this follows the theme.
 */
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";
import { isChunkLoadError } from "@/lib/lazy-chunk";
import { reportFailure } from "@/lib/error-sink";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /*
   * The one place a render crash is known, so the one place it is counted. The code says which
   * of the two sentences below the player got; the stack stays on this screen and goes nowhere.
   */
  componentDidCatch(error: Error): void {
    reportFailure(isChunkLoadError(error) ? "stale-build-stuck" : "render-crash", "app");
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const stack = this.state.error?.stack;
    /*
     * TWO DIFFERENT THINGS REACH THIS SCREEN, AND THEY DESERVE DIFFERENT SENTENCES.
     *
     * A missing chunk is not a fault in the build: it is a build that was REPLACED while this tab
     * was open, so the file this screen wanted no longer exists under that name. `lazyChunk`
     * reloads once by itself and this branch is what is left when even that did not help --
     * usually a deploy still in flight. Telling that player "משהו נשבר" is a false statement about
     * the app AND it hides the one thing that actually fixes it, which is loading it again.
     *
     * Everything else is a real fault, and keeps the sentence it had.
     */
    const staleBuild = isChunkLoadError(this.state.error);
    return (
      <main className="boundary" dir="rtl">
        <div className="boundary-card">
          <AlertTriangle size={44} aria-hidden="true" />
          <h1>{staleBuild ? "האפליקציה התעדכנה בזמן שהייתם כאן" : "משהו נשבר במסך הזה"}</h1>
          <p className="boundary-body">
            {staleBuild
              ? "יצאה גרסה חדשה בזמן שהעמוד הזה היה פתוח, וחלק מהקבצים שהוא ביקש כבר לא קיימים בשם הזה. טעינה מחדש פותרת את זה. החלטות שכבר נרשמו נשמרו — הרשומה נכתבת בכל החלטה, לא בסוף המשחק."
              : "זו תקלה באפליקציה ולא במשהו שעשיתם. החלטות שכבר נרשמו נשמרו — הרשומה נכתבת בכל החלטה, לא בסוף המשחק."}
          </p>
          <button
            type="button"
            className="boundary-reload"
            onClick={() => window.location.reload()}
          >
            <RotateCcw size={16} aria-hidden="true" />
            טעינה מחדש
          </button>
          {/*
           * Closed by default. Kept because a report without it is a report nobody can act on,
           * and the self-check panel tells people to send one.
           */}
          {stack && (
            <details className="boundary-trace">
              <summary>פרטים טכניים לדיווח תקלה</summary>
              <pre dir="ltr">{stack}</pre>
            </details>
          )}
        </div>
      </main>
    );
  }
}

export default ErrorBoundary;
