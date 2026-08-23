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

  render() {
    if (!this.state.hasError) return this.props.children;
    const stack = this.state.error?.stack;
    return (
      <main className="boundary" dir="rtl">
        <div className="boundary-card">
          <AlertTriangle size={44} aria-hidden="true" />
          <h1>משהו נשבר במסך הזה</h1>
          <p className="boundary-body">
            זו תקלה באפליקציה ולא במשהו שעשיתם. החלטות שכבר נרשמו נשמרו — הרשומה נכתבת בכל החלטה, לא
            בסוף המשחק.
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
