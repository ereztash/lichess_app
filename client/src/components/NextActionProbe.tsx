/**
 * THE SHADOW AS A COMPONENT, SO A SCREEN CAN BE MEASURED WITHOUT PAYING FOR THE MEASUREMENT.
 *
 * WHY THIS IS NOT A HOOK CALL IN `Record.tsx`. The record page IS the entry chunk -- `App.tsx`
 * routes `/` to it -- and `useProductState` subscribes to the blitz reading chain, measured by
 * `docs/decisions/D22-next-action-ownership.md` at **+16.1 kB raw / +5.1 kB gzipped** in the entry
 * graph. On the SHA this was written against, `npm run bundle:budget` reported **0.2 kB** of room
 * under the raw entry ceiling and **0.0 kB** under the initial-download ceiling. A direct hook is
 * therefore not a judgement call about page weight; it is a gate failure by roughly eighty times
 * the available headroom.
 *
 * D22 DREW THE RIGHT CONCLUSION FROM THE RIGHT NUMBER AND THEN STOPPED ONE STEP SHORT. It refused
 * the instrumentation rather than refusing the EAGERNESS of it:
 *
 *   > That is a real page weight on two hot routes to write a row nobody reads, in service of a
 *   > question a test answers.
 *
 * The row is written after the screen has painted, from an effect, and nothing on screen depends on
 * it. A measurement with no render dependency has no business in the entry chunk, and a dynamic
 * import is how it leaves: the budget counts the entry chunk and what is eagerly fetched beside it,
 * and this module is neither.
 *
 * WHY IT RENDERS `null` RATHER THAN WRAPPING ANYTHING. `offeredAct` reads `[data-primary-action]`
 * off `document`, so the probe has to be mounted in the same tree as the screen but must not be
 * between the screen and the player. A sibling that renders nothing is exactly that. It also means
 * the probe cannot suspend the page: it is behind its own `Suspense` with a `null` fallback, so a
 * chunk that never arrives costs a missing row and not a missing screen.
 *
 * AND IT DELIBERATELY ARRIVES LATE. A shadow taken before the controls are in the DOM would read
 * `offered: null` on a screen that offers something -- `D22` found that exact shape twice, and
 * named it: a shadow that reports a made-up input is not a weaker shadow, it is one whose
 * disagreements are about itself. `useNextActionShadow` already waits for the readings to settle,
 * and the lazy boundary can only move the write later than that, never earlier.
 */
import type { ShadowSurface } from "@shared/next-action";
import { useNextActionShadow, useProductState } from "@/lib/next-action-shadow";

export function NextActionProbe({ surface }: { surface: ShadowSurface }) {
  useNextActionShadow(surface, useProductState());
  return null;
}

export default NextActionProbe;
