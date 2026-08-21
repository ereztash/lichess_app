import express, { type Request, type Response } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { initTRPC, TRPCError } from "@trpc/server";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import superjson from "superjson";
import { z } from "zod";

const COOKIE_NAME = "app_session_id";
const OAUTH_STATE_COOKIE = "__Host-oauth_state";
const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
const AXIOS_TIMEOUT_MS = 30_000;
const UNAUTHED_ERR_MSG = "Please login (10001)";
const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
};

type User = { openId: string; name: string; email: string | null; role: "user" | "admin" };
type Ctx = { req: Request; res: Response; user: User | null };
type OAuthState = { redirectUri: string; nonce?: string };

const decodeOAuthState = (state: string): OAuthState => {
  try {
    const decoded = atob(state);
    try {
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed.redirectUri === "string") return parsed;
    } catch {}
    return { redirectUri: decoded };
  } catch {
    return { redirectUri: "" };
  }
};

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;
  const forwarded = req.headers["x-forwarded-proto"];
  const list = Array.isArray(forwarded) ? forwarded : String(forwarded ?? "").split(",");
  return list.some(v => v.trim().toLowerCase() === "https");
}

function cookieOptions(req: Request) {
  return { httpOnly: true, path: "/", sameSite: "none" as const, secure: isSecureRequest(req) };
}

function jwtSecret() {
  if (!ENV.cookieSecret) throw new Error("JWT_SECRET is not configured");
  return new TextEncoder().encode(ENV.cookieSecret);
}

async function authenticate(req: Request): Promise<User | null> {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  let token = cookies[COOKIE_NAME];
  const auth = req.headers.authorization;
  if (!token && auth?.startsWith("Bearer ")) token = auth.slice(7);
  if (!token || !ENV.cookieSecret) return null;
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: ["HS256"] });
    const openId = typeof payload.openId === "string" ? payload.openId : "";
    if (!openId) return null;
    const name = typeof payload.name === "string" ? payload.name : "User";
    return { openId, name, email: null, role: ENV.ownerOpenId && openId === ENV.ownerOpenId ? "admin" : "user" };
  } catch {
    return null;
  }
}

async function createSession(openId: string, name = "User") {
  return new SignJWT({ openId, appId: ENV.appId, name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
    .sign(jwtSecret());
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AXIOS_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OAuth request failed (${response.status})`);
    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

const LICHESS_ORIGIN = "https://lichess.org";
const EXPLORER_ORIGIN = "https://explorer.lichess.org";
type AnalysisSource = "demo" | "imported" | "finished" | "study" | "live";

function lichessToken() {
  const value = process.env.LICHESS_API_TOKEN;
  if (!value) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "אסימון Lichess אינו מוגדר עדיין." });
  return value;
}

async function lichessFetch(path: string, accept: string) {
  const response = await fetch(`${LICHESS_ORIGIN}${path}`, {
    headers: { Authorization: `Bearer ${lichessToken()}`, Accept: accept },
  });
  if (response.status === 429) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Lichess ביקש להמתין לפני הבקשה הבאה." });
  if (response.status === 401 || response.status === 403) throw new TRPCError({ code: "UNAUTHORIZED", message: "אסימון Lichess אינו מורשה לקריאת חשבון זה." });
  if (!response.ok) throw new TRPCError({ code: "BAD_GATEWAY", message: "לא ניתן היה לקבל נתונים מ־Lichess כרגע." });
  return response;
}

function ensurePostGame(source: AnalysisSource) {
  if (!["finished", "imported", "study"].includes(source)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "שכבות Lichess זמינות רק לניתוח בדיעבד." });
  }
}

async function explorer(path: string) {
  const response = await fetch(`${EXPLORER_ORIGIN}${path}`, {
    headers: { Authorization: `Bearer ${lichessToken()}`, Accept: "application/x-ndjson, application/json" },
  });
  if (response.status === 401 || response.status === 403) throw new TRPCError({ code: "UNAUTHORIZED", message: "האסימון אינו מורשה ל־Opening Explorer." });
  if (response.status === 429) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Opening Explorer ביקש להמתין." });
  if (!response.ok) throw new TRPCError({ code: "BAD_GATEWAY", message: "לא ניתן לקבל נתוני פתיחות כרגע." });
  const text = await response.text();
  const line = text.split("\n").find(x => x.trim().startsWith("{"));
  if (!line) throw new TRPCError({ code: "BAD_GATEWAY", message: "Lichess החזיר נתונים לא תקינים." });
  return JSON.parse(line);
}

async function account() {
  const response = await lichessFetch("/api/account", "application/json");
  const data = await response.json() as any;
  if (!data?.id || !data?.username) throw new TRPCError({ code: "BAD_GATEWAY", message: "Lichess החזיר פרופיל חלקי." });
  return data;
}

async function cloud(fen: string) {
  const query = new URLSearchParams({ fen, multiPv: "3" });
  const response = await fetch(`${LICHESS_ORIGIN}/api/cloud-eval?${query}`, {
    headers: { Authorization: `Bearer ${lichessToken()}`, Accept: "application/json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new TRPCError({ code: "BAD_GATEWAY", message: "לא ניתן לקבל הערכת ענן כרגע." });
  return response.json();
}

const t = initTRPC.context<Ctx>().create({ transformer: superjson });
const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
const ownerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ENV.ownerOpenId || ctx.user.openId !== ENV.ownerOpenId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "חיבור Lichess זמין רק לבעל החשבון שהגדיר אותו." });
  }
  return next({ ctx });
});

const appRouter = t.router({
  system: t.router({
    health: publicProcedure.input(z.object({ timestamp: z.number().min(0) })).query(() => ({ ok: true })),
  }),
  auth: t.router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  lichess: t.router({
    account: ownerProcedure.query(() => account()),
    recentGames: ownerProcedure.input(z.object({ max: z.number().int().min(1).max(30).default(12) })).query(async ({ input }) => {
      const lichessAccount = await account();
      const query = new URLSearchParams({ max: String(input.max), pgnInJson: "true", opening: "true", finished: "true", sort: "dateDesc" });
      const response = await lichessFetch(`/api/games/user/${encodeURIComponent(lichessAccount.username)}?${query}`, "application/x-ndjson");
      return (await response.text()).split("\n").filter(Boolean).map(line => JSON.parse(line));
    }),
    gamePgn: ownerProcedure.input(z.object({ gameId: z.string().regex(/^[A-Za-z0-9]{8,16}$/) })).mutation(async ({ input }) =>
      (await lichessFetch(`/game/export/${input.gameId}?opening=true&clocks=false&evals=false`, "application/x-chess-pgn")).text()
    ),
    postGameLayers: ownerProcedure.input(z.object({
      fen: z.string().min(8).max(200),
      source: z.enum(["demo", "imported", "finished", "study", "live"]),
    })).query(async ({ input }) => {
      ensurePostGame(input.source);
      return {
        master: await explorer(`/masters?${new URLSearchParams({ fen: input.fen })}`),
        cloud: await cloud(input.fen),
      };
    }),
    personalOpening: ownerProcedure.input(z.object({
      fen: z.string().min(8).max(200),
      source: z.enum(["demo", "imported", "finished", "study", "live"]),
      playerColor: z.enum(["white", "black"]),
    })).query(async ({ input }) => {
      ensurePostGame(input.source);
      const lichessAccount = await account();
      return explorer(`/player?${new URLSearchParams({ player: lichessAccount.username, color: input.playerColor, fen: input.fen, recentGames: "0" })}`);
    }),
    studyPgn: ownerProcedure.input(z.object({ studyReference: z.string().min(8).max(250) })).mutation(async ({ input }) => {
      const id = input.studyReference.match(/(?:lichess\.org\/study\/)?([A-Za-z0-9]{8})/)?.[1];
      if (!id) throw new TRPCError({ code: "BAD_REQUEST", message: "מזהה Study אינו תקין." });
      return (await lichessFetch(`/api/study/${id}.pgn?clocks=false&comments=true&variations=true`, "application/x-chess-pgn")).text();
    }),
  }),
});

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.get("/api/health", (_req, res) => res.status(200).json({ ok: true }));
app.get("/api/oauth/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  if (!code || !state) return void res.status(400).json({ error: "code and state are required" });
  const { nonce, redirectUri } = decodeOAuthState(state);
  const expected = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
  if (!nonce || nonce !== expected) return void res.status(403).json({ error: "invalid oauth state" });
  if (!ENV.oAuthServerUrl || !ENV.appId) return void res.status(503).json({ error: "OAuth is not configured" });
  try {
    const base = ENV.oAuthServerUrl.replace(/\/$/, "");
    const token = await postJson<{ accessToken: string }>(`${base}/webdev.v1.WebDevAuthPublicService/ExchangeToken`, {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri,
    });
    const user = await postJson<{ openId: string; name?: string }>(`${base}/webdev.v1.WebDevAuthPublicService/GetUserInfo`, {
      accessToken: token.accessToken,
    });
    const session = await createSession(user.openId, user.name || "User");
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    res.cookie(COOKIE_NAME, session, { ...cookieOptions(req), maxAge: ONE_YEAR_MS });
    res.redirect(302, "/");
  } catch (error) {
    console.error("[OAuth]", error);
    res.status(500).json({ error: "OAuth callback failed" });
  }
});
app.use("/api/trpc", createExpressMiddleware({
  router: appRouter,
  createContext: async ({ req, res }) => ({ req, res, user: await authenticate(req) }),
}));

export default app;
