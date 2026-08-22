// @vitest-environment jsdom
/**
 * The context layer.
 *
 * The load-bearing test in this file is the last one. Everything else here is ordinary
 * behaviour; that one pins the constraint the whole module exists under -- that nothing the
 * detector measures is allowed to change what the interface does, because an interface that
 * reacts to time-to-decide puts itself inside the measurement of time-to-decide.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  RETURN_GAP_DAYS,
  contextSignals,
  daysSince,
  derivePresentation,
  deviceFromWidth,
  persistUsage,
  readUsage,
  type UsageContext,
} from "@/lib/context-engine";

const NOW = new Date("2026-08-22T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const usage = (overrides: Partial<UsageContext> = {}): UsageContext => ({
  sessionStartedAt: NOW.toISOString(),
  visitCount: 2,
  device: "desktop",
  input: "pointer",
  ...overrides,
});

beforeEach(() => localStorage.clear());

describe("the visit is counted, and survives nothing else", () => {
  it("starts at one with no history", () => {
    expect(readUsage(NOW).visitCount).toBe(1);
    expect(readUsage(NOW).lastVisitAt).toBeUndefined();
  });

  it("counts up and remembers only a timestamp and a count", () => {
    persistUsage(usage({ visitCount: 1 }), NOW);
    const stored = JSON.parse(localStorage.getItem("decision-lab-usage-v1")!);
    expect(Object.keys(stored).sort()).toEqual(["lastVisitAt", "visitCount"]);
    expect(readUsage(NOW).visitCount).toBe(2);
  });

  it("treats unparseable storage as a first visit rather than throwing", () => {
    localStorage.setItem("decision-lab-usage-v1", "{not json");
    expect(() => readUsage(NOW)).not.toThrow();
    expect(readUsage(NOW).visitCount).toBe(1);
  });
});

describe("device and gap", () => {
  it("classifies by width at the breakpoints the stylesheet uses", () => {
    expect(deviceFromWidth(390)).toBe("phone");
    expect(deviceFromWidth(679)).toBe("phone");
    expect(deviceFromWidth(680)).toBe("tablet");
    expect(deviceFromWidth(1050)).toBe("desktop");
  });

  it("reads a gap in whole days, and nothing from a bad timestamp", () => {
    expect(daysSince(daysAgo(6), NOW)).toBe(6);
    expect(daysSince("not a date", NOW)).toBeNull();
    expect(daysSince(undefined, NOW)).toBeNull();
  });
});

describe("coming back", () => {
  const record = { recorded: 23, awaitingReveal: 4 };

  it("says nothing on an ordinary next sitting", () => {
    const at = derivePresentation(usage({ lastVisitAt: daysAgo(1) }), record, NOW);
    expect(at.reorientation).toBeNull();
  });

  it("says nothing on a first visit", () => {
    expect(
      derivePresentation(usage({ lastVisitAt: undefined }), record, NOW).reorientation,
    ).toBeNull();
  });

  it("says nothing when there is no record to come back to", () => {
    // Re-orienting someone to an empty record is noise dressed as continuity.
    const at = derivePresentation(usage({ lastVisitAt: daysAgo(30) }), null, NOW);
    expect(at.reorientation).toBeNull();
  });

  it("re-orients after a real gap, with counts and nothing else", () => {
    const at = derivePresentation(usage({ lastVisitAt: daysAgo(6) }), record, NOW);
    expect(at.reorientation).toContain("6");
    expect(at.reorientation).toContain("23");
    expect(at.reorientation).toContain("4");
  });

  it("drops the awaiting-reveal clause when nothing is waiting", () => {
    const at = derivePresentation(
      usage({ lastVisitAt: daysAgo(6) }),
      { recorded: 23, awaitingReveal: 0 },
      NOW,
    );
    expect(at.reorientation).not.toContain("ממתינות");
  });

  it("holds the threshold", () => {
    const below = derivePresentation(
      usage({ lastVisitAt: daysAgo(RETURN_GAP_DAYS - 1) }),
      record,
      NOW,
    );
    const at = derivePresentation(usage({ lastVisitAt: daysAgo(RETURN_GAP_DAYS) }), record, NOW);
    expect(below.reorientation).toBeNull();
    expect(at.reorientation).not.toBeNull();
  });
});

describe("every adaptation can say why", () => {
  it("carries a fact for each signal it acted on", () => {
    const at = derivePresentation(
      usage({ lastVisitAt: daysAgo(9), input: "touch", device: "phone" }),
      { recorded: 5, awaitingReveal: 0 },
      NOW,
    );
    expect(at.why.length).toBeGreaterThan(0);
    for (const fact of at.why) expect(fact.trim()).not.toBe("");
  });

  it("reports touch as an observation about the device, not about the player", () => {
    const [signal] = contextSignals(usage({ input: "touch" }), NOW).filter(
      (s) => s.id === "touch-input",
    );
    expect(signal.strength).toBe("weak");
    expect(signal.fact).toContain("מכשיר");
  });
});

/**
 * THE CONSTRAINT. `shared/detector.ts` buckets on time-to-decide, phase and clock. If the
 * interface adapted on any of those, the intervention would be inside the measurement: the
 * "under 45 seconds" bucket would stop being a fact about the player.
 *
 * Asserted against the source rather than against behaviour, because the failure this guards is
 * someone adding a signal later, and a behavioural test only sees the signals that exist today.
 */
describe("the layer cannot see what the detector measures", () => {
  const source = readFileSync(resolve(__dirname, "../../client/src/lib/context-engine.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("reads no decision, no timing, and no confidence", () => {
    for (const forbidden of [
      "seconds_taken",
      "secondsTaken",
      "confidence",
      "clock_ms_remaining",
      "clockMs",
      "cpLoss",
      "centipawn",
      "phase",
      "DecisionAtom",
      "detector",
    ]) {
      expect(source, `the context layer reached for "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("takes only counts from the record, never a decision", () => {
    // RecordShape is the entire surface: two numbers, both already on screen elsewhere.
    const shape = source.match(/interface RecordShape \{([\s\S]*?)\}/)?.[1] ?? "";
    expect(shape).toBeTruthy();
    const fields = [...shape.matchAll(/(\w+)\s*:/g)].map((m) => m[1]).sort();
    expect(fields).toEqual(["awaitingReveal", "recorded"]);
  });
});
