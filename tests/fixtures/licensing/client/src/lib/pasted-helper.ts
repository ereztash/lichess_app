/*
 * A utility copied from a GPL project, header and all, into a proprietary directory.
 *
 * Copyright (C) 2019 Some Other Project
 * Licensed under the terms of the GNU General Public License v3.0 or later.
 *
 * This is the commonest way a boundary is lost: not a decision, a paste. The header is the only
 * evidence that it happened, and the gate reads headers for exactly that reason.
 */
export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
