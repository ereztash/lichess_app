/**
 * THE CONTROL FOR `GATE-QUIET-WINDOW-LINEAGE`, carrying all three defects at once.
 *
 * NOT A SCREEN, and never rendered. It is the tree in the shape it would take if somebody made the
 * one change the gate exists to catch: decided the arm a second time, at the render, from the build
 * flag, while the row went on being stamped somewhere else.
 *
 * The defect it reproduces is the reason `shared/quiet-window.ts` exists. The arm is a BUILD FLAG,
 * so two deployments of one commit can show two different screens under one `protocol_version`. If
 * the render and the stored value are decided in two places, they can disagree, and a row that says
 * `context-ribbon-visible` while the ribbon was suppressed is worse than no row: it is a
 * measurement asserting a condition that did not hold.
 */
import { QUIET_EVIDENCE_WINDOW_ENABLED } from "@/lib/features";

export function ContextRibbon({ producingEvidence = false }: { producingEvidence?: boolean }) {
  /* 1. A second suppression path: the arm decided here, not by `quietWindowExposure`. */
  if (QUIET_EVIDENCE_WINDOW_ENABLED && producingEvidence) return null;
  return <div className="context-ribbon" />;
}
