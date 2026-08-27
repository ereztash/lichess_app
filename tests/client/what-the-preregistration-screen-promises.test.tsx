// @vitest-environment jsdom
/**
 * Three things the pre-registration bridge said that were not true.
 *
 * This screen asks for consent to a change in how the player will be measured, so what it says
 * about that change is the whole of it. All three came out of one execution-backed sweep, and all
 * three are in the same fifty lines.
 *
 * 1. IT SAID, IN BOLD, THAT IT WOULD NOT LOWER THE GAP THRESHOLD. It lowers it. Registering swaps
 *    `SEPARABILITY_K` (3.75) for `PREREGISTERED_SEPARABILITY_K` (3.25). The comment above that
 *    paragraph read "the n comes from the constants so this sentence cannot drift from the
 *    detector" — the drift-proofing had been applied to the half that did not need it, and the k
 *    sat beside it as typed prose. The lower bar is deliberate and measured; the denial was not.
 *
 * 2. IT PRINTED TWO STANDARD ERRORS UNDER THE WORD FOR ONE. `worstBucketVerdict` computes
 *    `threshold = 2 * Math.sqrt(variance + variance)`, and `shared/prereg.ts`'s own doc says the
 *    bar is "two standard errors of the difference". The screen labelled it טעות הדגימה.
 *
 * 3. WITH ONE READABLE BUCKET IT COMPARED AGAINST A BUCKET THAT DOES NOT EXIST. `worstBucketVerdict`
 *    returns `separation: 0, threshold: 0` as SENTINELS in that case — its own comment says "one
 *    readable bucket is a rate, not a comparison" — and those zeros fell through to the
 *    `not-separable` branch, which renders them: "the difference is 0 percentage points, and their
 *    sampling error is 0", beside a panel showing exactly one bucket.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The bridge calls useRegisterHypothesis(); nothing here presses the button, so the mutation is a
// stub. What is under test is the prose the screen shows before anyone consents to anything.
vi.mock("@/lib/record-api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useRegisterHypothesis: () => ({ mutateAsync: async () => undefined, isPending: false }),
}));
import {
  MIN_BUCKET_N,
  PREREGISTERED_SEPARABILITY_K,
  SEPARABILITY_K,
} from "@shared/detector";
import { hypothesisFromImport } from "@shared/prereg";
import type { ImportDiagnostic } from "@shared/import-diagnostic";
import { PreregisterBridge } from "@/components/PreregisterBridge";

const bucket = (key: string, scope: string, accurateRate: number) => ({
  key,
  scope,
  n: MIN_BUCKET_N * 3,
  accurateRate,
  measurable: true,
  unmeasurableReason: null,
});

const diagnostic = (buckets: ReturnType<typeof bucket>[]): ImportDiagnostic => ({
  buckets,
  scored: MIN_BUCKET_N * 9,
  forced: 0,
  missingClockData: false,
  timeBucketSpeed: null,
  excludedForSpeed: 0,
  speedMix: [],
});

/** Two buckets far enough apart that the worst one is registrable. */
const SEPARABLE = diagnostic([
  bucket("phase-endgame", "החלטות בסיום", 0.35),
  bucket("phase-middlegame", "החלטות באמצע המשחק", 0.85),
]);
/** Two buckets that are not far enough apart. */
const TOO_CLOSE = diagnostic([
  bucket("phase-endgame", "החלטות בסיום", 0.60),
  bucket("phase-middlegame", "החלטות באמצע המשחק", 0.62),
]);
/** Exactly one readable bucket: there is nothing for it to be worse than. */
const ONE_ONLY = diagnostic([bucket("phase-endgame", "החלטות בסיום", 0.35)]);

const show = (d: ImportDiagnostic) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PreregisterBridge diagnostic={d} games={12} />
    </QueryClientProvider>,
  );

describe("what registering actually changes", () => {
  it("says the gap threshold drops, and names both constants", () => {
    show(SEPARABLE);
    const text = document.body.textContent ?? "";
    expect(text).toContain(String(SEPARABILITY_K));
    expect(text).toContain(String(PREREGISTERED_SEPARABILITY_K));
  });

  it("does not claim the gap threshold is left alone", () => {
    // The exact denial that shipped. It is the opposite of what the code does.
    show(SEPARABLE);
    expect(document.body.textContent ?? "").not.toContain("לא</em> יוריד את הסף");
    expect(document.body.textContent ?? "").not.toMatch(/לא\s*יוריד את הסף של הפער/);
  });

  it("the constants it names are the ones the detector uses", () => {
    // Guards the fix against the two numbers being typed rather than derived.
    expect(PREREGISTERED_SEPARABILITY_K).toBeLessThan(SEPARABILITY_K);
  });
});

describe("the bar is two standard errors, and says so", () => {
  it("names two standard errors rather than 'the sampling error'", () => {
    show(TOO_CLOSE);
    expect(document.body.textContent ?? "").toContain("שתי שגיאות תקן");
  });

  it("says it on the offer too, not only on the refusal", () => {
    show(SEPARABLE);
    expect(document.body.textContent ?? "").toContain("שתי שגיאות תקן");
  });
});

describe("one readable bucket is a rate, not a comparison", () => {
  it("is its own outcome rather than a separation of zero", () => {
    const outcome = hypothesisFromImport(ONE_ONLY, {
      registered_at: "2026-01-01T00:00:00.000Z",
      decisions_before: 0,
      games: 12,
    });
    expect(outcome.kind).toBe("only-one-readable");
  });

  it("does not print a comparison against a bucket that does not exist", () => {
    show(ONE_ONLY);
    const text = document.body.textContent ?? "";
    // The sentinel zeros the old branch rendered as measurements.
    expect(text, "printed a separation of 0 as a measurement").not.toMatch(/0 נקודות אחוז/);
    expect(text).toContain("רק דלי אחד");
  });

  it("still says why registering is not possible, rather than going blank", () => {
    // Silence with a stated reason, not an empty screen — the standard this codebase holds
    // every other refusal to.
    show(ONE_ONLY);
    expect(screen.getByText(/שני דליים קריאים לפחות/)).toBeTruthy();
  });
});
