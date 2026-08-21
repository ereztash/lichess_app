import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";
export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
/**
 * What sign-in needs from the BUILD, and what is actually present.
 *
 * VITE_* values are inlined by Vite at build time, not read at runtime. A variable added in
 * Vercel after a build is not in that build: the deployment must be rebuilt for it to appear.
 * That is the single most confusing thing about this failure, so it is named on screen.
 */
export function signInConfig(): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!import.meta.env.VITE_OAUTH_PORTAL_URL) missing.push("VITE_OAUTH_PORTAL_URL");
  if (!import.meta.env.VITE_APP_ID) missing.push("VITE_APP_ID");
  return { ready: missing.length === 0, missing };
}

export type StartLoginResult = { started: true } | { started: false; missing: string[] };

/**
 * Begin sign-in, or report why it cannot begin.
 *
 * This used to console.warn and return, so the button did nothing visible. "Nothing happened"
 * and "this deployment is not configured" rendered identically -- the exact failure this
 * product exists to prevent, in the product itself.
 */
export const startLogin = (): StartLoginResult => {
  const config = signInConfig();
  if (!config.ready) {
    return { started: false, missing: config.missing };
  }
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  const state = encodeOAuthState({ redirectUri, nonce });
  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");
  window.location.href = url.toString();
  return { started: true };
};
