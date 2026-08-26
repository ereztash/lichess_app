/**
 * Turn off Zod's JIT before any schema in this bundle is built.
 *
 * ITS OWN MODULE BECAUSE OF EVALUATION ORDER, and that is the whole reason this file exists rather
 * than two lines in `main.tsx`. Zod 4 compiles its parsers with `new Function`, and decides whether
 * it may by trying `new Function("")` in a try/catch. That decision is memoised the first time a
 * schema needs it -- which happens while `@shared/const` and the tRPC client are being imported,
 * before a single statement in `main.tsx` runs. Setting the flag in the entry's body was measured
 * and did nothing: the violation kept firing from the same offset.
 *
 * Imports are evaluated in order, so this must stay the FIRST import in `main.tsx`. It has no
 * exports on purpose -- there is nothing to use, and a side-effect import is what says so.
 */
import { config } from "zod";

config({ jitless: true });
