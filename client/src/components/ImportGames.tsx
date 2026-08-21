import { Download, LoaderCircle, Search } from "lucide-react";
import { useState } from "react";
import { fetchUserGames, type ImportedGame } from "@/lib/lichess-public";

type Props = {
  onLoad: (game: ImportedGame) => void;
  onClose: () => void;
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
export function ImportGames({ onLoad, onClose }: Props) {
  const [username, setUsername] = useState("");
  const [games, setGames] = useState<ImportedGame[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    setFailure(null);
    setGames(null);
    const result = await fetchUserGames(username, 20);
    setLoading(false);
    if (result.ok) setGames(result.games);
    else setFailure(result.failure.message);
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
