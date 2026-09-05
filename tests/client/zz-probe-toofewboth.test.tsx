// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WhatIsUnclear } from "@/components/WhatIsUnclear";
import { whatIsUnclear, groupUnclear } from "@shared/record-order";
import { metacognitiveSensitivity } from "@shared/sensitivity";
import type { RecordReading } from "@shared/record-dashboard";

const summary = (n: number) => ({ n, meanConfidence: 0.6, accuracyRate: 0.5, gap: 0.1, gapVariance: 0.2 });
const bucket = (over: any = {}) => ({
  key: "fast-under-45s", scope: "s", inside: summary(40), outside: summary(40),
  measurable: true, versusPopulation: { points: 3, standardError: 1, separated: true },
  shortBy: 0, unmeasurableReason: null, ...over,
}) as any;
const reading = (over: Partial<RecordReading> = {}): RecordReading => ({
  overall: summary(20),
  counterfactual: { probed: { accurate: 0, n: 0 }, "not-probed": { accurate: 0, n: 0 } },
  profile: { variables: [], crossing: [] }, calibration: {}, anchor: {}, anchorAnswered: [],
  stability: { n: [40, 40], gap: [0.1, 0.1], difference: 0, standardError: 0.1, z: 0, readable: true },
  sensitivity: { n: 20, split: [10, 10], auroc2: 0.6, curve: [], standardError: 0.1, reason: "ok", readable: true },
  sensitivityReference: null,
  control: { n: 80, rho: 0.2, standardError: 0.1, reason: "ok", readable: true },
  buckets: [bucket()], confidence: [], scored: 20, awaitingReveal: 0, withoutConfidence: 0,
  ...over,
}) as unknown as RecordReading;

describe("probe", () => {
  it("too-few-both fan-out", () => {
    const r = reading({ sensitivity: { ...reading().sensitivity, reason: "too-few-both" } as never });
    const items = whatIsUnclear(r);
    console.log("ITEMS:", JSON.stringify(items, null, 1));
    const groups = groupUnclear(items);
    console.log("GROUPS:", JSON.stringify(groups.map(g => ({ because: g.because, sentence: g.sentence, n: g.items.length, whats: g.items.map(i=>i.what) })), null, 1));
    const { container } = render(<WhatIsUnclear items={items} />);
    console.log("TEXT:\n" + (container.textContent ?? ""));
  });
  it("real sensitivity function at 10/10", () => {
    const decisions = [] as any[];
    for (let i = 0; i < 10; i++) decisions.push({ accurate: true, confidence: 0.8 });
    for (let i = 0; i < 10; i++) decisions.push({ accurate: false, confidence: 0.4 });
    const s = metacognitiveSensitivity(decisions as any);
    console.log("REASON:", s.reason, "split", s.split, "n", s.n);
  });
});
