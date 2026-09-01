/**
 * Owner-only art-direction experiment.
 *
 * This deliberately changes no product state, wording, layout, spacing, measurement logic or
 * interaction contract. It only exposes four visual treatments behind an explicit query param so
 * the owner can compare felt character while every other variable stays fixed.
 *
 * `?art=0` = baseline (no override)
 * `?art=1` = candidate 1
 * `?art=2` = candidate 2
 * `?art=3` = candidate 3
 *
 * The numeric codes are intentional: the comparison should be as blind as practical. The mapping
 * to the named hypotheses lives in docs/ART_DIRECTION_EXPERIMENT.md, not in the visible product.
 */
export type ArtDirectionCode = "0" | "1" | "2" | "3";

const CODES = new Set<ArtDirectionCode>(["0", "1", "2", "3"]);

export function resolveArtDirection(search: string): ArtDirectionCode {
  const raw = new URLSearchParams(search).get("art");
  return CODES.has(raw as ArtDirectionCode) ? (raw as ArtDirectionCode) : "0";
}

export function applyArtDirection(search = window.location.search): ArtDirectionCode {
  const code = resolveArtDirection(search);
  document.documentElement.dataset.artDirection = code;
  return code;
}
