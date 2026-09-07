/**
 * THE LINEAGE INVARIANT, EXERCISED RATHER THAN SCANNED.
 *
 * `GATE-QUIET-WINDOW-LINEAGE` reads the source for a second opinion about the arm. This runs the
 * thing: it builds the same decision under both arms, pushes each through the real record service
 * and store, reads the atom back, and asks whether an analyst who had only those two rows could
 * tell which screen produced which.
 *
 * WHY BOTH HALVES ARE NEEDED. The gate catches a defect that is added; this catches one that is
 * DROPPED -- a field that stops surviving the wire, the store, or the read-back. Those are two
 * different failures and neither predicate sees the other's.
 *
 * THE HOLE IT CLOSES. The arm is `VITE_QUIET_EVIDENCE_WINDOW_ENABLED`, a build flag, so two
 * deployments of one commit agree on `gitSha` and on `CURRENT_PROTOCOL_VERSION` and still put two
 * different screens in front of two players. Nothing that already existed could separate the
 * resulting rows. See `shared/quiet-window.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  QUIET_WINDOW_EXPOSURES,
  producedUnderQuietWindow,
  quietWindowExposure,
  type QuietWindowExposure,
} from "@shared/quiet-window";
import { buildCommitEvent, emptyDraft, type PositionUnderDecision } from "@/lib/decision-session";
import { commitDecision } from "@shared/record-service";
import { MemoryRecordStore } from "../../server/record";
import { commitEventSchema } from "../../server/recordRouter";
import { decisionAtomSchema } from "@shared/decision-atom";

const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4";
const AT: PositionUnderDecision = {
  gameId: "g",
  fen: FEN,
  ply: 7,
  clockMsRemaining: null,
  /*
   * `play` at a ply the draw passes over, so this file tests the exposure field and nothing else.
   * `anchor` would drag in the bank-membership check and `first` the read exemption, and a lineage
   * test that fails for an instrument reason is a test about the wrong thing.
   */
  purpose: "play",
};
const DRAFT = { ...emptyDraft(), chosenMove: "g8f6" };

/** One decision, committed under a named arm, read back out of the store as an atom. */
async function roundTrip(exposure: QuietWindowExposure, decisionId: string) {
  const event = buildCommitEvent(decisionId, AT, DRAFT, 12, "per-decision", exposure);
  /* Through the wire schema, because a field the boundary drops is a field that never arrives. */
  const onTheWire = commitEventSchema.parse(event);
  const store = new MemoryRecordStore();
  await commitDecision(store, onTheWire);
  return (await store.getAtom(decisionId))!;
}

describe("the arm the screen was in, and the row that has to carry it", () => {
  it("derives the same answer the ribbon renders from, in both arms", () => {
    /*
     * The ribbon renders nothing exactly when this returns `context-ribbon-suppressed`, which is
     * asserted against the source by `GATE-QUIET-WINDOW-LINEAGE`. This is the table that says what
     * the one expression actually returns.
     */
    expect(quietWindowExposure({ armEnabled: false, producingEvidence: true })).toBe(
      "context-ribbon-visible",
    );
    expect(quietWindowExposure({ armEnabled: true, producingEvidence: true })).toBe(
      "context-ribbon-suppressed",
    );
    /* The arm only suppresses INSIDE the evidence window: outside it the ribbon is the product. */
    expect(quietWindowExposure({ armEnabled: true, producingEvidence: false })).toBe(
      "context-ribbon-visible",
    );
    expect(quietWindowExposure({ armEnabled: false, producingEvidence: false })).toBe(
      "context-ribbon-visible",
    );
  });

  it("stamps every new decision, whichever arm produced it", () => {
    for (const exposure of QUIET_WINDOW_EXPOSURES) {
      const event = buildCommitEvent("d", AT, DRAFT, 12, "per-decision", exposure);
      expect(event.quiet_window_exposure, exposure).toBe(exposure);
    }
  });

  it("carries the arm through the wire, the store and the read-back", async () => {
    const off = await roundTrip("context-ribbon-visible", "11111111-1111-4111-8111-111111111111");
    const on = await roundTrip("context-ribbon-suppressed", "22222222-2222-4222-8222-222222222222");
    expect(off.quiet_window_exposure).toBe("context-ribbon-visible");
    expect(on.quiet_window_exposure).toBe("context-ribbon-suppressed");
  });

  it("leaves two rows an analyst can actually tell apart, which is the whole point", async () => {
    const off = await roundTrip("context-ribbon-visible", "33333333-3333-4333-8333-333333333333");
    const on = await roundTrip("context-ribbon-suppressed", "44444444-4444-4444-8444-444444444444");
    /*
     * THE FIELDS THAT DO NOT SEPARATE THEM, asserted rather than assumed, because this is the
     * finding that made the field necessary. Same build, same protocol version, same protocol,
     * same timing -- and two different screens.
     */
    expect(on.protocol_version).toBe(off.protocol_version);
    expect(on.measurement_protocol).toBe(off.measurement_protocol);
    expect(on.reveal_timing).toBe(off.reveal_timing);
    expect(on.analysis_timing).toBe(off.analysis_timing);
    /* And the one that does. */
    expect(on.quiet_window_exposure).not.toBe(off.quiet_window_exposure);
    expect(producedUnderQuietWindow(on.quiet_window_exposure)).toBe(true);
    expect(producedUnderQuietWindow(off.quiet_window_exposure)).toBe(false);
  });

  it("keeps an unrecorded arm distinct from the control arm, rather than pooling them", () => {
    /*
     * A row written before the field existed recorded no condition. Reading `null` as the control
     * arm would enrol it retrospectively into a group it was never part of -- the failure
     * `measurement-protocol.ts` refuses to commit with `legacy`, and `record-store.ts` spells out
     * for `probeAssignment`. Three states, not two.
     */
    expect(producedUnderQuietWindow(null)).toBeNull();
    expect(producedUnderQuietWindow(null)).not.toBe(false);
  });

  it("accepts an unstamped row at the boundary, because an older client is not a bad one", () => {
    const id = "55555555-5555-4555-8555-555555555555";
    const event = buildCommitEvent(id, AT, DRAFT, 12, "per-decision", "context-ribbon-visible");
    const { quiet_window_exposure: _dropped, ...older } = event;
    const parsed = commitEventSchema.safeParse(older);
    expect(parsed.success, "the boundary refused a client that predates the field").toBe(true);
    expect(parsed.success && parsed.data.quiet_window_exposure).toBeNull();
  });

  it("holds the atom schema to the same three states", () => {
    const shape = decisionAtomSchema.shape.quiet_window_exposure;
    expect(shape.safeParse("context-ribbon-visible").success).toBe(true);
    expect(shape.safeParse("context-ribbon-suppressed").success).toBe(true);
    expect(shape.safeParse(null).success).toBe(true);
    /* Not an open string: an arm nobody defined is not an arm. */
    expect(shape.safeParse("quiet").success).toBe(false);
    expect(shape.safeParse(true).success).toBe(false);
  });
});
