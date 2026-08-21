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
import type { AnalysisSource } from "@shared/analysis-source";
import { Rate } from "./Value";
type Props = {
  fen: string;
  source: AnalysisSource;
  enabled: boolean;
  onConnect: () => void;
  debugPersonalError?: string;
};
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
  /**
   * Only asked for once something has actually failed. A configuration report that runs on every
   * page load is a background request nobody reads; one that runs at the moment of failure is the
   * answer to the question the user is holding.
   */
  const config = trpc.system.lichessConfig.useQuery(undefined, {
    enabled: enabled && (layers.isError || personal.isError),
    retry: false,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
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
      {layers.isError && (
        <div className="layer-error">
          {layers.error.message || "לא ניתן לטעון את שכבות Lichess כרגע."}
        </div>
      )}
      <ConfigNotice missing={config.data?.missing} isOwner={config.data?.isOwner} />
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
              <Rate label="לבן" value={master?.white ?? 0} of={mt} />
              <Rate label="תיקו" value={master?.draws ?? 0} of={mt} />
              <Rate label="שחור" value={master?.black ?? 0} of={mt} />
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
                  <Rate label="לבן" value={own?.white ?? 0} of={pt} />
                  <Rate label="תיקו" value={own?.draws ?? 0} of={pt} />
                  <Rate label="שחור" value={own?.black ?? 0} of={pt} />
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

/**
 * Names the deployment-side cause of a failed Lichess request.
 *
 * Presence only: the server sends booleans and variable names, never values. "Could not load"
 * and "this deployment has no token" are different facts, and rendering them identically is the
 * failure mode this product is about.
 */
function ConfigNotice({ missing, isOwner }: { missing?: string[]; isOwner?: boolean }) {
  if (!missing) return null;
  const blocking = missing.filter((name) => name === "LICHESS_API_TOKEN" || name === "OWNER_OPEN_ID");
  if (blocking.length === 0 && isOwner !== false) return null;
  return (
    <div className="layer-error config-notice">
      {blocking.length > 0 && (
        <p>
          חסר בשרת: <b dir="ltr">{blocking.join(", ")}</b>. עד שיוגדר, שכבות Lichess לא ייטענו
          לאף חשבון.
        </p>
      )}
      {blocking.length === 0 && isOwner === false && (
        <p>
          אתם מחוברים בחשבון שאינו זה ש-<b dir="ltr">OWNER_OPEN_ID</b> מצביע עליו. הפריסה הזו היא
          חד־דיירית בכוונה, ולכן חשבון אחר נחסם.
        </p>
      )}
    </div>
  );
}
