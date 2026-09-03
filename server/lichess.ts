import { TRPCError } from "@trpc/server";
import { emit } from "./_core/telemetry.js";
const LICHESS_ORIGIN = "https://lichess.org";

/**
 * How long an upstream call may take before it is called a failure, in one place.
 *
 * NONE OF THESE FETCHES HAD A BOUND. The function has 30 seconds in total (`vercel.json`), so a
 * Lichess that accepted the connection and said nothing ended as a platform timeout: the process is
 * killed, `onError` never runs, the client gets a platform error page instead of the authored
 * sentence below, and no log line names Lichess as the subsystem. Ten seconds is generous for the
 * endpoints this reaches and leaves the function room to say what happened.
 */
export const UPSTREAM_TIMEOUT_MS = 10_000;

/** The sentence the player gets when Lichess does not answer in time. Authored, so it passes the wire. */
const UPSTREAM_TIMEOUT_MESSAGE = "Lichess לא ענה בזמן. אפשר לנסות שוב בעוד רגע.";

/**
 * `fetch` with the bound, and the timeout turned into an authored refusal that names its cause.
 *
 * The runtime raises `TimeoutError` (a DOMException) when `AbortSignal.timeout` fires; anything else
 * a fetch rejects with is a network refusal, and both are BAD_GATEWAY to the player -- the same
 * code the non-ok branches below already use, so the client's handling does not change.
 */
async function boundedFetch(url: string, init: RequestInit, subsystem: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    emit({
      code: timedOut ? "upstream-lichess-timeout" : "upstream-lichess-error",
      failureClass: timedOut ? "timeout" : "upstream-provider",
      path: subsystem,
      detail: timedOut ? `no answer within ${UPSTREAM_TIMEOUT_MS}ms` : (error instanceof Error ? error.name : typeof error),
    });
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: timedOut ? UPSTREAM_TIMEOUT_MESSAGE : "לא ניתן היה לקבל נתונים מ־Lichess כרגע.",
    });
  }
}

/** One line per upstream refusal, by status class, so the operator can count them. */
function noteUpstream(status: number, subsystem: string): void {
  emit({
    code:
      status === 429
        ? "upstream-lichess-429"
        : status === 401 || status === 403
          ? "upstream-lichess-auth"
          : "upstream-lichess-error",
    failureClass: "upstream-provider",
    path: subsystem,
    detail: `status ${status}`,
  });
}
const EXPLORER_ORIGIN = "https://explorer.lichess.org";
const GAME_ID = /^[A-Za-z0-9]{8,16}$/;
const STUDY_ID = /^[A-Za-z0-9]{8}$/;
export type LichessAccount = {
  id: string;
  username: string;
  title?: string;
  perfs?: Record<string, { rating?: number; games?: number }>;
};
export type LichessGame = {
  id: string;
  createdAt: number;
  lastMoveAt?: number;
  speed?: string;
  perf: string;
  rated: boolean;
  status: string;
  winner?: "white" | "black";
  opening?: { eco?: string; name?: string };
  players: {
    white: { user?: { id: string; name: string }; rating?: number; ratingDiff?: number };
    black: { user?: { id: string; name: string }; rating?: number; ratingDiff?: number };
  };
};
export type { AnalysisSource } from "../shared/analysis-source.js";
import { isPostGame } from "../shared/analysis-source.js";
import type { AnalysisSource } from "../shared/analysis-source.js";
type ExplorerMove = {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating?: number;
  opening?: { eco?: string; name?: string } | null;
};
export type OpeningExplorer = {
  white: number;
  draws: number;
  black: number;
  moves: ExplorerMove[];
  opening?: { eco?: string; name?: string } | null;
  queuePosition?: number;
};
export type CloudEvaluation = {
  depth?: number;
  knodes?: number;
  pvs: Array<{ moves: string; cp?: number; mate?: number; depth?: number }>;
};
function token() {
  const value = process.env.LICHESS_API_TOKEN;
  if (!value)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "אסימון Lichess אינו מוגדר עדיין.",
    });
  return value;
}
async function lichessFetch(path: string, accept: string) {
  const response = await boundedFetch(
    `${LICHESS_ORIGIN}${path}`,
    { headers: { Authorization: `Bearer ${token()}`, Accept: accept } },
    "lichess",
  );
  if (!response.ok) noteUpstream(response.status, "lichess");
  if (response.status === 429)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Lichess ביקש להמתין לפני הבקשה הבאה.",
    });
  if (response.status === 401 || response.status === 403)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "אסימון Lichess אינו מורשה לקריאת חשבון זה.",
    });
  if (!response.ok)
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "לא ניתן היה לקבל נתונים מ־Lichess כרגע.",
    });
  return response;
}
function ensurePostGame(source: AnalysisSource) {
  // The allowed list lives in shared/analysis-source.ts so the client cannot drift from it.
  if (!isPostGame(source))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "שכבות Lichess זמינות רק לניתוח משחק שהסתיים, Study או PGN מיובא.",
    });
}
async function explorerFetch(path: string) {
  const response = await boundedFetch(
    `${EXPLORER_ORIGIN}${path}`,
    {
      headers: {
        Authorization: `Bearer ${token()}`,
        Accept: "application/x-ndjson, application/json",
      },
    },
    "lichess-explorer",
  );
  if (!response.ok) noteUpstream(response.status, "lichess-explorer");
  if (response.status === 401 || response.status === 403)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "האסימון אינו מורשה לרפרטואר האישי של Lichess.",
    });
  if (response.status === 429)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Opening Explorer ביקש להמתין לפני הבקשה הבאה.",
    });
  if (!response.ok)
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "לא ניתן היה לקבל נתוני פתיחות מ־Lichess כרגע.",
    });
  return response;
}
async function firstJsonRecord<T>(response: Response): Promise<T> {
  const reader = response.body?.getReader();
  if (!reader) return response.json() as Promise<T>;
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const records = buffer.split("\n");
      buffer = records.pop() ?? "";
      for (const record of records)
        if (record.trim().startsWith("{")) return JSON.parse(record) as T;
      if (done) {
        const finalRecord = buffer.trim();
        if (finalRecord.startsWith("{")) return JSON.parse(finalRecord) as T;
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Lichess החזיר נתוני פתיחות לא תקינים.",
        });
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
async function getExplorer(path: string): Promise<OpeningExplorer> {
  return firstJsonRecord<OpeningExplorer>(await explorerFetch(path));
}
async function getCloudEvaluation(fen: string): Promise<CloudEvaluation | null> {
  const query = new URLSearchParams({ fen, multiPv: "3" });
  const response = await boundedFetch(
    `${LICHESS_ORIGIN}/api/cloud-eval?${query}`,
    { headers: { Authorization: `Bearer ${token()}`, Accept: "application/json" } },
    "lichess-cloud-eval",
  );
  if (response.status === 404) return null;
  if (!response.ok) noteUpstream(response.status, "lichess-cloud-eval");
  if (response.status === 429)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "הערכת הענן של Lichess ביקשה להמתין לפני הבקשה הבאה.",
    });
  if (response.status === 401 || response.status === 403)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "האסימון אינו מורשה להערכת הענן של Lichess.",
    });
  if (!response.ok)
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "לא ניתן היה לקבל הערכת ענן מ־Lichess כרגע.",
    });
  return response.json() as Promise<CloudEvaluation>;
}
export async function getLichessAccount(): Promise<LichessAccount> {
  const response = await lichessFetch("/api/account", "application/json");
  const account = (await response.json()) as LichessAccount;
  if (!account.id || !account.username)
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Lichess החזיר פרופיל חלקי." });
  return account;
}
export async function getRecentLichessGames(username: string, max: number): Promise<LichessGame[]> {
  const safeMax = Math.max(1, Math.min(max, 30));
  const query = new URLSearchParams({
    max: String(safeMax),
    pgnInJson: "true",
    opening: "true",
    finished: "true",
    sort: "dateDesc",
  });
  const response = await lichessFetch(
    `/api/games/user/${encodeURIComponent(username)}?${query}`,
    "application/x-ndjson",
  );
  const payload = await response.text();
  return payload
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LichessGame);
}
export async function getLichessGamePgn(gameId: string): Promise<string> {
  if (!GAME_ID.test(gameId))
    throw new TRPCError({ code: "BAD_REQUEST", message: "מזהה המשחק אינו תקין." });
  const response = await lichessFetch(
    `/game/export/${gameId}?opening=true&clocks=false&evals=false`,
    "application/x-chess-pgn",
  );
  const pgn = await response.text();
  if (!pgn.trim())
    throw new TRPCError({ code: "NOT_FOUND", message: "לא נמצא PGN עבור המשחק שבחרת." });
  return pgn;
}
export async function getPostGameLayers(input: { fen: string; source: AnalysisSource }) {
  ensurePostGame(input.source);
  const master = await getExplorer(`/masters?${new URLSearchParams({ fen: input.fen })}`);
  const cloud = await getCloudEvaluation(input.fen);
  return { master, cloud };
}
export async function getPersonalOpening(input: {
  fen: string;
  source: AnalysisSource;
  playerColor: "white" | "black";
}) {
  ensurePostGame(input.source);
  const account = await getLichessAccount();
  return getExplorer(
    `/player?${new URLSearchParams({ player: account.username, color: input.playerColor, fen: input.fen, recentGames: "0" })}`,
  );
}
export async function getLichessStudyPgn(studyReference: string): Promise<string> {
  const match = studyReference.match(/(?:lichess\.org\/study\/)?([A-Za-z0-9]{8})/);
  const studyId = match?.[1];
  if (!studyId || !STUDY_ID.test(studyId))
    throw new TRPCError({ code: "BAD_REQUEST", message: "קישור או מזהה ה־Study אינו תקין." });
  const path = `/api/study/${studyId}.pgn?clocks=false&comments=true&variations=true`;
  let response: Response;
  try {
    response = await lichessFetch(path, "application/x-chess-pgn");
  } catch (error) {
    if (!(error instanceof TRPCError) || error.code !== "UNAUTHORIZED") throw error;
    response = await boundedFetch(
      `${LICHESS_ORIGIN}${path}`,
      { headers: { Accept: "application/x-chess-pgn" } },
      "lichess-study",
    );
    if (!response.ok)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "ה־Study פרטי או שהאסימון אינו כולל הרשאת study:read.",
      });
  }
  const pgn = await response.text();
  if (!pgn.trim())
    throw new TRPCError({ code: "NOT_FOUND", message: "לא נמצא PGN עבור ה־Study שבחרת." });
  return pgn;
}
