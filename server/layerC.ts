/**
 * LAYER C -- THE EXTERNAL POINTER (section 3.4).
 *
 * Takes a claim and searches OUTSIDE the player's record -- the Lichess masters database for the
 * positions the claim rests on -- and returns pointers: what to look at next, which question to
 * ask, which drill would discriminate.
 *
 * IT CANNOT PROMOTE. Its return type is ExternalPointer, whose `promotes_grade` is the literal
 * type `false`, and the claim-update function has no overload that accepts it. GATE-EXTERNAL
 * proves that by compiling a file which attempts the promotion and requiring it to fail.
 *
 * DISABLED BY DEFAULT (LAYER_C_ENABLED). Section 3.4: "Layer C is the part most likely to
 * produce fluent nonsense, so it earns its way in with measurements, not with a demo." Layers A
 * and B are a complete product without it.
 *
 * It deliberately generates NO PROSE beyond naming what it looked at. Everything it returns is a
 * count, a source, or a question with a fixed shape. An LLM narrating engine output would be the
 * exact failure this layer is most at risk of, and section 7 forbids it outright.
 */
import type { Claim, DrillSpec, ExternalPointer } from "../shared/claim";
import { createDrill } from "../shared/drill";
import { getPostGameLayers } from "./lichess";

export const layerCEnabled = () => process.env.LAYER_C_ENABLED === "true";

/** Returned when the flag is off, so a caller can tell "disabled" from "found nothing". */
export interface LayerCDisabled {
  readonly kind: "disabled";
  reason: string;
}

export type LayerCResult = ExternalPointer | LayerCDisabled;

/**
 * How many of the claim's positions to look up. Bounded: the Lichess explorer is rate limited,
 * and a pointer built from three positions is no less a pointer than one built from thirty.
 */
export const MAX_POSITIONS_CONSULTED = 3;

export interface ClaimPositions {
  claim: Claim;
  /** FENs drawn from the claim's supporting decisions. */
  fens: string[];
}

export async function pointerForClaim(input: ClaimPositions): Promise<LayerCResult> {
  if (!layerCEnabled()) {
    return {
      kind: "disabled",
      reason:
        "שכבת המצביע החיצוני כבויה. שכבות ההחלטות והטענות עובדות בלעדיה; היא תידלק רק כשיהיו מדידות שמצדיקות אותה.",
    };
  }

  const consulted = input.fens.slice(0, MAX_POSITIONS_CONSULTED);
  const sources: ExternalPointer["sources"] = [];

  for (const fen of consulted) {
    try {
      const layers = await getPostGameLayers({ fen, source: "imported" });
      const total = layers.master.white + layers.master.draws + layers.master.black;
      sources.push({ origin: `lichess-masters:${fen.split(" ")[0].slice(0, 24)}`, n: total });
      if (layers.cloud?.depth) {
        sources.push({ origin: "lichess-cloud-eval", depth: layers.cloud.depth });
      }
    } catch {
      // A source that could not be consulted is simply absent. It is never reported as zero:
      // "no master games here" and "we could not ask" are different facts (R2).
    }
  }

  const drill: DrillSpec | null = consulted.length
    ? createDrill(input.claim, consulted, { drill_id: `drill-${input.claim.claim_id}` })
    : null;

  return {
    kind: "pointer",
    promotes_grade: false,
    suggested_next_question: `בעמדות שעליהן נשענת הטענה, מה בסיס הנתונים של המאסטרים משחק — ומה זה אומר על מה שאתה מעריך שם? זו שאלה, לא ראיה: היא לא משנה את דרגת הטענה.`,
    suggested_drill: drill,
    sources,
  };
}
