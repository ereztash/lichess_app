/**
 * WHICH BLITZ DECISIONS ARE SAFE TO POOL, and which cannot be read at all.
 *
 * THE HOLE THIS CLOSES. `blitz_games` now records what scored it and who it was played against
 * (R-03, R-04 in `docs/MASTER_PRODUCT_DEBT.md`), and recording a field is not the same as a reading
 * that respects it. Nothing yet reads these rows, which is exactly when the wall is cheap to build:
 * `shared/evidence-policy.ts` was written to stop discovery pooling regimes, and the pooling it
 * exists to stop had already happened by the time it was written.
 *
 * THIS IS NOT A SEVENTH COLUMN IN `EVIDENCE_POLICY`, and the reason is the one that module states
 * about protocol and reveal timing: the table asks a question about a ROW -- may this consumer read
 * this decision? -- and an engine build is an incompatibility BETWEEN decisions. No single row is
 * "pooled". A set is. Asked row by row, every blitz decision is individually fine, and forty of
 * them scored by two different builds of Stockfish are not one population.
 *
 * THE ENGINE IS NOT METADATA HERE. `docs/ACTION_PLAN.md` §B1 measured what an engine change does to
 * this product's own numbers: 13.61% of decisions flipped verdict (216 of 1,587) between the engine
 * that produced the published figures and the engine that ships, and 1 bucket of 38 was stable to
 * display resolution. A cp-loss that cannot name its build is a number two different instruments
 * could have produced, and a calibration gap computed across a version bump is an artefact of the
 * bump.
 *
 * THE OPPONENT IS THE SAME ARGUMENT ONE LEVEL OUT. A blitz claim is a claim about playing one
 * colour against whatever the build happened to use, and if the opponent's search depth changes the
 * population changes with it -- the positions reached are different positions. Stored per game
 * rather than assumed from the build, because the two can disagree: a record outlives the build
 * that wrote it.
 *
 * THERE IS DELIBERATELY NO FUNCTION HERE THAT FLATTENS STRATA BACK INTO ONE, for the reason
 * `evidence-policy.ts` gives: refusing to provide the operation is stronger than documenting that
 * it is wrong. A caller that wants one population has to choose one and say so.
 */
import type { StoredBlitzDecision, StoredBlitzGame } from "./blitz-record.js";

/**
 * A CONDITION NOBODY RECORDED, and it is not a value the condition took.
 *
 * Same key, same spelling and the same argument as `LEGACY_CONTEXT` in `evidence-policy.ts` and
 * `LEGACY_PROTOCOL` in `measurement-protocol.ts`: a row from before a field existed is not a row
 * whose field was empty. Pooling it with any real value asserts a fact this build never observed,
 * and it is never backfilled to one.
 */
export const LEGACY_INSTRUMENT = "legacy" as const;

/**
 * Why a decision could not enter a calibration reading. Five reasons, not one, BECAUSE THEY ARE
 * FIVE DIFFERENT FACTS and a reader that cannot tell them apart cannot say what its denominator is.
 *
 *   analysis-not-run       the game is stored and unscored. Nothing has asked the engine yet, and
 *                          it still might -- this row may become readable without anything failing.
 *   analysis-refused       the engine ran and the join declined the game. It will never be scored.
 *   instrument-unrecorded  scored, but nothing says by what. `legacy-unknown` rows and any
 *                          `complete` row missing its provenance land here.
 *   evaluator-silent       the game was scored and the engine could not answer for THIS position.
 *   not-asked              the sampler did not ask, so there is no confidence to calibrate. This
 *                          one is not a defect: it is the sampling regime working as designed.
 *
 * THE LAST ONE IS SEPARATE ON PURPOSE. Folding "the instrument chose not to ask" in with "the
 * instrument was broken" would make the exclusion count unreadable in the one direction that
 * matters -- a run where the sampler asked nothing looks identical to a run where the engine
 * answered nothing.
 */
export const BLITZ_EXCLUSIONS = [
  "game-missing",
  "analysis-not-run",
  "analysis-refused",
  "instrument-unrecorded",
  "evaluator-silent",
  "not-asked",
] as const;
export type BlitzExclusion = (typeof BLITZ_EXCLUSIONS)[number];

/** Why each exclusion holds, in words a caller can put on a screen without rewriting them. */
export const BLITZ_EXCLUSION_REASON: Readonly<Record<BlitzExclusion, string>> = {
  "game-missing": "The decision names a game this reading did not receive, so nothing describes its conditions.",
  "analysis-not-run": "Stored and not yet scored. The engine has not run on this game.",
  "analysis-refused": "The engine ran and the join declined the game, so no verdict belongs to it.",
  "instrument-unrecorded": "Scored, but nothing recorded which engine did it or how deep it looked.",
  "evaluator-silent": "The engine could not answer for one of this decision's two positions.",
  "not-asked": "The sampler did not ask about this decision, so there is no confidence to compare.",
};

/**
 * The conditions that have to match before two blitz decisions are one population.
 *
 * WHY FOUR AXES AND NOT TWO. R-03 and R-04 name the engine and the opponent, and the two version
 * numbers are here because the record already carries them for exactly this purpose:
 * `protocolVersion` says which measurement regime was in force and `samplingPolicyVersion` says
 * which rule decided who got asked. Both are constant within any one build, so today every axis but
 * the engine's build collapses to a single value and the split costs nothing. That is the point of
 * adding them now: an axis that is free while it is constant is the only kind that ever gets added,
 * and the day one of them moves is the day pooling across it would have been silent.
 */
export interface BlitzStratumKey {
  /** `engine@build/depth`, or `legacy` when the row does not say. */
  analysis: string;
  /** `kind:engine@build/depth`, or `legacy` when the row does not say. */
  opponent: string;
  protocolVersion: number;
  samplingPolicyVersion: number;
}

/** One stratum: decisions that share every condition that makes them comparable. */
export interface BlitzStratum {
  key: BlitzStratumKey;
  decisions: StoredBlitzDecision[];
  /** The games these decisions came from, so a caller can report n games as well as n decisions. */
  gameIds: string[];
}

/**
 * A stratum key as one string, for a map key and for a message.
 *
 * EVERY COMPONENT IS PERCENT-ENCODED, which looks fussy and is not. `stratumId` in
 * `evidence-policy.ts` joins two closed enums with a slash and is safe because both are enums.
 * These components are free text out of a record: an engine name containing the separator could
 * forge a different key's id, and two regimes sharing an id is silent pooling -- the exact failure
 * this module exists to prevent, arriving through its own identifier.
 */
export function blitzStratumId(key: BlitzStratumKey): string {
  return [
    encodeURIComponent(key.analysis),
    encodeURIComponent(key.opponent),
    key.protocolVersion,
    key.samplingPolicyVersion,
  ].join("|");
}

/**
 * The analysis instrument as one string, or `legacy`.
 *
 * A `complete` game whose provenance is null gets `legacy` rather than a guess. The wire schema
 * refuses that combination, so it should not arrive -- but "should not arrive" is what a reader
 * assumes, and this one is read from a table that also holds rows written before the column did.
 */
export function analysisInstrumentOf(game: StoredBlitzGame): string {
  if (game.analysisState !== "complete" || !game.analysis) return LEGACY_INSTRUMENT;
  const { engine, build, depth } = game.analysis;
  return `${engine}@${build}/${depth}`;
}

/** The opponent policy as one string, or `legacy`. Same argument as above. */
export function opponentPolicyOf(game: StoredBlitzGame): string {
  if (!game.opponent) return LEGACY_INSTRUMENT;
  const { kind, engine, build, depth } = game.opponent;
  return `${kind}:${engine}@${build}/${depth}`;
}

function keyOf(game: StoredBlitzGame): BlitzStratumKey {
  return {
    analysis: analysisInstrumentOf(game),
    opponent: opponentPolicyOf(game),
    protocolVersion: game.protocolVersion,
    samplingPolicyVersion: game.samplingPolicyVersion,
  };
}

/**
 * Why one decision is not in any stratum, or `null` when it is readable.
 *
 * ORDER MATTERS AND IT IS THE ORDER OF WHAT WENT WRONG FIRST. A decision in an unscored game is
 * reported as unscored, not as unasked, even when both are true: the sampler's silence is a fact
 * about the instrument's regime, and reporting it on a game the engine never touched would put a
 * row in the sampling column that the sampling column cannot explain.
 */
export function exclusionOf(
  decision: StoredBlitzDecision,
  game: StoredBlitzGame | undefined,
): BlitzExclusion | null {
  if (!game) return "game-missing";
  if (game.analysisState === "pending") return "analysis-not-run";
  if (game.analysisState === "refused") return "analysis-refused";
  if (game.analysisState !== "complete" || !game.analysis) return "instrument-unrecorded";
  if (decision.cpLoss === null) return "evaluator-silent";
  if (decision.confidence === null) return "not-asked";
  return null;
}

/** What a reading got, and what it could not use. Both, always -- a count that shrank says why. */
export interface BlitzPopulation {
  /** Largest first, ties broken by id, so the same record always yields the same reading. */
  strata: BlitzStratum[];
  /** One row per reason that actually applied, with its count and its sentence. */
  excluded: { reason: BlitzExclusion; n: number; because: string }[];
}

/**
 * THE ONLY WAY TO READ BLITZ DECISIONS FOR A CALIBRATION READING.
 *
 * It returns strata rather than a set for the reason at the top of this file, and it returns the
 * exclusions beside them rather than dropping them, because R1 in this repository is that a
 * denominator has to be able to say what it left out. A reading that quietly shrinks is a reading
 * whose number changed for a reason nobody can name.
 */
export function blitzCalibrationPopulation(
  games: readonly StoredBlitzGame[],
  decisions: readonly StoredBlitzDecision[],
): BlitzPopulation {
  const byGame = new Map(games.map((g) => [g.gameId, g]));
  const counts = new Map<BlitzExclusion, number>();
  const strata = new Map<string, BlitzStratum>();

  for (const decision of decisions) {
    const game = byGame.get(decision.gameId);
    const excluded = exclusionOf(decision, game);
    if (excluded !== null || !game) {
      counts.set(excluded ?? "game-missing", (counts.get(excluded ?? "game-missing") ?? 0) + 1);
      continue;
    }
    const key = keyOf(game);
    const id = blitzStratumId(key);
    const stratum = strata.get(id) ?? { key, decisions: [], gameIds: [] };
    stratum.decisions.push(decision);
    if (!stratum.gameIds.includes(game.gameId)) stratum.gameIds.push(game.gameId);
    strata.set(id, stratum);
  }

  return {
    strata: [...strata.values()].sort(
      (a, b) =>
        b.decisions.length - a.decisions.length ||
        blitzStratumId(a.key).localeCompare(blitzStratumId(b.key)),
    ),
    excluded: BLITZ_EXCLUSIONS.filter((reason) => counts.has(reason)).map((reason) => ({
      reason,
      n: counts.get(reason) ?? 0,
      because: BLITZ_EXCLUSION_REASON[reason],
    })),
  };
}

/**
 * WHICH STRATUM A READING ACTUALLY USES, separate from splitting them for the reason
 * `discoverySearchPopulation` gives about its own pair: splitting the population is an engineering
 * fix that expresses no opinion, and choosing among the results is a scientific decision. One must
 * not ride along inside the other.
 *
 * THE RULE IS "THE LARGEST", AND ITS ONE VIRTUE IS THAT IT IGNORES THE ANSWER. It is decided from
 * sizes alone, before anything is scored, so it cannot select the regime that happens to contain a
 * finding. On any record with one regime -- which is every record this build can write -- it
 * changes nothing.
 */
export function blitzSearchPopulation(strata: readonly BlitzStratum[]): {
  chosen: BlitzStratum | null;
  setAside: { id: string; n: number }[];
} {
  const [chosen = null, ...rest] = strata;
  return {
    chosen,
    setAside: rest.map((s) => ({ id: blitzStratumId(s.key), n: s.decisions.length })),
  };
}
