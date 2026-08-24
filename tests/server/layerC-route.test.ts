/**
 * LAYER C, REACHABLE.
 *
 * `server/layerC.ts` and its unit tests have existed since early on, and no router ever imported
 * it. Nothing deployed could call it at any price: the "external, and not self-graded" layer that
 * docs/MEASUREMENTS.md describes was, in the running product, absent. Its own tests passed the
 * whole time, because a module's tests say nothing about whether anything can reach it.
 *
 * So these tests go over real HTTP, like claim-route.test.ts. A unit test of `pointerForClaim`
 * would have been green before this route existed, which makes it the wrong instrument for the
 * one thing that was actually broken.
 */
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const OWNER = "owner-open-id";
process.env.JWT_SECRET = "test-secret-for-layerc-route";
process.env.OWNER_OPEN_ID = OWNER;

const { createApp } = await import("../../server/app");
const { MemoryRecordStore } = await import("../../server/record");
const { sdk } = await import("../../server/_core/sdk");

let server: Server;
let origin: string;
let token: string;
const store = new MemoryRecordStore();

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

beforeAll(async () => {
  token = await sdk.createSessionToken(OWNER, { name: "Owner" });
  const app = createApp({ store });
  await new Promise<void>((done) => {
    server = app.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (!server) return;
  await new Promise<void>((done, fail) => server.close((e) => (e ? fail(e) : done())));
});

async function pointer(claimId: string, fens: string[]) {
  const input = encodeURIComponent(JSON.stringify({ json: { claimId, fens } }));
  const response = await fetch(`${origin}/api/trpc/external.pointer?input=${input}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return {
    status: response.status,
    body: (await response.json()) as {
      result?: { data: { json: Record<string, unknown> } };
      error?: { json: { message: string } };
    },
  };
}

describe("the external pointer is reachable at all", () => {
  it("answers on a mounted route rather than 404ing", async () => {
    /*
     * THE ACTUAL DEFECT. Before the route existed this returned a tRPC "No procedure found"
     * error, which is what "the layer is not mounted" looks like from outside. The assertion is
     * deliberately about the absence of that error rather than about the payload: what was broken
     * was reachability, and a test that only checked the payload would have to reach it first.
     */
    const { body } = await pointer("claim-anything", [FEN]);
    expect(
      body.error?.json.message ?? "",
      "external.pointer is not mounted on the router",
    ).not.toMatch(/No procedure found|NOT_FOUND.*external/i);
  });

  it("reports DISABLED with a reason, which is not the same as missing", async () => {
    /*
     * LAYER_C_ENABLED is unset here, as it is in every deployment. Section 3.4: layers A and B
     * are a complete product without this, and it earns its way in with measurements rather than
     * with a demo.
     *
     * Mounting it does not turn it on. What mounting changes is that "off" is now observable --
     * a caller gets `kind: "disabled"` and a sentence saying so, instead of an error that is
     * indistinguishable from a feature nobody built. That distinction is the same one R2 is about.
     */
    expect(process.env.LAYER_C_ENABLED).not.toBe("true");
    const { body } = await pointer("claim-anything", [FEN]);
    const data = body.result?.data.json;
    expect(data?.kind).toBe("disabled");
    expect(String(data?.reason)).toContain("כבויה");
  });

  it("cannot promote a grade, and says so in the payload it returns", async () => {
    // ExternalPointer.promotes_grade is the literal type `false`, and GATE-EXTERNAL proves it by
    // compiling a file that attempts the promotion and requiring the compile to fail. This is the
    // runtime half: whatever crosses the wire carries the same refusal.
    process.env.LAYER_C_ENABLED = "true";
    try {
      await store.saveClaim({
        claim_id: "claim-fast-under-45s",
        grade: "hypothesis",
        scope: "החלטות תחת פחות מ-45 שניות",
        statement: "s",
        refutation_condition: "r",
        evidence: {
          kind: "retrospective",
          n: 40,
          mean_confidence: 0.8,
          accuracy_rate: 0.4,
          gap: 0.4,
          outside_gap: 0.05,
        },
        created_at: "2026-08-24T10:00:00.000Z",
        prospective_results: [],
      } as never);

      const { body } = await pointer("claim-fast-under-45s", []);
      const data = body.result?.data.json;
      // No FENs were supplied, so no source could be consulted and no drill could be built. It
      // still must not report zero sources as though it had asked and found nothing (R2).
      expect(data?.kind).toBe("pointer");
      expect(data?.promotes_grade).toBe(false);
      expect(data?.suggested_drill).toBeNull();
    } finally {
      delete process.env.LAYER_C_ENABLED;
    }
  });

  it("refuses a claim id that is not in the record", async () => {
    process.env.LAYER_C_ENABLED = "true";
    try {
      const { status, body } = await pointer("claim-that-does-not-exist", [FEN]);
      expect(status).toBeGreaterThanOrEqual(400);
      expect(String(body.error?.json.message)).toContain("אין טענה");
    } finally {
      delete process.env.LAYER_C_ENABLED;
    }
  });
});
