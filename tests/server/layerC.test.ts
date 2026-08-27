/**
 * Layer C (section 3.4). The part most likely to produce fluent nonsense, so the tests are
 * mostly about what it must NOT do.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_POSITIONS_CONSULTED, layerCEnabled, pointerForClaim } from "../../server/layerC";
import { formHypothesis } from "../../shared/claim";

const claim = formHypothesis({
  claim_id: "c1",
  statement: "בהחלטות מהירות הביטחון גבוה מהתוצאות.",
  scope: "החלטות תחת פחות מ-45 שניות",
  evidence: { kind: "retrospective", decision_ids: ["d1", "d2"] },
  refutation_condition: "אם הפער בדריל לא יהיה גדול יותר — הופרך.",
  predicts_overconfidence: true,
  created_at: "2026-08-21T00:00:00Z",
});
const FENS = [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 3",
  "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4",
];

afterEach(() => {
  delete process.env.LAYER_C_ENABLED;
  vi.unstubAllGlobals();
});

describe("Layer C is disabled by default", () => {
  it("reports disabled rather than empty when the flag is unset", async () => {
    const result = await pointerForClaim({ claim, fens: FENS });
    expect(result.kind).toBe("disabled");
  });

  it("distinguishes disabled from found-nothing", async () => {
    const result = await pointerForClaim({ claim, fens: FENS });
    if (result.kind !== "disabled") throw new Error("expected disabled");
    expect(result.reason).toContain("כבויה");
  });

  it("does not touch the network while disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await pointerForClaim({ claim, fens: FENS });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("layerCEnabled only accepts the exact string 'true'", () => {
    for (const value of ["1", "yes", "TRUE", "", "false"]) {
      process.env.LAYER_C_ENABLED = value;
      expect(layerCEnabled(), `"${value}" should not enable Layer C`).toBe(false);
    }
    process.env.LAYER_C_ENABLED = "true";
    expect(layerCEnabled()).toBe(true);
  });
});

describe("when enabled, it points and cannot promote", () => {
  beforeEach(() => {
    process.env.LAYER_C_ENABLED = "true";
    process.env.LICHESS_API_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes("explorer")
            ? new Response('{"white":120,"draws":40,"black":90,"moves":[]}')
            : new Response(JSON.stringify({ depth: 38, pvs: [] })),
        ),
      ),
    );
  });

  it("returns a pointer whose promotes_grade is false", async () => {
    const result = await pointerForClaim({ claim, fens: FENS });
    expect(result.kind).toBe("pointer");
    if (result.kind !== "pointer") throw new Error("expected pointer");
    expect(result.promotes_grade).toBe(false);
  });

  it("carries every source with its n or its depth, never a bare figure", async () => {
    const result = await pointerForClaim({ claim, fens: FENS });
    if (result.kind !== "pointer") throw new Error("expected pointer");
    expect(result.sources.length).toBeGreaterThan(0);
    for (const source of result.sources) {
      expect(source.origin).toBeTruthy();
      expect(source.n !== undefined || source.depth !== undefined).toBe(true);
    }
  });

  it("bounds how many positions it consults", async () => {
    const result = await pointerForClaim({ claim, fens: FENS });
    if (result.kind !== "pointer") throw new Error("expected pointer");
    const masters = result.sources.filter((s) => s.origin.startsWith("lichess-masters"));
    expect(masters.length).toBeLessThanOrEqual(MAX_POSITIONS_CONSULTED);
  });

  it("suggests a drill that carries the claim's refutation condition", async () => {
    const result = await pointerForClaim({ claim, fens: FENS });
    if (result.kind !== "pointer") throw new Error("expected pointer");
    expect(result.suggested_drill?.refutation_condition).toBe(claim.refutation_condition);
  });

  it("asks a question and says explicitly that it is not evidence", async () => {
    const result = await pointerForClaim({ claim, fens: FENS });
    if (result.kind !== "pointer") throw new Error("expected pointer");
    expect(result.suggested_next_question).toContain("לא משנה את דרגת הטענה");
  });

  it("omits a source it could not consult rather than reporting it as zero", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network down"))));
    const result = await pointerForClaim({ claim, fens: FENS });
    if (result.kind !== "pointer") throw new Error("expected pointer");
    // "no master games here" and "we could not ask" are different facts.
    expect(result.sources).toHaveLength(0);
  });
});
