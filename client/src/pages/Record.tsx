/**
 * The record's home, and the app's front door.
 *
 * WHAT THIS PAGE IS FOR, in one line: an engine can say which move was better; it cannot say what
 * happened on the way to choosing. Chess.com Insights, Lichess Insights, Aimchess, Chessable,
 * DecodeChess and Noctie were all checked, and not one of them holds anything the player recorded
 * BEFORE the engine answered. That is the difference, and this page exists to make it legible.
 *
 * IT USED TO SAY THAT DIFFERENCE AS A CONSTRUCT -- "tells you when you did not know you were
 * wrong" -- and so did the header it produced. That sentence is true and it is not a problem a
 * chess player recognises having. The page now names the problem in board terms first and reaches
 * the construct afterwards, as a consequence rather than as an introduction.
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
import { Suspense, useState } from "react";
import { useLocation } from "wouter";
import { lazyChunk } from "@/lib/lazy-chunk";
import { Loader2 } from "lucide-react";
import { useClaimView, useImportReading, useRecordReading } from "@/lib/record-api";
import { OutcomeSummary } from "@/components/OutcomeSummary";
import { outcomeSummary } from "@/lib/outcome-summary";
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
import { PROMISE, PROMISE_RETURNING } from "@shared/promise";
import { nextAnchor } from "@/lib/anchor-run";
import { writePosition } from "@/lib/session-position";
import { ImportDiagnosticPanel } from "@/components/ImportDiagnostic";
import { WhatIsUnclear } from "@/components/WhatIsUnclear";
import { WhatIsUnderTest } from "@/components/WhatIsUnderTest";
import { whatIsUnclear, whatIsUnderTest } from "@shared/record-order";
import { visitsOnRecord } from "@/lib/progress-record";

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
const RecordDashboard = lazyChunk(() =>
  import("@/components/RecordDashboard").then((m) => ({ default: m.RecordDashboard })),
);

/**
 * The resume screen, for the same reason and with a bigger number behind it.
 *
 * Rendering it eagerly retained the entire blitz reading chain in the entry chunk -- the detector,
 * the six bucketings, `classifyPhase` and the wire schemas -- for +16.1 kB raw and +5.1 kB
 * gzipped. None of it had been in the entry before, because nothing on the entry route called
 * `blitzRecordReading`; one call from an eagerly-rendered component retained all of it.
 *
 * IT IS ALSO THE HONEST SPLIT. A visitor who has never played blitz downloads none of this, and a
 * returning one pays for it once, after the first paint, behind a reserved block.
 */
const ResumeScreen = lazyChunk(() =>
  import("@/components/ResumeScreen").then((m) => ({ default: m.ResumeScreen })),
);

/**
 * Hand a bank position to the board.
 *
 * ONE COPY, TWO CALLERS, and the second caller is the reason it was lifted out of
 * `AnchorRunControl`. The bank is now reachable from two places -- the returning player's control
 * inside the record layer, and the cold arrival who has no account to import from -- and a second
 * transcription of this handoff is a second chance for the two routes to disagree about what a
 * bank decision is. `firstDecisionPly: null` in particular is load-bearing: an anchor is always
 * asked on its own purpose, and stamping it `first` as well would put two names on one decision.
 */
async function handOverBankPosition(
  answered: readonly string[],
  navigate: (to: string) => void,
): Promise<"served" | "set-complete"> {
  const next = await nextAnchor(answered);
  if (!next) return "set-complete";
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
    firstDecisionPly: null,
    orientation: next.sans.length % 2 === 0 ? "w" : "b",
    opponent: null,
    gameId: `anchor-${next.id}`,
  });
  navigate("/play");
  return "served";
}

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
        /*
         * The ply this handoff exists to produce, so the board asks for a confidence on it.
         *
         * `decision.ply` is the position shown -- the half-move BEFORE the player's -- and the
         * board records the decision at `currentPly + 1`, so the decision's own ply is one past
         * it. Without this the decision is `play`, drawn at ASK_RATE, and carries no confidence
         * three times in four -- leaving `scored` at zero and this very screen on display again,
         * having promised "תגידו כמה אתם בטוחים" on the way out.
         */
        firstDecisionPly: decision.ply + 1,
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
      {/*
        * WHAT TO DO, and only that. The header above has already given the problem, the mechanism
        * and the possible payoff; repeating the mechanism here was the third time one first
        * viewport said "ורק אז המנוע ידבר", and a screen that says one thing three times is a
        * screen with one idea and no room for the next.
        */}
      <p className="first-decision-lead">
        עמדה אחת ממשחק ש<strong>אתם</strong> שיחקתם. החלטה אחת, שתי דקות.
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
        המשחקים נמשכים מ-{SOURCE_LABEL[source]} ולא נשמרים כאן.
      </p>

      {/*
        * THE ROUTE FOR SOMEONE WITH NO ACCOUNT TO IMPORT FROM, and the reason it is here rather
        * than left to the header's `ללוח`.
        *
        * Walked in Chromium from an empty profile. `ללוח` is a bare `navigate("/play")`: it lands
        * on the opening position of a new live game, which is a position where NO reveal branch
        * can fire. `theOneThing` needs either a centipawn loss at or over the material threshold
        * or a stated confidence to say anything at all, and the starting position gives a loss of
        * zero. So the first thing this product ever said to an account-less arrival was "אין כאן
        * דבר שהמדידה תומכת באמירתו" -- true, correct, and not what they came for.
        *
        * The bank is the set of positions that exist to be decided on, it is already served by
        * `AnchorRunControl` through the same handoff, and it was gated behind `scored > 0` --
        * that is, behind exactly the state this screen means "not yet". Opening it here adds no
        * capability and no position; it removes a gate from in front of the one route that works.
        *
        * SECOND, NOT FIRST. The player's own game is still the better first decision -- it is
        * their position, and the note above says why that matters -- so this stays below it and
        * says what it is rather than competing for the same click.
        */}
      <div className="first-decision-alt">
        <p>
          אין לכם חשבון באף אחד מהם, או שלא בא לכם למסור שם משתמש? אפשר להתחיל מעמדה מהסט המשותף —
          אותן עמדות שכולם עונים עליהן.
        </p>
        <button
          type="button"
          className="ghost-control"
          disabled={busy}
          onClick={() => {
            setError(null);
            void handOverBankPosition([], navigate);
          }}
        >
          עמדה מהסט המשותף
        </button>
      </div>
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
    if ((await handOverBankPosition(answered, navigate)) === "set-complete") {
      setDone(true);
      setBusy(false);
    }
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
  /*
   * The claim as the rest of the page already reads it. `ClaimPanel` calls the same hook, so the
   * summary and the card cannot disagree about the grade: react-query serves one cached result to
   * both, and a second fetch of the same thing is how two surfaces end up showing a claim at two
   * different grades a second apart.
   */
  const claimView = useClaimView();
  /*
   * HAS THIS RECORD MEASURED ANYTHING AT ALL -- which is not the same question as `scored`.
   *
   * `scored` is the DESCRIPTIVE population: free play and the front door's handoff. The evidence
   * policy files a bank answer as `separate`, so a player whose only decision was a bank answer
   * has `scored === 0` -- and this page used that number to decide whether to show them the
   * screen that asks for their first decision.
   *
   * That was invisible until the account-less route started handing cold arrivals a bank
   * position: walked in Chromium, one decision committed, revealed, a reveal branch fired, and
   * the front door offered the first decision again. The same liveness failure GATE-REACHABILITY
   * was written for, reintroduced through the door that was opened to fix it.
   *
   * The bank reading carries its own denominator and is the right one to add here: what this
   * gate asks is whether anything has been measured, and a bank answer has been.
   */
  const scored = reading.data?.scored ?? 0;
  const anchored = reading.data?.anchor.n ?? 0;
  const measured = scored + anchored;
  /*
   * READ ONCE, HERE, AND PASSED DOWN. The header suppresses the explanation on a return and the
   * resume screen appears on one; two components each calling the counter would be two chances to
   * disagree about who is returning, on the one screen whose whole job is to look different to the
   * two of them.
   */
  const returning = visitsOnRecord() > 1;

  return (
    <main className="record-page">
      {/*
        * TWO IDENTITIES, BECAUSE THERE ARE TWO VISITORS, and the page already branches on exactly
        * this distinction one element below.
        *
        * A returning player IS visiting the record, and "הרשומה" is the right name for the thing
        * they came back to. A cold arrival is asking a different question -- what is this -- and
        * the answer "the record" names a database object. The old header answered the returning
        * player's question to everybody, and then reached a research construct ("לא ידעתם שאתם
        * לא יודעים", "כמה הייתם בטוחים") inside one sentence, before naming any chess problem at
        * all.
        *
        * NOT AN ADAPTATION. It keys on whether the record has anything in it, which is the same
        * condition that decides whether the body below is the first-decision screen or the
        * reading. Nothing here reads the acquisition angle, the ledger, or anything about who
        * this person is.
        *
        * PROBLEM, THEN MECHANISM, THEN A HEDGED PAYOFF, in that order and no other. The construct
        * survives, further down and as a consequence -- "calibration" is not the job a chess
        * player hires anything to do, and leading with it teaches vocabulary to someone who has
        * not yet been told there is a problem.
        */}
      <header className="record-page-head">
        <div>
          {measured === 0 ? (
            <>
              <h1>מה קרה בהחלטה, לפני שהמנוע דיבר</h1>
              <p className="record-page-problem">{PROMISE.problem}</p>
              <p className="record-page-mechanism">{PROMISE.mechanism}</p>
              {/*
                * "לפעמים" IS LOAD-BEARING AND IS NOT HEDGING FOR ITS OWN SAKE. The reveal branch
                * that carries this distinction fires only when the record happens to contain the
                * evidence for it. A front door that promised it on every decision would bring
                * every arrival an expectation the instrument cannot meet, and then no continuation
                * measured afterwards would mean anything.
                */}
              <p className="record-page-payoff">{PROMISE.payoff}</p>
            </>
          ) : (
            <>
              <h1>הרשומה</h1>
              {/*
                * §13: THE EXPLANATION IS NOT SHOWN AGAIN.
                *
                * The finding that produced this line of the plan: a person who had seen this screen
                * dozens of times had almost never read it. So the sentence stays for somebody who
                * genuinely has not seen it -- a first arrival who already has a record, which is
                * what a second device looks like -- and goes away from the second visit onward,
                * where `ResumeScreen` below answers the questions this sentence does not.
                *
                * KEYED ON THE VISIT COUNT AND NOT ON THE RECORD, because they are different facts,
                * and the one §13 is about is "have I seen this before".
                */}
              {!returning && <p className="record-page-claim">{PROMISE_RETURNING}</p>}
            </>
          )}
        </div>
        <button type="button" className="ghost-control" onClick={() => navigate("/play")}>
          ללוח
        </button>
      </header>

      {/*
        * WHERE AM I · WHAT DO YOU KNOW · WHAT NOW -- above everything, and above the branch.
        *
        * ABOVE THE `measured === 0` SPLIT ON PURPOSE. That split asks whether the UNTIMED loop has
        * anything in it; a player who has only played blitz measures zero by it and would be sent
        * to the first-decision screen with a record full of games. The resume screen reads the
        * blitz record and says so, and it renders nothing at all when there is nothing to say --
        * so on a genuinely cold return it costs the page one absent element.
        */}
      {returning && (
        /*
         * LAZY, AND FOR THE REASON `RecordDashboard` IS: this page is the first thing every visitor
         * downloads. Rendering the resume eagerly retained the whole reading chain in the entry
         * chunk -- `detect`, the six bucketings, `classifyPhase` and the blitz wire schemas -- for
         * +16.1 kB raw, paid by every arrival including the overwhelming majority who have no blitz
         * record at all. Nothing was tree-shaken out before because nothing on the entry route
         * called `blitzRecordReading`; adding one call retained all of it.
         *
         * THE FALLBACK RESERVES THE SPACE, which is what makes this safe rather than a layout
         * shift on the topmost element of the front door. There is exactly one transition here and
         * both sides of it are the same height: a returning player ALWAYS gets a card -- §13's
         * "not enough has accumulated yet" is a state the resume screen renders, not a reason for
         * it to be absent -- so the reserved block is never left holding nothing.
         *
         * GATED ON `returning` OUTSIDE THE SUSPENSE rather than inside the component, so a first
         * arrival does not fetch the chunk at all and does not get the reserved space either.
         */
        <Suspense fallback={<div className="resume resume--pending" aria-hidden="true" />}>
          <ResumeScreen returning onPlay={() => navigate("/blitz")} />
        </Suspense>
      )}

      {reading.isLoading ? (
        <p className="record-page-loading">קורא את הרשומה…</p>
      ) : measured === 0 ? (
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
          {/*
            * OUTCOME FIRST, INSTRUMENTATION SECOND, and the order on the page is the whole change.
            *
            * Everything below this line was already true and almost none of it was an ANSWER: a
            * returning player had to assemble "did it find anything about me" out of a calibration
            * decomposition, six bucket rows, a discrimination area and a claim card. The summary
            * says at most three sentences, each taken from the module entitled to say it, and then
            * gets out of the way. It adds no measurement and owns no control -- the bank stays
            * with `AnchorRunControl`, the drill with `ClaimPanel`, the loop with `ContextRibbon`.
            *
            * Inside this layer rather than above it, because that is the measurement wall: every
            * statement it makes is about decisions whose confidence was stated before the engine
            * spoke. Imported accuracy is a different section with a different heading and cannot
            * reach this function at all.
            */}
          <OutcomeSummary
            statements={outcomeSummary({
              claim: claimView.data,
              reading: reading.data,
              /*
               * THE TWO FAILURES ARE PASSED SEPARATELY, and the `||` that used to fold them here
               * was the defect. A failed claim query has no `data`, so the summary returned
               * nothing and a broken record layer rendered exactly like a brand-new one; and a
               * failed READING silenced a claim that had loaded perfectly well. They are two
               * queries and either can fail on its own.
               */
              claimUnreadable: claimView.isError,
              readingUnreadable: reading.isError,
            })}
          />
          {/*
            * §25's ORDER, AND IT IS AN ORDER OF VALUE TO A DECISION rather than of visualization
            * type. What is clearest now, then what is still unclear, then what is being checked,
            * then everything else. The dashboard below is unchanged and is still the whole record;
            * what changed is that a returning player no longer has to start there.
            *
            * THE SECOND SECTION IS THE ADDITION THAT MATTERS. "What is still unclear" is the most
            * common true statement this product can make -- the M0 audit measured the chain as
            * silent on most records most of the time -- and it was scattered across the panels
            * below as individual cells reading "not enough data", with no way to tell which of them
            * a player could do anything about.
            */}
          <WhatIsUnclear items={reading.data ? whatIsUnclear(reading.data) : []} />
          <WhatIsUnderTest test={whatIsUnderTest(claimView.data?.claim)} />

          {reading.data && (
            <>
              <AnchorRunControl answered={reading.data.anchorAnswered} />
              {/*
                * EVERYTHING ELSE, LAST. Not demoted and not hidden: the sections above make no
                * measurement of their own and add nothing this does not already contain -- they are
                * the same record, read in the order a decision needs it.
                */}
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
