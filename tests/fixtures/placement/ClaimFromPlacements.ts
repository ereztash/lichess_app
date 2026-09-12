/**
 * THE POSITIVE CONTROL: a claim-path module that grades a player on what their hand passed over.
 *
 * Deliberately the most plausible version rather than the most obviously wrong one. It reads the
 * field the way a reasonable author would -- "how many moves did they look at before choosing" as
 * a proxy for deliberation -- and every entry it counts could equally be a drag that went out and
 * came back. Nothing about the shape of this code says so, which is the point: the defect is
 * invisible at the call site and only visible at the field.
 */
interface Row {
  candidateMovesConsidered: string[];
  cpLoss: number;
}

/** A "deliberation" score, built from placements. This is the thing the gate exists to refuse. */
export function deliberationGrade(rows: readonly Row[]): number | null {
  if (rows.length === 0) return null;
  const weighed = rows.filter((row) => row.candidateMovesConsidered.length > 1).length;
  return weighed / rows.length;
}
