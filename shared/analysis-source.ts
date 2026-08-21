/**
 * Where the position under analysis came from.
 *
 * This existed in three places -- server/lichess.ts, LichessLayersPanel, and Home -- and the
 * three did not agree: Home's copy listed only "imported" | "live", so it could not represent a
 * finished Lichess game at all. The fair-play guard keys off this value, which makes a silently
 * divergent copy of it exactly the wrong thing to have.
 */
export const ANALYSIS_SOURCES = ["demo", "imported", "finished", "study", "live"] as const;

export type AnalysisSource = (typeof ANALYSIS_SOURCES)[number];

/**
 * Sources the post-game layers may run against.
 *
 * "live" and "demo" are excluded: opening explorer and cloud evaluation must stay unavailable
 * during a live game. Server-side `ensurePostGame` is the enforcement; this is the shared list
 * both sides read so they cannot drift apart.
 */
export const POST_GAME_SOURCES: readonly AnalysisSource[] = ["imported", "finished", "study"];

export function isPostGame(source: AnalysisSource): boolean {
  return POST_GAME_SOURCES.includes(source);
}
