/**
 * The record's home, and the app's front door.
 *
 * WHAT THIS PAGE IS FOR, in one line: every other chess tool tells you what you did wrong; this
 * one tells you when you did not know you were wrong. Chess.com Insights, Lichess Insights,
 * Aimchess, Chessable, DecodeChess and Noctie were all checked, and not one of them captures what
 * the player believed BEFORE the engine answered. That is the difference, and this page exists to
 * make it legible.
 *
 * THE STRUCTURAL PROBLEM THIS PAGE CANNOT SOLVE, only handle honestly. A calibration gap needs a
 * confidence stated before the reveal. It cannot be imported, backfilled or inferred -- which is
 * exactly what makes the record un-copyable, and exactly why there is nothing to show on the
 * first visit. No arrangement of panels gets around that. So the page has two lives:
 *
 *   NOTHING MEASURED YET  ->  say what this measures, and set up ONE decision on a position the
 *                             player actually reached. Not a reading. Not a preview of a reading.
 *   SOMETHING MEASURED    ->  the record, split by what was measured rather than by chess.
 *
 * THE SPLIT IS THE CLASSIFICATION, and it is the most important one on the screen: decisions with
 * a stated confidence behind them are a different measurement from imported games without one.
 * The first can carry a calibration gap. The second is move accuracy against an engine and can
 * never be anything else, however many games it covers. They are kept in separate containers with
 * separate headings so the two can never be read as one number.
 *
 * WHAT IS DELIBERATELY ABSENT while the record is thin:
 *   - the signed over/under-confidence headline. Under four defensible mappings of the same five
 *     confidence words it runs from -4.4% to +17.3% ON IDENTICAL DATA, so it is not yet a
 *     quantity this page is willing to lead with;
 *   - bucket rows at 0/30. A progress bar toward a number is the streak mechanic wearing a lab
 *     coat, and the product refuses streaks;
 *   - any figure derived from imported games anywhere near the word "כיול".
 */
import { Suspense, lazy, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useImportReading, useRecordReading } from "@/lib/record-api";
import { fetchGames } from "@/lib/fetch-games";
import {
  GAME_SOURCES,
  preferredSource,
  rememberSource,
  SOURCE_LABEL,
  type GameSource,
} from "@/lib/game-source";
import { pickFirstDecision } from "@/lib/first-decision";
import { ANCHOR_POSITIONS } from "@shared/anchor-set";
import { nextAnchor } from "@/lib/anchor-run";
import { writePosition } from "@/lib/session-position";
import { ImportDiagnosticPanel } from "@/components/ImportDiagnostic";

/**
 * How many games to pull for the first decision.
 *
 * Small on purpose. This is not the scan -- the scan reads hundreds of games to look for a
 * separable bucket and takes the better part of a minute. This needs one position, so it asks for
 * the smallest number that reliably contains one past the opening.
 */
const GAMES_FOR_FIRST_DECISION = 6;

/*
 * LAZY, because this page is now the first thing every visitor downloads.
 *
 * `RecordDashboard` draws a reliability chart, and recharts is 366kB of it. Importing it here
 * statically folded that into the entry bundle and took it from 586kB to 964kB -- paid by every
 * arrival, including the overwhelmingly common one where the record is empty and no chart is
 * rendered at all. `Home` already loads it this way; the front door has more reason to, not less.
 */
const RecordDashboard = lazy(() =>
  import("@/components/RecordDashboard").then((m) => ({ default: m.RecordDashboard })),
);

function FirstDecision({ knownUsername }: { knownUsername?: string }) {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState(knownUsername ?? "");
  /* The front door has to offer both sites, or the fastest route into the product is closed to
     whoever does not have a Lichess account. Remembered per browser, like the import drawer. */
  const [source, setSource] = useState<GameSource>(preferredSource);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      const result = await fetchGames(source, username, GAMES_FOR_FIRST_DECISION);
      if (!result.ok) {
        setError(result.failure.message);
        return;
      }
      const decision = pickFirstDecision(result.games, username);
      if (!decision) {
        /*
         * A real outcome, not a failure to handle vaguely: every game was too short, or none of
         * them was this account's. Saying which is the difference between a screen that can be
         * acted on and one that cannot.
         */
        setError(
          "אף אחד מהמשחקים האחרונים לא הגיע מעבר לפתיחה, ולכן אין בהם עמדה להחליט עליה. " +
            "אפשר לטעון משחק ידנית מהלוח.",
        );
        return;
      }
      /*
       * Handed over through the same store that already returns a player to the game they were
       * on. The board restores it on mount, so nothing new has to be threaded through the route.
       */
      writePosition({
        sans: decision.sans,
        ply: decision.ply,
        source: "finished",
        /*
         * A position handed over for a first decision, not a game already in progress: the coached
         * loop is what a single position wants, and it is what the board defaults to. Stated here
         * rather than left to the board's `useState`, because the arm now travels with the handoff.
         */
        revealTiming: "per-decision",
        orientation: decision.orientation,
        opponent: null,
        gameId: `${source}-${decision.gameId}`,
      });
      navigate("/play");
    } catch {
      setError(
        `לא הצלחתי להגיע ל-${SOURCE_LABEL[source]}. אפשר לנסות שוב, או לטעון משחק ידנית מהלוח.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="first-decision">
      <h2>ההחלטה הראשונה</h2>
      <p className="first-decision-lead">
        עמדה אחת ממשחק ש<strong>אתם</strong> שיחקתם. תבחרו מהלך ותגידו כמה אתם בטוחים — ורק אז
        המנוע ידבר. זה מה שהאפליקציה מודדת, וזו הדרך המהירה ביותר להרגיש אותו.
      </p>
      {/* Both named, because someone without a Lichess account has to see the other one exists. */}
      <div className="import-sources" role="group" aria-label="מאיזה אתר לייבא">
        {GAME_SOURCES.map((option) => (
          <button
            key={option}
            type="button"
            className={`ghost-control import-source${option === source ? " selected" : ""}`}
            aria-pressed={option === source}
            onClick={() => {
              setSource(option);
              rememberSource(option);
              setError(null);
            }}
          >
            {SOURCE_LABEL[option]}
          </button>
        ))}
      </div>
      <div className="first-decision-form">
        <label htmlFor="first-decision-username">שם המשתמש שלכם ב-{SOURCE_LABEL[source]}</label>
        <input
          id="first-decision-username"
          dir="ltr"
          lang="en"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && username.trim() && !busy) void begin();
          }}
          placeholder="username"
        />
        <button
          type="button"
          className="primary-control"
          disabled={busy || !username.trim()}
          onClick={() => void begin()}
        >
          {busy ? <Loader2 size={14} className="spin" /> : null}
          {busy ? "מביא משחק" : "קחו אותי לעמדה"}
        </button>
      </div>
      {error && (
        <p className="first-decision-error" role="alert">
          {error}
        </p>
      )}
      {/*
        * Said before they start, not after. The position is picked without looking at how the
        * move went -- no engine, no centipawn loss, no outcome -- because choosing the position
        * where they blundered would stage the result instead of measuring it.
        */}
      <p className="first-decision-note">
        העמדה נבחרת בלי להסתכל על מה שיצא מהמהלך שלכם — לא רצה עליה מנוע ולא נבדקה שום תוצאה.
        המשחקים נמשכים מ-Lichess ולא נשמרים כאן.
      </p>
    </section>
  );
}


/**
 * The way into the shared set.
 *
 * Inside the first layer rather than beside it, and that placement is a claim: an anchor decision
 * is an ordinary decision with a stated confidence, recorded exactly like any other. What makes
 * it different is only that everyone answers the same position, which is what lets the reading be
 * compared to somebody. A third walled layer would say it was a different kind of measurement.
 */
function AnchorRunControl({ answered }: { answered: readonly string[] }) {
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function start() {
    setBusy(true);
    const next = await nextAnchor(answered);
    if (!next) {
      setDone(true);
      setBusy(false);
      return;
    }
    /*
     * The same handoff a first decision uses. The board restores from this store on mount, so an
     * anchor position arrives by the path a returning player's own game already takes.
     */
    writePosition({
      sans: [...next.sans],
      ply: next.ply,
      source: "finished",
      // An anchor position is one decision, so the coached loop -- the same as the handoff above.
      revealTiming: "per-decision",
      orientation: next.sans.length % 2 === 0 ? "w" : "b",
      opponent: null,
      gameId: `anchor-${next.id}`,
    });
    navigate("/play");
  }

  if (done) {
    return (
      <p className="anchor-run-note">
        עניתם על כל {ANCHOR_POSITIONS.length} העמדות בסט המשותף. הקריאה למעלה היא כל מה שיש בו.
      </p>
    );
  }

  return (
    <div className="anchor-run">
      <div className="anchor-run-text">
        <b>הסט המשותף</b>
        <span>
          {answered.length} מתוך {ANCHOR_POSITIONS.length} עמדות. כולם עונים על אותן עמדות, ולכן
          רק הקריאה הזאת ניתנת להשוואה למישהו אחר — בשאר הרשומה כל אחד פגש עמדות אחרות.
        </span>
      </div>
      <button type="button" className="primary-control" onClick={start} disabled={busy}>
        {busy ? "טוען…" : "העמדה הבאה"}
      </button>
    </div>
  );
}

export default function Record() {
  const [, navigate] = useLocation();
  const reading = useRecordReading();
  const importReading = useImportReading();
  const scored = reading.data?.scored ?? 0;

  return (
    <main className="record-page">
      <header className="record-page-head">
        <div>
          <h1>הרשומה</h1>
          <p className="record-page-claim">
            כל כלי שחמט אחר אומר לכם מה עשיתם לא נכון. זה מודד מתי לא ידעתם שאתם לא יודעים —
            המרחק בין כמה הייתם בטוחים לכמה צדקתם.
          </p>
        </div>
        <button type="button" className="ghost-control" onClick={() => navigate("/play")}>
          ללוח
        </button>
      </header>

      {reading.isLoading ? (
        <p className="record-page-loading">קורא את הרשומה…</p>
      ) : scored === 0 ? (
        <FirstDecision knownUsername={importReading.reading?.username} />
      ) : (
        <section className="record-layer" aria-label="החלטות עם ביטחון מוצהר">
          <div className="record-layer-head">
            <h2>נמדד עם ביטחון שהצהרתם מראש</h2>
            <p>
              רק כאן אפשר לקרוא פער כיול, מפני שרק כאן יש מה להשוות: מה אמרתם לפני שהמנוע דיבר,
              מול מה שקרה.
            </p>
          </div>
          {reading.data && (
            <>
              <AnchorRunControl answered={reading.data.anchorAnswered} />
              <Suspense fallback={null}>
                <RecordDashboard reading={reading.data} />
              </Suspense>
            </>
          )}
        </section>
      )}

      {/*
        * The second layer, and the reason it is a layer rather than a row.
        *
        * An import can cover hundreds of games and still cannot produce a calibration gap: nobody
        * asked the player how sure they were at the time, and nothing can go back and ask. It is
        * move accuracy against an engine. Rendered in its own container, under its own heading,
        * so that the two measurements can never be read as one -- which is what would happen if
        * the biggest pile of numbers on the page sat next to the smallest without a wall.
        */}
      {importReading.reading && (
        <section className="record-layer secondary" aria-label="משחקים שכבר שוחקו">
          <div className="record-layer-head">
            <h2>נמדד בלי ביטחון מוצהר</h2>
            <p>
              דיוק מהלכים מול המנוע במשחקים שכבר שיחקתם. זו לא מדידת כיול ולא תהפוך לאחת — באותם
              משחקים איש לא שאל אתכם כמה אתם בטוחים, ואי אפשר לחזור ולשאול.
            </p>
          </div>
          <ImportDiagnosticPanel
            diagnostic={importReading.reading.diagnostic}
            provenance={{
              username: importReading.reading.username,
              games: importReading.reading.games,
              scannedAt: importReading.reading.scanned_at,
            }}
          />
        </section>
      )}

      {/*
        * THE NOTICE HAS TO REACH THE PERSON WHO RECEIVES THE BINARIES.
        *
        * This build conveys a GPL-3.0 engine and two OFL typefaces. A notices file in the
        * repository serves the person who clones it; it does nothing for the person who loads the
        * page, and they are the one the licences are about. The licence texts are served as static
        * files and this is the link that makes them reachable from the program that carries them.
        *
        * It sits at the bottom of the front door rather than on every screen, and it is small,
        * because it is a notice and not a feature. `dir="ltr"` on the two names because they are
        * Latin script inside a Hebrew document; `lang` because they are not Hebrew words.
        */}
      {/*
        * WAITS FOR THE PAGE TO SETTLE, and that is a defect this footer itself introduced.
        *
        * Measured on the built app at 390x844: adding this notice took the front door from CLS
        * 0.00015 to 0.07811. It is the last element on the page, so when the record layers finish
        * loading and replace "קורא את הרשומה…", it is pushed 289 pixels down -- and a shift of
        * the LAST element is still a shift.
        *
        * Rendering it after the record has answered means it is inserted at its final position
        * and never moves. An element appearing does not count against CLS; an element moving
        * does. The alternative -- reserving the layers' space -- cannot be done honestly, because
        * their height is the record's, and nobody knows it before it is read.
        */}
      {!reading.isLoading && (
      <footer className="record-notices">
        <p>
          המנוע{" "}
          <a href="/licenses/stockfish/COPYING.txt" dir="ltr" lang="en" hrefLang="en">
            Stockfish
          </a>{" "}
          נמסר עם התוכנה הזו תחת רישיון GPL-3.0, והגופנים{" "}
          <a href="/licenses/fonts/noto-sans-hebrew/OFL.txt" dir="ltr" lang="en" hrefLang="en">
            Noto Sans Hebrew
          </a>{" "}
          ו־
          <a href="/licenses/fonts/dm-mono/OFL.txt" dir="ltr" lang="en" hrefLang="en">
            DM Mono
          </a>{" "}
          תחת SIL OFL 1.1. הקישורים הם לנוסח הרישיון עצמו, כפי שהוא נשלח יחד עם הקבצים.
        </p>
      </footer>
      )}
    </main>
  );
}
