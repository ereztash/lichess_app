import { Download, LoaderCircle, Search } from "lucide-react";
import { useRef, useState } from "react";
import { fetchUserGames, type ImportedGame } from "@/lib/lichess-public";
import type { EngineLine } from "@/lib/engine-line";
import { runImportDiagnostic, type ImportRunProgress } from "@/lib/import-run";
import { ImportDiagnosticPanel } from "./ImportDiagnostic";
import type { ImportDiagnostic } from "@shared/import-diagnostic";
import { readableFailureText } from "@/lib/commit-error";

type Props = {
  onLoad: (game: ImportedGame) => void;
  onClose: () => void;
  /**
   * Injected rather than imported here, for the same reason `analyzePositions` takes it: a static
   * import of stockfish.ts puts 7MB of wasm into the initial module graph and GATE-COMMIT fails.
   */
  analyze: (fen: string, depth: number) => Promise<EngineLine>;
};

const RESULT_LABEL: Record<string, string> = {
  mate: "מט",
  resign: "נכנעה",
  stalemate: "פט",
  timeout: "פסק זמן",
  outoftime: "נגמר הזמן",
  draw: "תיקו",
  cheat: "בוטל",
  variantEnd: "סיום וריאנט",
  unknownFinish: "הסתיים",
};

/**
 * Import a player's own games by username.
 *
 * No API token, no sign-in. Lichess serves this publicly, so the browser reads it directly.
 * Usernames, ratings and dates are Latin/numeric inside an RTL page, so each is marked ltr
 * individually rather than letting the paragraph direction reorder them.
 */
export function ImportGames({ onLoad, onClose, analyze }: Props) {
  const [username, setUsername] = useState("");
  const [games, setGames] = useState<ImportedGame[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ImportRunProgress | null>(null);
  const [diagnostic, setDiagnostic] = useState<ImportDiagnostic | null>(null);
  const [scanFailure, setScanFailure] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const search = async () => {
    setLoading(true);
    setFailure(null);
    setGames(null);
    setDiagnostic(null);
    setScanFailure(null);
    const result = await fetchUserGames(username, 20);
    setLoading(false);
    if (result.ok) setGames(result.games);
    else setFailure(result.failure.message);
  };

  /*
   * The engine over every imported game. Progress arrives already throttled -- analyzePositions
   * limits it to a few a second -- so this setState is not one render per position.
   */
  const scan = async () => {
    if (!games) return;
    const controller = new AbortController();
    abort.current = controller;
    setScanFailure(null);
    setDiagnostic(null);
    setProgress({ done: 0, total: 0, gamesDone: 0, games: games.length });
    try {
      const result = await runImportDiagnostic(games, username, analyze, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      setDiagnostic(result.diagnostic);
    } catch (error) {
      // R2: a scan that did not finish must not leave a reading on screen that looks finished.
      setDiagnostic(null);
      setScanFailure(readableFailureText(error, "הסריקה נעצרה לפני שהספיקה למדוד משהו."));
    } finally {
      setProgress(null);
      abort.current = null;
    }
  };

  return (
    <section className="import-games">
      <div className="drawer-heading">
        <div>
          <span>ייבוא לפי שם משתמש</span>
          <b>LICHESS</b>
        </div>
        <button onClick={onClose}>סגור</button>
      </div>

      <p className="import-hint">
        המשחקים הציבוריים שלכם בליצ'ס. לא נדרש מפתח API ולא נדרשת התחברות.
      </p>

      <div className="import-row">
        <input
          className="import-input"
          dir="ltr"
          placeholder="lichess username"
          value={username}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void search();
          }}
        />
        <button className="import-search" onClick={() => void search()} disabled={loading}>
          {loading ? <LoaderCircle size={14} className="spin" /> : <Search size={14} />}
          <span>{loading ? "מחפש…" : "חפש"}</span>
        </button>
      </div>

      {failure && <p className="import-failure">{failure}</p>}

      {games && !progress && !diagnostic && (
        <button className="import-scan" onClick={() => void scan()}>
          נתחו את {games.length} המשחקים ומדדו את הדליים
        </button>
      )}

      {progress && (
        <div className="import-progress">
          <p>
            {/*
              * Counts, never a percentage: this is "k of n", and the n is the point. A bare
              * percent here would be exactly the shape GATE-DENOM scans for.
              */}
            נסרקו {progress.done} עמדות מתוך {progress.total} — משחק {progress.gamesDone} מתוך{" "}
            {progress.games}
          </p>
          <span className="import-progress-track" aria-hidden="true">
            <i style={{ transform: `scaleX(${progress.total ? progress.done / progress.total : 0})` }} />
          </span>
          <button onClick={() => abort.current?.abort()}>עצור</button>
          <p className="import-progress-note">
            הזמן תלוי במכשיר. במדידה על מחשב נייד: 971 עמדות ב-43 שניות. בטלפון זה איטי יותר, ולא
            נמדד כמה.
          </p>
        </div>
      )}

      {scanFailure && <p className="import-failure">{scanFailure}</p>}

      {diagnostic && <ImportDiagnosticPanel diagnostic={diagnostic} />}

      {games && (
        <ul className="import-list">
          {games.map((game) => (
            <li key={game.id}>
              <button onClick={() => onLoad(game)}>
                <span className="import-players" dir="ltr">
                  {game.white} <i>vs</i> {game.black}
                </span>
                <span className="import-meta">
                  <b>{RESULT_LABEL[game.status] ?? game.status}</b>
                  <span dir="ltr">{game.speed}</span>
                  {game.playedAt > 0 && (
                    <time dir="ltr">
                      {new Date(game.playedAt).toLocaleDateString("he-IL", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })}
                    </time>
                  )}
                </span>
                {game.opening && <span className="import-opening">{game.opening}</span>}
                <Download size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
