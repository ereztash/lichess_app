/**
 * What a browser may tell the server about a failure, as a wire schema both sides import.
 *
 * `.strict()` AND EVERY FIELD A CLOSED LIST OR A SHA. The reason this exists at all is that the
 * product promises the record never leaves the browser, and the way that promise gets broken is
 * not a decision to send the record -- it is a `message: string` on a telemetry event that one day
 * carries a driver's text, which carries the bound values, which are the player's sentence. A
 * schema that cannot hold a string a person wrote cannot be made to.
 *
 * `build` is the sha the CLIENT was served (read from `/build-identity.json`), or `unknown`. It is
 * public already and it is what lets an operator see that a failure belongs to a stale tab.
 */
import { z } from "zod";
import { CLIENT_FAILURE_CODES, CLIENT_SURFACES, FAILURE_CLASSES } from "./failure-class.js";

export const clientFailureEventSchema = z
  .object({
    code: z.enum(CLIENT_FAILURE_CODES),
    failureClass: z.enum(FAILURE_CLASSES),
    surface: z.enum(CLIENT_SURFACES),
    build: z.union([z.string().regex(/^[0-9a-f]{7,40}$/), z.literal("unknown")]),
    at: z.string().datetime(),
  })
  .strict();

export type ClientFailureEvent = z.infer<typeof clientFailureEventSchema>;
