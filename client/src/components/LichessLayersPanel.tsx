import {
  BookOpenCheck,
  CloudLightning,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
type AnalysisSource = "demo" | "imported" | "finished" | "study" | "live";
type Props = {
  fen: string;
  source: AnalysisSource;
  enabled: boolean;
  onConnect: () => void;
  debugPersonalError?: string;
};
const rate = (v: number, t: number) => (t ? `${Math.round((v / t) * 100)}%` : "—");
export function LichessLayersPanel({ fen, source, enabled, onConnect, debugPersonalError }: Props) {
  const [requested, setRequested] = useState(false);
  const [requestedPersonal, setRequestedPersonal] = useState(false);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const safe = source !== "live";
  const layers = trpc.lichess.postGameLayers.useQuery(
    { fen, source },
    {
      enabled: enabled && requested && safe,
      retry: false,
      staleTime: 45000,
      refetchOnWindowFocus: false,
    },
  );
  const personal = trpc.lichess.personalOpening.useQuery(
    { fen, source, playerColor },
    {
      enabled: enabled && requestedPersonal && safe,
      retry: false,
      staleTime: 45000,
      refetchOnWindowFocus: false,
    },
  );
  useEffect(() => {
    setRequested(false);
    setRequestedPersonal(false);
  }, [fen, source]);
  if (!safe)
    return (
      <section className="analysis-section fair-play-lock">
        <div className="section-heading">
          <span>שכבות Lichess</span>
          <LockKeyhole size={14} />
        </div>
        <p>
          מאגר פתיחות, ענן ומחקרים נעולים במשחק חדש או פעיל. טענו משחק שהסתיים או PGN כדי לנתח
          בדיעבד.
        </p>
      </section>
    );
  const master = layers.data?.master;
  const own = personal.data;
  const mt = master ? master.white + master.draws + master.black : 0;
  const pt = own ? own.white + own.draws + own.black : 0;
  const cloud = layers.data?.cloud?.pvs[0];
  const personalError =
    debugPersonalError ||
    (personal.isError ? personal.error.message || "לא ניתן לטעון רפרטואר אישי כעת." : undefined);
  return (
    <section className="analysis-section lichess-layers">
      <div className="section-heading">
        <span>שכבות Lichess</span>
        <span className="data-chip">POST-GAME</span>
      </div>
      <p className="layer-intro">פתיחות, ענן ורפרטואר אישי — רק לניתוח בדיעבד.</p>
      {!enabled && (
        <button className="layer-action" onClick={onConnect}>
          <LockKeyhole size={14} /> התחברו כדי לטעון שכבות
        </button>
      )}
      {enabled && !requested && (
        <button className="layer-action" onClick={() => setRequested(true)}>
          <BookOpenCheck size={14} /> קראו את העמדה דרך Lichess
        </button>
      )}
      {layers.isLoading && (
        <div className="layer-loading">
          <LoaderCircle size={15} /> מאתר שכבות ניתוח…
        </div>
      )}
      {layers.isError && <div className="layer-error">לא ניתן לטעון את שכבות Lichess כרגע.</div>}
      {layers.data && (
        <div className="layer-results">
          <div className="layer-block">
            <div className="layer-title">
              <BookOpenCheck size={14} />
              <span>מאגר Masters</span>
              <small>{master?.opening?.eco ?? "POS"}</small>
            </div>
            <b className="opening-name">{master?.opening?.name ?? "עמדה ללא שם פתיחה"}</b>
            <div className="outcome-row">
              <span>לבן {rate(master?.white ?? 0, mt)}</span>
              <span>תיקו {rate(master?.draws ?? 0, mt)}</span>
              <span>שחור {rate(master?.black ?? 0, mt)}</span>
            </div>
            <div className="reply-strip">
              {master?.moves.slice(0, 3).map((m) => (
                <span key={m.uci}>
                  <b>{m.san}</b>
                  <small>{m.white + m.draws + m.black}</small>
                </span>
              ))}
            </div>
          </div>
          <div className="layer-block personal-layer">
            <div className="layer-title">
              <UserRound size={14} />
              <span>הרפרטואר שלך</span>
              <div className="color-toggle">
                <button
                  className={playerColor === "white" ? "selected" : ""}
                  onClick={() => {
                    setPlayerColor("white");
                    setRequestedPersonal(true);
                  }}
                >
                  לבן
                </button>
                <button
                  className={playerColor === "black" ? "selected" : ""}
                  onClick={() => {
                    setPlayerColor("black");
                    setRequestedPersonal(true);
                  }}
                >
                  שחור
                </button>
              </div>
            </div>
            {!requestedPersonal && (
              <button className="personal-load" onClick={() => setRequestedPersonal(true)}>
                טענו רפרטואר אישי
              </button>
            )}
            {personal.isLoading && (
              <p className="layer-muted">מאנדקס את הארכיון האישי לפי העמדה…</p>
            )}
            {personalError && <p className="layer-error">{personalError}</p>}
            {requestedPersonal && !personal.isLoading && !personalError && (
              <>
                <b className="opening-name">{own?.opening?.name ?? "עדיין אין נתונים בעמדה זו"}</b>
                <div className="outcome-row">
                  <span>לבן {rate(own?.white ?? 0, pt)}</span>
                  <span>תיקו {rate(own?.draws ?? 0, pt)}</span>
                  <span>שחור {rate(own?.black ?? 0, pt)}</span>
                </div>
              </>
            )}
          </div>
          <div className="layer-block cloud-layer">
            <div className="layer-title">
              <CloudLightning size={14} />
              <span>הערכת ענן</span>
            </div>
            {cloud ? (
              <>
                <b className="cloud-score">
                  {cloud.mate !== undefined
                    ? `M${cloud.mate}`
                    : cloud.cp !== undefined
                      ? `${cloud.cp > 0 ? "+" : ""}${(cloud.cp / 100).toFixed(2)}`
                      : "—"}
                </b>
                <p className="cloud-pv" dir="ltr">
                  {cloud.moves || "ללא קו זמין"}
                </p>
              </>
            ) : (
              <p className="layer-muted">אין הערכת ענן לעמדה זו; Stockfish המקומי ממשיך לנתח.</p>
            )}
          </div>
          <button
            className="layer-refresh"
            onClick={() => void layers.refetch()}
            disabled={layers.isFetching}
          >
            <RefreshCw size={13} /> רעננו שכבות
          </button>
        </div>
      )}
    </section>
  );
}
