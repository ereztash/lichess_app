/**
 * Nothing the product did not write reaches the wire.
 *
 * WHAT WAS REPRODUCED. Drive a real commit at a real MariaDB and make the statement fail.
 * drizzle-orm raises `Failed query: insert into decisions (...)` and APPENDS THE BOUND VALUES to
 * the message; the error also carries them on `params`. `toTrpc` rethrows anything that is not a
 * `RecordError`, there was no `errorFormatter`, and tRPC's default shape puts `message` on the
 * wire verbatim. Measured: message, params AND wire all contained the player's sentence.
 *
 * The value that comes back is `stated_unknown` -- what a player writes about what they did not
 * understand, recorded before anybody tells them the answer. It is the most private thing this
 * product holds and the reason `ownerProcedure` exists.
 *
 * Only the owner can reach these procedures, so it is not a cross-account leak. It is worse in a
 * different direction: a 500 body travels into browser devtools, into the platform's function
 * logs, and into anything on the response path -- places the record was never meant to reach,
 * against a product whose claim is that a record stays inside its deployment.
 *
 * THE RULE IS AN ALLOW-LIST, NOT A SCRUB. A denylist of patterns would have to anticipate every
 * driver's formatting. Only messages the product AUTHORED are allowed out; everything else is
 * replaced wholesale. That is why this is safe against a driver nobody has read yet.
 */
import { TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import { RecordError } from "../../shared/record-service.js";

/**
 * What the player is told when the server failed in a way the product did not author.
 *
 * IT USED TO SAY THE WRITE DID NOT HAPPEN, AND IT DOES NOT KNOW THAT.
 *
 * The sentence read "השרת נכשל באמצע הפעולה והיא לא נשמרה" -- the operation was not saved -- which
 * is a claim of fact this code cannot make. Several operations in this record are more than one
 * write: the reveal stores the engine's verdict and then the alternative's price, completing a
 * transfer stores the result and then the grade, authoring a rule stores the reflection and then
 * the rule. When the SECOND of a pair fails, "it was not saved" is precisely backwards about the
 * first, and the player is told the opposite of what the record holds.
 *
 * Its own note said R2 turns on the distinction between a lost decision and a slow one. It does,
 * and that is the argument for saying what is true rather than what is reassuring: the server does
 * not know how far it got, so it says so, and points at the record rather than asking to be
 * believed.
 *
 * IT STILL RECOMMENDS RETRYING, and that advice is now sound in a way it was not before: cycles
 * 31-43 made the completion paths replay rather than refuse. It is deliberately not promised as a
 * blanket property -- `commitDecision` still mints a fresh id per attempt, so a retry there writes
 * a second decision rather than repairing the first -- which is why this says "check the record"
 * and not "a retry writes nothing twice".
 */
export const INTERNAL_ERROR_MESSAGE =
  "השרת נכשל באמצע הפעולה. ייתכן שחלק ממנה נרשם וייתכן שלא — השרת לא יודע לומר. " +
  "נסו שוב, ואפשר לבדוק ברשומה מה נשמר. אם זה חוזר, זו תקלה בשרת ולא משהו שעשיתם.";

/**
 * The message that may leave the server for this error.
 *
 * `secrets` is a belt-and-braces argument for the case an authored message was BUILT from input:
 * nothing does that today, and the assertion that notices when something starts to lives in
 * tests/server/the-record-does-not-come-back-in-an-error.test.ts.
 */
export const MALFORMED_REQUEST_MESSAGE = "הבקשה לא תאמה את מה שהשרת מצפה לו בשדות:";

/**
 * A rejected input names its FIELDS and never its values.
 *
 * Replacing a validation failure with "the server failed" would be this file's own defect pointed
 * the other way: telling somebody the server broke when what happened is that the request was
 * malformed. A first version did exactly that -- the diagnostic that found the real leak also
 * caught a `BAD_REQUEST` carrying a `ZodError` being answered with the internal sentence.
 *
 * Paths only. zod's default message text echoes the received value for some issue kinds, and one
 * of the fields on this route is the sentence a player wrote about what they did not understand.
 */
function zodFields(error: ZodError): string {
  const paths = [...new Set(error.issues.map((issue) => issue.path.join(".")).filter(Boolean))];
  return `${MALFORMED_REQUEST_MESSAGE} ${paths.join(", ") || "?"}`;
}

export function safeErrorMessage(error: unknown, secrets: readonly string[] = []): string {
  if (error instanceof ZodError) return zodFields(error);
  const authored =
    error instanceof RecordError || error instanceof TRPCError ? error.message : null;
  if (authored === null) return INTERNAL_ERROR_MESSAGE;
  // An authored message that carries a value is not authored any more.
  return secrets.some((secret) => secret.length > 0 && authored.includes(secret))
    ? INTERNAL_ERROR_MESSAGE
    : authored;
}

/**
 * What the OPERATOR gets, which is not what the player gets.
 *
 * The parameterized statement is what makes a 500 diagnosable and it is safe by construction --
 * every value in it is `?`. Losing it entirely would trade a privacy defect for a blind one, so
 * this keeps `query` and the error's constructor name and drops `message` and `params`, which are
 * the two places drizzle puts the values.
 */
export function describeForOperator(error: unknown): string {
  const name = error instanceof Error ? error.constructor.name : typeof error;
  const query = (error as { query?: unknown } | null)?.query;
  return typeof query === "string" && query.length > 0 ? `${name}: ${query}` : name;
}
