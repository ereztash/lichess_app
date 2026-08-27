// @vitest-environment jsdom
/**
 * The record kept in the browser.
 *
 * It exists so the loop works on a deployment with no OAuth portal, which is every deployment
 * until one exists. What matters is that it obeys the SAME rules as the server store, because
 * shared/record-service.ts runs against both and those rules are the product.
 */
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LocalRecordStore,
  localRecordAvailable,
  localRecordDurability,
  resetSessionFallbackForTests,
} from "../../client/src/lib/local-record-store";
import * as service from "../../shared/record-service";

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function event(id: string) {
  return {
    decision_id: id,
    entry_state: { game_id: "g1", fen: FEN, ply: 0, phase: "opening", clock_ms_remaining: null },
    known: "המרכז פתוח",
    unknown: "לא יודע אם e5 עובד",
    decision: "e2e4",
    bounded_action: { seconds_taken: 12, confidence: 3, confidence_scale: CONFIDENCE_LEVELS, candidate_moves_considered: ["e2e4"] },
    // No arm: this file is about the browser record, and a decision with no arm is one written
    // by a client that does not run the probe. Null here is a fourth state, never a control.
    probe: null,
    reveal_timing: null,
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

beforeEach(() => {
  localStorage.clear();
  resetSessionFallbackForTests();
});

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
    await service.commitDecision(
      new LocalRecordStore(),
      event("22222222-2222-4222-8222-222222222222"),
    );
    // A different instance, as after a page load.
    expect(await new LocalRecordStore().countDecisions()).toBe(1);
  });

  it("refuses a reveal for a decision that was never committed (R3)", async () => {
    const store = new LocalRecordStore();
    await expect(
      service.reveal(store, "33333333-3333-4333-8333-333333333333", { ...RESULT }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses a second reveal that carries a DIFFERENT verdict, because the record is append-only", async () => {
    /*
     * THE APPEND-ONLY RULE IS ABOUT THE VALUE, NOT ABOUT THE CALL, and this test used to conflate
     * them: it asserted that revealing twice with the identical result was a CONFLICT.
     *
     * `reveal` writes twice -- the engine's verdict, then the alternative's price -- and the two
     * are not atomic. Refusing every second call meant a half-written record could never be
     * completed, and the browser store is one of the three places that happens
     * (`client/src/lib/local-record-store.ts` commits to localStorage twice; a tab closed between
     * them is the same window). An identical replay now completes what is missing and writes
     * nothing else. A second verdict is still refused, and that is what this asserts.
     */
    const store = new LocalRecordStore();
    const id = "44444444-4444-4444-8444-444444444444";
    await service.commitDecision(store, event(id));
    await service.reveal(store, id, { ...RESULT });
    await expect(
      service.reveal(store, id, { ...RESULT, cp_loss: RESULT.cp_loss + 100 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // And the stored verdict is the first one, untouched.
    expect((await store.getAtom(id))?.result?.cp_loss).toBe(RESULT.cp_loss);
  });

  it("replays an identical reveal instead of refusing it, in the browser store too", async () => {
    // The retry a lost response makes inevitable. It writes nothing and returns the record.
    const store = new LocalRecordStore();
    const id = "66666666-6666-4666-8666-666666666666";
    await service.commitDecision(store, event(id));
    const once = await service.reveal(store, id, { ...RESULT });
    const twice = await service.reveal(store, id, { ...RESULT });
    expect(twice.result).toEqual(once.result);
  });

  it("refuses to commit the same decision id twice", async () => {
    const store = new LocalRecordStore();
    const id = "55555555-5555-4555-8555-555555555555";
    await service.commitDecision(store, event(id));
    await expect(service.commitDecision(store, event(id))).rejects.toThrow(/append-only/);
  });

  it("keeps reflection feedback append-only, like the MySQL store", async () => {
    const store = new LocalRecordStore();
    const id = "12121212-1212-4212-8212-121212121212";
    await service.commitDecision(store, event(id));
    await service.reveal(store, id, RESULT);
    await service.feedback(store, id, { revisedRead: "first revision", wouldChooseAgain: false });
    await expect(
      service.feedback(store, id, { revisedRead: "rewritten later", wouldChooseAgain: true }),
    ).rejects.toThrow(/append-only/);
    expect((await store.getAtom(id))?.feedback?.revised_read).toBe("first revision");
  });

  it("reads a decision written before the purpose existed as unstamped, not as free play", async () => {
    /*
     * THE STORE THAT ACTUALLY HAS SUCH ROWS. The browser record is written by whatever build the
     * player last loaded and it is never migrated, so rows from the era when the purpose was
     * derived at render time and thrown away are sitting in real localStorage right now. They are
     * NOT all ordinary moves -- the shared bank, the drills and the transfer checks all wrote
     * through here -- so reading an absent purpose as `play` would file every drill of that era as
     * free play, which is precisely the comparison the drills exist to support.
     */
    const store = new LocalRecordStore();
    const id = "14141414-1414-4414-8414-141414141414";
    await service.commitDecision(store, { ...event(id), purpose: "drill" });

    const stored = JSON.parse(localStorage.getItem("decision-lab.record.v1")!);
    expect(stored.decisions[0].purpose, "the purpose never reached storage").toBe("drill");
    delete stored.decisions[0].purpose;
    localStorage.setItem("decision-lab.record.v1", JSON.stringify(stored));

    const atom = await new LocalRecordStore().getAtom(id);
    expect(atom, "an older row stopped being readable at all").not.toBeNull();
    expect(atom?.purpose, "an unstamped decision came back as an ordinary move").toBeNull();
    expect(atom?.known, "the rest of the row was lost with the purpose").toBe("המרכז פתוח");
  });

  it("adds empty learning collections to an existing v1 record without losing decisions", async () => {
    const store = new LocalRecordStore();
    await service.commitDecision(store, event("13131313-1313-4313-8313-131313131313"));
    const legacy = JSON.parse(localStorage.getItem("decision-lab.record.v1")!);
    delete legacy.learningRules;
    delete legacy.learningTransfers;
    delete legacy.learningTransferResults;
    localStorage.setItem("decision-lab.record.v1", JSON.stringify(legacy));

    expect(await new LocalRecordStore().countDecisions()).toBe(1);
    expect(await new LocalRecordStore().listLearningRules()).toEqual([]);
  });

  it("stays silent about claims until there are enough decisions, with a reason", async () => {
    const store = new LocalRecordStore();
    const view = await service.currentClaim(store, { created_at: "2026-01-01T00:00:00.000Z" });
    expect(view.claim).toBeNull();
    // Silence with a stated reason, not an empty screen.
    expect(view.reason).toBeTruthy();
    expect(view.recorded).toBe(0);
  });

  /*
   * Blocked storage used to end the loop.
   *
   * `write` was deliberately unguarded so a decision that was not stored could never be mistaken
   * for one that was. That was right about R2 and wrong about the product: in a private window,
   * behind a privacy extension, or under an enterprise policy, the commit threw, the reveal
   * never happened, and the application could not be used at all -- in a browser configuration
   * the player often cannot change.
   *
   * The rule it was protecting is kept, and moved: the decision IS stored, in memory, and the
   * store says out loud that it will not survive the tab. What must never happen is a
   * session-only record being indistinguishable from a persistent one -- so these two cases
   * assert the storing AND the label, together. Either one alone would be the bug.
   */
  it("keeps the decision in memory when localStorage refuses, and says the record is session-only", async () => {
    const store = new LocalRecordStore();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });

    await service.commitDecision(store, event("66666666-6666-4666-8666-666666666666"));
    // Kept: the loop can continue to the reveal, which is the whole point of the fallback.
    expect(await store.countDecisions()).toBe(1);
    await service.reveal(store, "66666666-6666-4666-8666-666666666666", RESULT);
    expect(await store.hasReveal("66666666-6666-4666-8666-666666666666")).toBe(true);

    // ...and labelled. A record that vanishes with the tab must not read like one that does not.
    expect(localRecordDurability()).toBe("session-only");
    expect(await store.isAvailable()).toBe(true);
    spy.mockRestore();
  });

  it("does not fall back to memory while localStorage still works", async () => {
    // The fallback is a downgrade, not a default: a working browser must still persist, or the
    // record would silently stop surviving reloads for everyone.
    const store = new LocalRecordStore();
    await service.commitDecision(store, event("77777777-7777-4777-8777-777777777777"));
    expect(localRecordDurability()).toBe("persistent");
    expect(localStorage.getItem("decision-lab.record.v1")).toContain(
      "77777777-7777-4777-8777-777777777777",
    );
  });

  it("carries the write that triggered the downgrade, and every write after it", async () => {
    // A quota that fills mid-session must not lose the decision that filled it.
    const store = new LocalRecordStore();
    await service.commitDecision(store, event("88888888-8888-4888-8888-888888888888"));
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    await service.commitDecision(store, event("99999999-9999-4999-8999-999999999999"));
    await service.commitDecision(store, event("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
    // The one already on disk plus both that only memory took.
    expect(await store.countDecisions()).toBe(3);
    spy.mockRestore();
  });
});

describe("choosing a backing", () => {
  it("reports a browser that cannot persist as session-only, not as having no store", async () => {
    const store = new LocalRecordStore();
    expect(await store.isAvailable()).toBe(true);
    expect(localRecordDurability()).toBe("persistent");

    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    // The client picks its WARNING from this, so it must go session-only before a decision is
    // taken -- the player is told what they are relying on before they rely on it.
    expect(localRecordDurability()).toBe("session-only");
    // ...and the store stays usable, because memory is a backing.
    expect(localRecordAvailable()).toBe(true);
    spy.mockRestore();
  });

  it("shares one memory record across store instances", async () => {
    // record-api.ts constructs a LocalRecordStore per hook. A per-instance fallback would give
    // each hook its own private record, so a committed decision would be invisible to the
    // reveal that follows it.
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    await service.commitDecision(
      new LocalRecordStore(),
      event("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    );
    expect(await new LocalRecordStore().countDecisions()).toBe(1);
    spy.mockRestore();
  });
});
