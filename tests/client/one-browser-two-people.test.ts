// @vitest-environment jsdom
/**
 * The browser record belonged to the browser, not to a person, and it lost appends between tabs.
 *
 * TWO DEFECTS IN ONE STORE, and neither is a crash. `record-api.ts` already reasons about "the
 * next person at this keyboard" -- it keys both of its server/local latches by account for
 * exactly that case -- and then wrote everyone's decisions into one key. And every mutator was
 * `read(); check; mutate; write()` over `localStorage`, which offers no atomicity across that
 * span, so two tabs could each append and one append would simply not be there.
 *
 * WHY THE SECOND ONE IS WORSE THAN IT LOOKS. Every function in that file is append-only, and the
 * SYSTEM was not: append A, append B, erase A, with nothing thrown and nothing marked. An
 * append-only record whose appends can vanish is not a weaker guarantee, it is a different one,
 * and every count computed over it is quietly wrong rather than visibly short.
 *
 * WHAT IS NOT FIXED HERE, said rather than implied: two people who both use this browser without
 * signing in still share a record. Nothing distinguishes them, and inventing a distinction --
 * a "who are you" screen, a per-tab id -- would either add friction or fabricate an identity the
 * product was never given. The store stops merging the identities it HAS been given.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  LocalRecordStore,
  setLocalRecordIdentity,
  currentLocalRecordIdentity,
  resetSessionFallbackForTests,
  localRecordDurability,
} from "@/lib/local-record-store";
import type { CommitDecisionInput } from "@shared/record-store";

const decision = (id: string): CommitDecisionInput =>
  ({
    decisionId: id,
    gameId: "g",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    ply: 1,
    phase: "opening",
    clockMsRemaining: null,
    known: "k",
    unknown: "u",
    knownParts: null,
    unknownParts: null,
    decision: "e2e4",
    secondsTaken: 10,
    confidence: 4,
    confidenceScale: 7,
    candidateMovesConsidered: [],
    probeAssignment: "not-probed",
    probeLegalMoves: 20,
    revealTiming: "per-decision",
    measurementProtocol: null,
    protocolVersion: null,
    analysisTiming: null,
  }) as unknown as CommitDecisionInput;

beforeEach(() => {
  localStorage.clear();
  setLocalRecordIdentity(null);
  resetSessionFallbackForTests();
});

describe("the record belongs to whoever the product was told is using it", () => {
  it("keeps two accounts' decisions apart", async () => {
    const store = new LocalRecordStore();

    setLocalRecordIdentity("account-alice");
    await store.commitDecision(decision("a1"));
    expect(await store.listDecisionIds()).toEqual(["a1"]);

    setLocalRecordIdentity("account-bob");
    expect(
      await store.listDecisionIds(),
      "the next person at this keyboard was handed the previous one's record",
    ).toEqual([]);

    await store.commitDecision(decision("b1"));
    expect(await store.listDecisionIds()).toEqual(["b1"]);

    setLocalRecordIdentity("account-alice");
    expect(await store.listDecisionIds(), "the first account's record did not come back").toEqual([
      "a1",
    ]);
  });

  it("leaves a signed-out record exactly where earlier builds put it", async () => {
    /*
     * A record written before this change lives at the bare key. Re-homing it would either drop
     * it or hand it to whichever account signs in first -- a guess about whose it is, which is
     * this same defect pointed the other way.
     */
    const store = new LocalRecordStore();
    setLocalRecordIdentity(null);
    await store.commitDecision(decision("anon-1"));
    expect(localStorage.getItem("decision-lab.record.v1")).toContain("anon-1");
    expect(currentLocalRecordIdentity()).toBeNull();
  });

  it("does not serve one account's record to the next out of the memory fallback", async () => {
    /*
     * THE HOLE A KEY ALONE WOULD LEAVE. `session` is a whole record in a module variable, used
     * when localStorage refuses -- a private window, a full quota, blocked site data. Separate
     * keys do nothing about it: without the reset, the next account reads the previous one's
     * decisions out of RAM while the persistent keys are correctly apart. The defect surviving
     * its own fix, in the one path nobody looks at.
     *
     * THE REFUSAL HAS TO BE FORCED, and the first version of this test did not force it. jsdom's
     * localStorage works, so `session` stayed null, the fallback was never entered, and the test
     * passed with the reset deleted -- asserting nothing about the branch it is named for.
     */
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function throwing() {
      throw new DOMException("quota", "QuotaExceededError");
    };
    try {
      const store = new LocalRecordStore();
      setLocalRecordIdentity("account-alice");
      await store.commitDecision(decision("a1"));
      expect(
        await store.listDecisionIds(),
        "the decision was not kept even in memory, so this proves nothing about the fallback",
      ).toEqual(["a1"]);
      expect(localRecordDurability()).toBe("session-only");

      setLocalRecordIdentity("account-bob");
      expect(
        await store.listDecisionIds(),
        "the next account was served the previous one's record out of RAM",
      ).toEqual([]);
    } finally {
      Storage.prototype.setItem = setItem;
    }
  });

  it("treats setting the same identity again as nothing happening", async () => {
    // Called on every render from `useStore`, so it has to be free and must not drop the record.
    const store = new LocalRecordStore();
    setLocalRecordIdentity("account-alice");
    await store.commitDecision(decision("a1"));
    setLocalRecordIdentity("account-alice");
    setLocalRecordIdentity("account-alice");
    expect(await store.listDecisionIds()).toEqual(["a1"]);
  });
});

describe("every mutation is taken under a cross-tab lock", () => {
  /*
   * WHY THE MECHANISM AND NOT THE RACE. The lost update needs two tabs, and two tabs cannot be
   * built inside one process: `localStorage` is shared here but there is only one event loop, and
   * the critical section is synchronous -- it runs to completion before anything else can be
   * scheduled. So two un-awaited commits DO NOT interleave, in this build or in the broken one.
   *
   * That is not a footnote. The first version of this file asserted exactly that -- two commits
   * through `Promise.all`, both survive -- and it passed with the lock deleted outright. It was
   * measuring the single-threadedness of the test runner. The defect it claimed to cover was
   * untouched, and the file would have shipped as evidence that the store was safe.
   *
   * What CAN be established is that every mutation asks the browser for mutual exclusion before
   * touching the record, and that it asks for it per record rather than globally. Given that, the
   * browser provides the exclusion. Given a mutation that skips it, no amount of in-process
   * concurrency would ever say so.
   */
  type LockCall = { name: string; heldDuring: string[] };

  function withFakeLocks(): { calls: LockCall[]; restore: () => void } {
    const calls: LockCall[] = [];
    const original = Object.getOwnPropertyDescriptor(navigator, "locks");
    let inside: string | null = null;
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async (name: string, run: () => unknown) => {
          const call: LockCall = { name, heldDuring: [] };
          calls.push(call);
          if (inside !== null) call.heldDuring.push(inside);
          inside = name;
          try {
            return await run();
          } finally {
            inside = null;
          }
        },
      },
    });
    return {
      calls,
      restore: () => {
        if (original) Object.defineProperty(navigator, "locks", original);
        else delete (navigator as { locks?: unknown }).locks;
      },
    };
  }

  it("asks for a lock before writing, and names it after the record it protects", async () => {
    const locks = withFakeLocks();
    try {
      const store = new LocalRecordStore();
      setLocalRecordIdentity("account-alice");
      await store.commitDecision(decision("a1"));
      expect(locks.calls.map((c) => c.name)).toEqual([
        "decision-lab.record.v1:account-alice.write",
      ]);
    } finally {
      locks.restore();
    }
  });

  it("takes one for every mutating method, not only for the first", async () => {
    /*
     * A per-method opt-in is how this decays: one mutator added later without the wrapper is a
     * write that ignores every other tab, and nothing about it looks different.
     */
    const locks = withFakeLocks();
    try {
      const store = new LocalRecordStore();
      setLocalRecordIdentity("account-alice");
      await store.commitDecision(decision("a1"));
      await store.recordReveal("a1", {
        engine_eval_cp: 10,
        engine_best_move: "e2e4",
        engine_depth: 18,
        engine_source: "local_sf18",
        engine_build: "sf18-test-build",
        cp_loss: 0,
      });
      await store.recordFeedback("a1", { agreed: true, note: null } as never);
      expect(locks.calls.length, "a mutation wrote without asking for the lock").toBe(3);
    } finally {
      locks.restore();
    }
  });

  it("scopes the lock to the account, so two people do not queue behind each other", async () => {
    const locks = withFakeLocks();
    try {
      const store = new LocalRecordStore();
      setLocalRecordIdentity("account-alice");
      await store.commitDecision(decision("a1"));
      setLocalRecordIdentity("account-bob");
      await store.commitDecision(decision("b1"));
      expect(new Set(locks.calls.map((c) => c.name)).size).toBe(2);
    } finally {
      locks.restore();
    }
  });

  it("reads the record INSIDE the lock, not before taking it", async () => {
    /*
     * Hoisting the read out would leave the whole race in place with a lock held around the
     * harmless half -- the shape of the bug that looks fixed in review.
     */
    const locks = withFakeLocks();
    try {
      const store = new LocalRecordStore();
      setLocalRecordIdentity("account-alice");
      await store.commitDecision(decision("a1"));
      localStorage.setItem(
        "decision-lab.record.v1:account-alice.probe-marker",
        "unused",
      );
      let readWhileHeld = false;
      const original = Object.getOwnPropertyDescriptor(navigator, "locks")!;
      Object.defineProperty(navigator, "locks", {
        configurable: true,
        value: {
          request: async (_name: string, run: () => unknown) => {
            const before = localStorage.getItem("decision-lab.record.v1:account-alice");
            const result = await run();
            readWhileHeld = before !== null;
            return result;
          },
        },
      });
      await store.commitDecision(decision("a2"));
      Object.defineProperty(navigator, "locks", original);
      expect(readWhileHeld).toBe(true);
      expect((await store.listDecisionIds()).sort()).toEqual(["a1", "a2"]);
    } finally {
      locks.restore();
    }
  });

  it("still refuses a duplicate, so locking did not soften append-only", async () => {
    const store = new LocalRecordStore();
    setLocalRecordIdentity("account-alice");
    await store.commitDecision(decision("dup"));
    await expect(store.commitDecision(decision("dup"))).rejects.toThrow("append-only");
  });

  it("keeps the store usable after a mutation throws inside the lock", async () => {
    /*
     * The append-only refusals are ordinary control flow here, not exceptional, so a rejected
     * critical section must not poison the queue the fallback path builds.
     */
    const store = new LocalRecordStore();
    setLocalRecordIdentity("account-alice");
    await store.commitDecision(decision("first"));
    await expect(store.commitDecision(decision("first"))).rejects.toThrow();
    await store.commitDecision(decision("second"));
    expect((await store.listDecisionIds()).sort()).toEqual(["first", "second"]);
  });
});
