/**
 * EVERY DISPLAYED VALUE IS A TRIPLE (section 4.4): { value, source, n | depth }.
 *
 * There is no code path through this module that renders a number without its provenance. The
 * `provenance` prop is required and has no default, so a bare number is a type error rather than
 * a style lapse. R1 and R2 are enforced here, at the pixel.
 *
 * This replaces three things the old interface did:
 *   - a fabricated +0.42 at depth 14 rendered identically to a real evaluation (defect 1)
 *   - `rate(v, t)` rendering "100%" from one game exactly as "52%" from three hundred (defect 4)
 *   - an evaluation surviving on screen against a position it was not computed for (defect 2)
 */
import type { ReactNode } from "react";

export type ClaimGrade = "hypothesis" | "replicated" | "refuted";

/**
 * Where a displayed number came from. There is no `unknown` variant on purpose: a value whose
 * origin cannot be named is a value that must not be rendered.
 */
export type Provenance =
  | { kind: "engine"; source: "local_sf18" | "lichess_cloud"; depth: number; stale?: boolean }
  | { kind: "sample"; n: number }
  | { kind: "claim"; n: number; grade: ClaimGrade }
  | { kind: "player"; unit: string };

const SOURCE_LABEL: Record<"local_sf18" | "lichess_cloud", string> = {
  local_sf18: "Stockfish 18 מקומי",
  lichess_cloud: "ענן Lichess",
};

const GRADE_LABEL: Record<ClaimGrade, string> = {
  hypothesis: "השערה",
  replicated: "שוחזר",
  refuted: "הופרך",
};

export function provenanceLabel(provenance: Provenance): string {
  switch (provenance.kind) {
    case "engine":
      return `${SOURCE_LABEL[provenance.source]} · עומק ${provenance.depth}`;
    case "sample":
      return `n=${provenance.n}`;
    case "claim":
      return `${GRADE_LABEL[provenance.grade]} · n=${provenance.n}`;
    case "player":
      return provenance.unit;
  }
}

interface ValueProps {
  children: ReactNode;
  provenance: Provenance;
  label?: string;
}

/** A value and the measurement that produced it, never one without the other. */
export function Value({ children, provenance, label }: ValueProps) {
  const stale = provenance.kind === "engine" && provenance.stale === true;
  return (
    <span
      className={`value-triple${stale ? " value-stale" : ""}`}
      data-provenance={provenance.kind}
    >
      {label && <span className="value-label">{label}</span>}
      <span className="value-number">{children}</span>
      <span className="value-provenance">
        {stale && <b className="value-stale-flag">לא מעודכן · </b>}
        {provenanceLabel(provenance)}
      </span>
    </span>
  );
}

/**
 * A proportion. Renders its denominator, always (R1, GATE-DENOM).
 *
 * `rate(1, 1)` and `rate(156, 300)` used to both render as a bare percentage. Here the first
 * reads "100% (1/1)" and the second "52% (156/300)", and the difference is visible without
 * reading the code.
 */
export function Rate({ value, of, label }: { value: number; of: number; label?: string }) {
  if (of <= 0) {
    return (
      <span className="value-triple value-empty" data-provenance="sample">
        {label && <span className="value-label">{label}</span>}
        <span className="value-number">—</span>
        <span className="value-provenance">אין נתונים</span>
      </span>
    );
  }
  return (
    <Value label={label} provenance={{ kind: "sample", n: of }}>
      {Math.round((value / of) * 100)}%{" "}
      <small className="value-fraction">
        ({value}/{of})
      </small>
    </Value>
  );
}

/**
 * An explicit absence. Section 4.5: empty and blocked are valid states, not failures.
 * Rendering this is always preferable to rendering a number that was not measured.
 */
export function NotMeasured({ reason }: { reason: string }) {
  return (
    <span className="value-triple value-empty" data-provenance="none">
      <span className="value-number">—</span>
      <span className="value-provenance">{reason}</span>
    </span>
  );
}

/**
 * A proportion that is an AVERAGE, not a count over a count.
 *
 * Mean stated confidence is 0..1 measured over n decisions, but it is not "k of n" -- rendering
 * it through Rate would invent a numerator. It still may not appear without its n, so it lives
 * here with the other formatters rather than being hand-rolled at the call site: this module is
 * the one place GATE-DENOM permits a percentage, and that is only useful if it stays the one place.
 */
export function Proportion({ value, n, label }: { value: number; n: number; label?: string }) {
  if (n <= 0) {
    return (
      <span className="value-triple value-empty" data-provenance="sample">
        {label && <span className="value-label">{label}</span>}
        <span className="value-number">—</span>
        <span className="value-provenance">אין נתונים</span>
      </span>
    );
  }
  return (
    <Value label={label} provenance={{ kind: "sample", n }}>
      {Math.round(value * 100)}%
    </Value>
  );
}

/**
 * A signed difference between two proportions -- a calibration gap.
 *
 * Carries its sign because the direction is the finding: +18% is overconfidence and -18% is the
 * opposite, and a bare "18%" says neither.
 */
export function SignedProportion({
  value,
  n,
  label,
}: {
  value: number;
  n: number;
  label?: string;
}) {
  if (n <= 0) {
    return (
      <span className="value-triple value-empty" data-provenance="sample">
        {label && <span className="value-label">{label}</span>}
        <span className="value-number">—</span>
        <span className="value-provenance">אין נתונים</span>
      </span>
    );
  }
  return (
    <Value label={label} provenance={{ kind: "sample", n }}>
      {value > 0 ? "+" : ""}
      {Math.round(value * 100)}%
    </Value>
  );
}
