/**
 * GATE-NO-FAKE positive control. This is defect 1, reintroduced verbatim.
 *
 * Never imported by product code. The gate runner scans this directory only in
 * --positive-controls mode; the gate must go RED on it.
 */
export const FALLBACK = {
  scoreCp: 42,
  depth: 14,
  pv: ["d2d4", "e5d4", "f3d4"],
  bestMove: "d2d4",
};

export function FakeEvalPanel() {
  return <strong>{FALLBACK.scoreCp / 100}</strong>;
}
