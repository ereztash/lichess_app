/**
 * ONE FUNCTION, IN ITS OWN FILE, AND THE FILE IS THE POINT.
 *
 * It was three lines inside `record-service.ts`, which is correct by every argument except the one
 * that matters here: `record-service.ts` is on the entry route -- `record-api.ts` imports it for
 * every local-mode write -- so a single reference to `readBlitz` from anywhere in that module
 * retained the whole reading chain in the entry chunk. The detector, the six bucketings,
 * `classifyPhase` and the blitz wire schemas: +16.1 kB raw and +5.1 kB gzipped, paid by every
 * arrival, including the overwhelming majority who have never played a blitz game.
 *
 * MEASURED RATHER THAN ASSUMED, and measured twice: making the COMPONENT lazy recovered only half
 * of it, because the hook that calls this still lived in an eager module. Splitting the module is
 * what actually moves the code, and the split has to go all the way down -- component, hook, and
 * this function -- or Rollup hoists it back into the shared chunk.
 *
 * THE SERVER IS UNAFFECTED. `recordRouter.ts` is not bundled by Vite; it imports this the same way
 * it imported the previous home, and the two deployments still compute the reading with one
 * function, which is the property that made it shared code in the first place.
 */
import type { RecordStore } from "./record-store.js";
import { readBlitz, type BlitzReading } from "./blitz-reading.js";
import type { StoredBlitzGame } from "./blitz-record.js";

export async function blitzRecordReading(store: RecordStore): Promise<{
  reading: BlitzReading;
  games: StoredBlitzGame[];
}> {
  const games = await store.listBlitzGames();
  const decisions = await store.listBlitzDecisions();
  return { reading: readBlitz(games, decisions), games };
}
