import type { CookieOptions, Request } from "express";
function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;
  const forwarded = req.headers["x-forwarded-proto"];
  if (!forwarded) return false;
  const list = Array.isArray(forwarded) ? forwarded : forwarded.split(",");
  return list.some((p) => p.trim().toLowerCase() === "https");
}
/**
 * LAX, NOT NONE, AND THE DIFFERENCE IS THE ONLY CSRF DEFENCE THIS DEPLOYMENT HAS.
 *
 * `SameSite=None` means the browser attaches the session to requests any other site makes -- a
 * form post, an image, a fetch from a page the player has open in another tab. Every mutation
 * here is owner-gated, so the attacker cannot be a stranger; but the gate checks WHO, and a
 * cross-site request carries the owner's own cookie, so the gate passes. There is no CSRF token
 * anywhere in this codebase. `SameSite` is the whole of the defence, and it was switched off.
 *
 * Nothing needed it off. The one cross-site entry is the OAuth provider's redirect back to
 * `/api/oauth/callback`, which is a TOP-LEVEL GET NAVIGATION -- exactly the case `Lax` allows.
 *
 * It also fixes a second thing quietly: browsers reject `SameSite=None` without `Secure`, and
 * `secure` here is false over plain http. On a local http deployment the session cookie was being
 * dropped by the browser rather than stored.
 */
export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  return { httpOnly: true, path: "/", sameSite: "lax", secure: isSecureRequest(req) };
}
