/**
 * A failed write returned the player's own sentence in the 500 body.
 *
 * WHAT WAS REPRODUCED, before a line of this was written. Drive a real commit at a real MariaDB
 * and make the statement fail. drizzle-orm raises `Failed query: insert into decisions (...)` and
 * APPENDS THE BOUND VALUES to the message; the error object also carries them on `params`.
 * `toTrpc` rethrows anything that is not a `RecordError`, there was no `errorFormatter`, and
 * tRPC's default shape puts `message` on the wire verbatim. Measured:
 *
 *   MESSAGE contains private: true
 *   PARAMS  contains private: true
 *   WIRE    contains private: true
 *
 * The value that comes back is `stated_unknown` -- the sentence a player writes about what they
 * did not understand, recorded before anybody tells them the answer. It is the single most
 * private thing this product holds, and the reason `ownerProcedure` exists at all.
 *
 * WHO SEES IT. Only the owner can reach these procedures, so this is not a cross-account leak. It
 * is worse in a different direction: a 500 body travels into browser devtools, into the platform's
 * function logs, and into anything sitting on the response path -- places the record was never
 * supposed to reach. The product's claim is that a record stays inside its deployment.
 *
 * AND IT IS THE SAME DEFECT TWICE. An adversarial review already found this shape once, on
 * `completeLearningTransfer`, and it was fixed THERE: "a 500 carrying the SQL and the player's
 * recall text". The class was called closed with one procedure fixed. It was live on every record
 * procedure that writes, which is the pattern that review named -- a test written for one
 * component, the thing that test could see fixed, and the class declared shut.
 */
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import { RecordError } from "@shared/record-service";
import {
  safeErrorMessage,
  describeForOperator,
  INTERNAL_ERROR_MESSAGE,
} from "../../server/_core/safe-error";

/** Exactly what drizzle-orm produces: the statement, then the values, then `params`. */
const driverError = (secret: string) =>
  Object.assign(
    new Error(
      "Failed query: insert into `decisions` (`decision_id`, `stated_read`, `stated_unknown`) " +
        `values (?, ?, ?)\nparams: 4f9c,${secret},${secret}`,
    ),
    {
      query: "insert into `decisions` (`decision_id`, `stated_read`, `stated_unknown`) values (?, ?, ?)",
      params: ["4f9c", secret, secret],
    },
  );

const SECRET = "לא הבנתי למה הרגל התקוע הזה חשוב ופחדתי להודות בזה";

describe("no driver error reaches the wire with a value in it", () => {
  it("replaces the message of an error the product did not author", () => {
    const message = safeErrorMessage(driverError(SECRET));
    expect(message, "the player's sentence came back in the error").not.toContain(SECRET);
    expect(message).toBe(INTERNAL_ERROR_MESSAGE);
  });

  it("strips it whatever shape the value arrives in", () => {
    /*
     * Asserted over the whole error rather than the message alone. `params` is a separate property
     * and a future formatter that serialised the error object -- or a `cause` chain that carried
     * it -- would put the same value back without touching the message at all.
     */
    for (const carrier of [
      driverError(SECRET),
      Object.assign(new Error("boom"), { params: [SECRET] }),
      Object.assign(new Error("boom"), { cause: new Error(`... ${SECRET} ...`) }),
      new Error(SECRET),
    ]) {
      expect(safeErrorMessage(carrier), JSON.stringify(Object.keys(carrier))).toBe(
        INTERNAL_ERROR_MESSAGE,
      );
    }
  });

  it("says something rather than nothing", () => {
    // A blank message is its own failure: the player is told the write failed and given no idea
    // whether to retry, and the operator gets a 500 with no name.
    expect(INTERNAL_ERROR_MESSAGE.length).toBeGreaterThan(10);
    expect(INTERNAL_ERROR_MESSAGE).not.toMatch(/[a-z]{4}/); // written for the player, in Hebrew
  });
});

describe("a rejected input names its fields and not its values", () => {
  /*
   * MEASURED FIRST: zod v4, as pinned here, does NOT echo a rejected value. Sending a bogus
   * `entry_state.phase` produces `Invalid option: expected one of "opening"|"middlegame"|"endgame"`
   * and the submitted string appears nowhere. So this is not closing a live leak.
   *
   * It is a CONTRACT, and it is worth having because two ordinary things would breach it without
   * anybody deciding to: a `.refine` whose message interpolates the value it rejected, and a zod
   * release that starts reporting `received`. One of the fields on this route is the sentence a
   * player wrote about what they did not understand.
   *
   * A control that replaced the paths with zod's own issue text SURVIVED the first version of
   * this file, because nothing asserted the difference. This is that assertion.
   */
  it("carries the path of a failing field", () => {
    const issue = new ZodError([
      { code: "custom", path: ["entry_state", "phase"], message: "bad" } as never,
    ]);
    expect(safeErrorMessage(issue)).toContain("entry_state.phase");
  });

  it("drops an issue message that interpolated the value it rejected", () => {
    const leaky = new ZodError([
      { code: "custom", path: ["unknown"], message: `לא חוקי: ${SECRET}` } as never,
    ]);
    const wire = safeErrorMessage(leaky);
    expect(wire, "a validation message put the value back on the wire").not.toContain(SECRET);
    expect(wire).toContain("unknown");
  });

  it("says a malformed request was malformed, not that the server failed", () => {
    /*
     * THE REGRESSION THIS FIX NEARLY INTRODUCED. A first version replaced every unauthored message
     * -- which included a `BAD_REQUEST` carrying a `ZodError` -- with the internal sentence, so a
     * client sending the wrong shape was told the server had broken. That is this file's own
     * defect pointed the other way, and the diagnostic that found the real leak caught it.
     */
    const issue = new ZodError([{ code: "custom", path: ["decision"], message: "bad" } as never]);
    expect(safeErrorMessage(issue)).not.toBe(INTERNAL_ERROR_MESSAGE);
  });
});

describe("the refusals the product wrote for the player survive", () => {
  it("keeps a RecordError's message, which is the whole point of RecordError", () => {
    /*
     * THE OTHER DIRECTION, and the one that makes this a filter rather than a gag. Every message
     * in `shared/record-service.ts` is written to be read: "this decision was already revealed",
     * "the rule's schedule has ended". Replacing those with a generic sentence would delete the
     * product's own explanations to close a leak in somebody else's.
     */
    const refusal = new RecordError("CONFLICT", "ההחלטה הזו כבר נחשפה.");
    expect(safeErrorMessage(refusal)).toBe("ההחלטה הזו כבר נחשפה.");
  });

  it("keeps a TRPCError's message, including the owner gate's two", () => {
    // `ownerProcedure` deliberately answers a refused visitor and an unconfigured deployment with
    // two different sentences. Those are authored text and must reach the screen.
    const forbidden = new TRPCError({ code: "FORBIDDEN", message: "הרשומה שייכת לחשבון אחר." });
    expect(safeErrorMessage(forbidden)).toBe("הרשומה שייכת לחשבון אחר.");
  });

  it("does not trust an authored message that happens to carry a value", () => {
    /*
     * A `RecordError` built by interpolating input would put the value back through the exemption.
     * Nothing does that today; this is the assertion that notices when something starts to.
     */
    const careless = new RecordError("BAD_REQUEST", `לא ניתן לשמור: ${SECRET}`);
    expect(safeErrorMessage(careless, [SECRET])).toBe(INTERNAL_ERROR_MESSAGE);
  });
});

describe("what the operator is left with", () => {
  it("keeps the statement shape, which carries no values", () => {
    /*
     * The parameterized SQL is what makes a 500 diagnosable, and it is safe by construction: the
     * values are `?`. Losing it entirely would trade a privacy defect for a blind one.
     */
    const error = driverError(SECRET);
    const detail = describeForOperator(error);
    expect(detail).toContain("insert into");
    expect(detail, "the operator log carries the values too").not.toContain(SECRET);
    expect(detail).not.toContain("params");
  });

  it("still names an error that has no query at all", () => {
    expect(describeForOperator(new TypeError("x is not a function"))).toContain("TypeError");
  });
});

describe("driven through the real HTTP stack, not reasoned about", () => {
  /*
   * THE ASSERTION THAT ACTUALLY COVERS THIS -- on its SECOND form, and the first is worth writing
   * down. It posted `{json:{}}` anonymously and asserted the body carried no value, and a control
   * that DELETED THE ERROR FORMATTER ENTIRELY passed it: `record.commitDecision` sits behind
   * `ownerProcedure`, so the request was refused at the gate and the store was never reached.
   * The driver error it claimed to be testing never fired.
   *
   * It is the same shape as the four before it -- an assertion satisfied by the fixture rather
   * than by the code -- and it is the shape this whole file exists to close, so it went into the
   * test as its own comment. This version signs a real session for the owner, sends a valid input,
   * and reaches the store.
   */
  const OWNER = "owner-open-id";
  process.env.JWT_SECRET = "test-secret-for-error-leak";
  process.env.OWNER_OPEN_ID = OWNER;

  /*
   * MATCHES `commitEventSchema` EXACTLY, and the first version did not -- it used a flat shape and
   * zod refused it with BAD_REQUEST before the gate or the store were reached. The vacuity guard
   * below is what surfaced that; without it three assertions would have been passing on a request
   * that never happened.
   */
  const VALID_COMMIT = {
    decision_id: "3f1c9a52-6d84-4b1e-9c77-2a0e5b8d4f31",
    entry_state: {
      game_id: "g-1",
      fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 4",
      ply: 7,
      phase: "opening",
      clock_ms_remaining: null,
    },
    known: "המרכז פתוח והמלך שלי עדיין באמצע",
    unknown: "לא הבנתי למה הרגל הזה תקוע",
    decision: "e8g8",
    bounded_action: {
      seconds_taken: 11,
      confidence: 4,
      confidence_scale: 7,
      candidate_moves_considered: [],
    },
    result: null,
    feedback: null,
  };

  const serve = async (fail: () => never) => {
    const { createApp } = await import("../../server/app");
    const { MemoryRecordStore } = await import("../../server/record");
    const { sdk } = await import("../../server/_core/sdk");
    const store = new MemoryRecordStore();
    store.commitDecision = async () => fail();
    const server = (await import("node:http")).createServer(createApp({ store }));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as { port: number };
    return {
      origin: `http://127.0.0.1:${port}`,
      token: await sdk.createSessionToken(OWNER, { name: "Owner" }),
      close: () => new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r()))),
    };
  };

  const post = (origin: string, token?: string) =>
    fetch(`${origin}/api/trpc/record.commitDecision`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ json: VALID_COMMIT }),
    });

  it("reaches the store at all, which the first version of this test did not", async () => {
    /*
     * THE VACUITY GUARD, and it is not decoration: without it every assertion below passes on a
     * request that was refused at the gate. The store must have been called.
     */
    let reached = false;
    const { origin, token, close } = await serve(() => {
      reached = true;
      throw driverError(SECRET);
    });
    try {
      await post(origin, token);
      expect(reached, "the request never got past the owner gate").toBe(true);
    } finally {
      await close();
    }
  });

  it("returns no value from a driver error, over the wire", async () => {
    const { origin, token, close } = await serve(() => {
      throw driverError(SECRET);
    });
    try {
      const body = await (await post(origin, token)).text();
      expect(body, "the player's sentence came back over HTTP").not.toContain(SECRET);
      expect(body, "the failing statement came back over HTTP").not.toContain("insert into");
      expect(body, "nothing replaced it either").toContain(INTERNAL_ERROR_MESSAGE.slice(0, 20));
    } finally {
      await close();
    }
  });

  it("still returns a refusal the product wrote, over the same wire", async () => {
    // The filter must not gag the product's own explanations; this is that, end to end.
    const { origin, token, close } = await serve(() => {
      throw new RecordError("CONFLICT", "ההחלטה הזו כבר נרשמה.");
    });
    try {
      const body = await (await post(origin, token)).text();
      expect(body).toContain("ההחלטה הזו כבר נרשמה.");
    } finally {
      await close();
    }
  });

  it("leaks nothing to a request that never gets past the gate", async () => {
    const { origin, close } = await serve(() => {
      throw driverError(SECRET);
    });
    try {
      const response = await post(origin);
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await response.text()).not.toContain(SECRET);
    } finally {
      await close();
    }
  });
});
