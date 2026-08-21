/**
 * GATE-DENOM positive control. This is defect 4, reintroduced verbatim:
 * one game renders as "100%" exactly the way three hundred render as "52%".
 */
const rate = (v: number, t: number) => (t ? `${Math.round((v / t) * 100)}%` : "—");

export function DenominatorlessRate() {
  return <span>לבן {rate(1, 1)}</span>;
}
