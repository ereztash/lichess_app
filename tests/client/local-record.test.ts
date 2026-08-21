// @vitest-environment jsdom
/**
 * The record kept in the browser.
 *
 * It exists so the loop works on a deployment with no OAuth portal, which is every deployment
 * until one exists. What matters is that it obeys the SAME rules as the server store, because
 * shared/record-service.ts runs against both and those rules are the product.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalRecordStore, localRecordAvailable } from "../../client/src/lib/local-record-store";
import * as service from "../../shared/record-service";

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function event(id: string) {
  return {
    decision_id: id,
    entry_state: { game_id: "g1", fen: FEN, ply: 0, phase: "opening", clock_ms_remaining: null },
    known: "המרכז פתוח",
    unknown: "לא יודע אם e5 עובד",
    decision: "e2e4",
    bounded_action: { seconds_taken: 12, confidence: 3, candidate_moves_considered: ["e2e4"] },
    result: null,
    feedback: null,
  } satisfies service.CommitEvent;
}

const RESULT = {
  engine_eval_cp: 20,
  engine_best_move: "d2d4",
  engine_depth: 18,
  engine_source: "local_sf18",
  cp_loss: 10,
} as const;

beforeEach(() => localStorage.clear());

describe("the browser-side record", () => {
  it("commits a decision and reads it back as an atom", async () => {
    const store = new LocalRecordStore();
    await service.commitDecision(store, event("11111111-1111-4111-8111-111111111111"));
    const atom = await store.getAtom("11111111-1111-4111-8111-111111111111");
    expect(atom?.decision).toBe("e2e4");
    expect(atom?.known).toBe("המרכז פתוח");
    // R3: nothing engine-shaped is present at commit time.
    expect(atom?.result).toBeNull();
  });

  it("survives a reload, because that is the entire point of storing it", async () => {
    await service.commitDecision(new LocalRecordStore(), event("22222222-2222-4222-8222-222222222222"));
    // A different instance, as after a page load.
    expect(await new LocalRecordStore().countDecisions()).toBe(1);
  });

  it("refuses a reveal for a decision that was never committed (R3)", async () => {
    const store = new LocalRecordStore();
    await expect(
      service.reveal(store, "33333333-3333-4333-8333-333333333333", { ...RESULT }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses a second reveal, because the record is append-only", async () => {
    const store = new LocalRecordStore();
    const id = "44444444-4444-4444-8444-444444444444";
    await service.commitDecision(store, event(id));
    await service.reveal(store, id, { ...RESULT });
    await expect(service.reveal(store, id, { ...RESULT })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("refuses to commit the same decision id twice", async () => {
    const store = new LocalRecordStore();
    const id = "55555555-5555-4555-8555-555555555555";
    await service.commitDecision(store, event(id));
    await expect(service.commitDecision(store, event(id))).rejects.toThrow(/append-only/);
  });

  it("stays silent about claims until there are enough decisions, with a reason", async () => {
    const store = new LocalRecordStore();
    const view = await service.currentClaim(store, { created_at: "2026-01-01T00:00:00.000Z" });
    expect(view.claim).toBeNull();
    // Silence with a stated reason, not an empty screen.
    expect(view.reason).toBeTruthy();
    expect(view.recorded).toBe(0);
  });

  it("reports storage being blocked instead of pretending the write worked", async () => {
    const store = new LocalRecordStore();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    // The write must surface. A silent no-op would make an unrecorded decision look recorded.
    await expect(
      service.commitDecision(store, event("66666666-6666-4666-8666-666666666666")),
    ).rejects.toThrow();
    expect(localRecordAvailable()).toBe(false);
    spy.mockRestore();
    expect(localRecordAvailable()).toBe(true);
  });
});

describe("choosing a backing", () => {
  it("treats a store that cannot write as unavailable", async () => {
    const store = new LocalRecordStore();
    expect(await store.isAvailable()).toBe(true);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    // The client picks its backing from this, so it must go false BEFORE a decision is taken.
    expect(await store.isAvailable()).toBe(false);
    spy.mockRestore();
  });
});
