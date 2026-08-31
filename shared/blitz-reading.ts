/**
 * WHAT THE BLITZ RECORD SAYS, COMPUTED ONCE, SO NO SCREEN HAS TO WORK IT OUT.
 *
 * THE RULE THIS EXISTS TO ENFORCE (master plan, §5): React does not read raw tables and reason
 * about them. Every screen that has ever shown a number in this product computed it in the
 * component -- which is why `RecordDashboard` and the claim panel could disagree about the same
 * record, and why the blitz post-game screen says "X decisions were analysed" and stops there: the
 * component had a count and no way to get anything better without doing statistics in a render.
 *
 * SO THIS RETURNS A READING AND THE UI RENDERS IT. Not a helper the component calls per row; a
 * whole answer, computed from the stored record, carrying its own denominators.
 *
 * FOUR THINGS IT REFUSES TO DO, and each of them was available and tempting:
 *
 *   1. IT NEVER POOLS ACROSS STRATA. `shared/blitz-strata.ts` exists because two engine builds are
 *      not one population, and it deliberately provides no flatten. This reads per stratum and says
 *      which one it is speaking about.
 *   2. IT NEVER RETURNS A RATE. Counts and their denominator go back to the caller, which divides
 *      where it can also print the n. That is R1, and it is what lets §10 write "6 of 9 decisions"
 *      instead of "66.7%".
 *   3. IT NEVER PROMOTES A RETROSPECTIVE READING. Everything found here is `recurred` at best --
 *      the region was chosen after seeing the data. Nothing in this file can produce a claim.
 *   4. IT NEVER INVENTS A REASON FOR SILENCE. "There is nothing to say" has five distinguishable
 *      causes and they lead to five different next steps; collapsing them into one empty state is
 *      how a product ends up telling a player to keep playing when the engine simply never ran.
 *
 * THE SHORTFALL IS THE PART THAT MAKES SILENCE USABLE. §13 wants "two more games would allow a
 * first check", and that sentence is only honest if the number came from the gate that is actually
 * blocking. It does: `shortfallOf` finds the bucketing whose smaller side is nearest
 * `MIN_BUCKET_N`, reports the gap, and converts it to games at the rate this record has actually
 * observed -- with the number of games that rate was measured on, so a caller can decline to show
 * a conversion drawn from two games.
 *
 * READING BUCKET MEMBERSHIP IS NOT PEEKING AT THE ANSWER, and it is worth being explicit because
 * it looks like it might be. The shortfall reads `secondsTaken`, `phase` and `clockMsRemaining` --
 * the predicate inputs -- and never `confidence` or `accurate`. It cannot prefer the bucket that
 * happens to contain a finding, because at the point it runs no bucket contains anything.
 */
import {
  BUCKETINGS,
  MIN_BUCKET_N,
  accurateDecision,
  bucketable,
  detect,
  splitByBucket,
  type CandidatePattern,
  type ScoredDecision,
} from "./detector.js";
import { classifyPhase } from "./phase.js";
import { normaliseConfidence } from "./confidence.js";
import { CONFIDENT_ENOUGH_TO_NAME, UNSURE_ENOUGH_TO_NAME, MATERIAL_LOSS_CP, ENGINE_NOISE_CP, type RevealEvidence } from "./reveal.js";
import { authorityOfRecordReading, type EvidenceAuthority } from "./evidence-authority.js";
import {
  blitzCalibrationPopulation,
  blitzSearchPopulation,
  blitzStratumId,
  type BlitzExclusion,
  type BlitzStratum,
  type BlitzStratumKey,
} from "./blitz-strata.js";
import {
  blitzConfidenceOf,
  type StoredBlitzDecision,
  type StoredBlitzGame,
} from "./blitz-record.js";

/**
 * The games, counted by what has actually happened to each one.
 *
 * FIVE NUMBERS AND NOT ONE, for the reason `BLITZ_ANALYSIS_STATES` is four values and not a
 * boolean: "the engine has not run yet" and "the engine ran and declined" lead to different
 * sentences and different next steps, and a screen holding only a total cannot tell them apart.
 *
 * `unrecorded` IS NOT A FAILURE COUNT. It is games written before the analysis state existed, and
 * it is expected to be nonzero forever on any record that predates that column. It is separate so
 * that it never silently joins `scored`, which is the one thing that would make it a lie.
 */
export interface BlitzGameCounts {
  stored: number;
  scored: number;
  awaitingAnalysis: number;
  analysisRefused: number;
  unrecorded: number;
}

export interface BlitzDecisionCounts {
  stored: number;
  /** Scored, asked, and stated on a grid this build can read. The calibration denominator. */
  readable: number;
  /**
   * Readable rows whose scale was inferred from their age rather than read off the row.
   *
   * REPORTED RATHER THAN LOGGED. It is the size of the part of the denominator that rests on
   * "nothing else ever shipped", which is true and is not a measurement. It shrinks on its own as
   * old rows age out, and without this field that debt would be invisible and permanent.
   */
  dated: number;
  /** Stated on a grid version this build does not publish -- a row from a newer build. */
  unreadableGrid: number;
  /** One row per reason that actually applied, straight from `blitzCalibrationPopulation`. */
  excluded: { reason: BlitzExclusion; n: number; because: string }[];
}

/**
 * A countable event in the direction a pattern names, on both sides of its split.
 *
 * WHY A SECOND QUANTITY BESIDE THE GAP. The gap is what the detector tests and it is a mean of
 * signed differences: correct, and unsayable. §10 wants "this appeared in 6 of 9 decisions in that
 * situation, against 2 of 11 elsewhere", and that sentence needs a countable event -- something
 * that either happened on a decision or did not.
 *
 * THE EVENT IS THE PATTERN'S OWN DIRECTION, not a fixed one. For an overconfidence pattern it is
 * "said confident and the move was inaccurate"; for underconfidence it is "said unsure and the move
 * was fine". Counting the same event for both would describe one of them backwards.
 *
 * THE TWO THRESHOLDS ARE IMPORTED, NOT CHOSEN HERE. `CONFIDENT_ENOUGH_TO_NAME` and
 * `UNSURE_ENOUGH_TO_NAME` already decide when the reveal is allowed to mention a stated confidence;
 * a second pair would drift and then one screen would call a decision confident and another would
 * not.
 *
 * `of` IS NOT THE BUCKET SIZE. It counts only the decisions where the player's stated confidence
 * was on the side the pattern is about -- the ones where the event could have happened at all.
 * Using the whole bucket as the denominator would shrink every count toward zero by mixing in
 * decisions the sentence is not about.
 */
export interface CountableSide {
  hit: number;
  of: number;
}

export interface BlitzPattern {
  key: string;
  scope: string;
  /** Always `recurred`. Retrospective by construction; see §4 of the file comment. */
  authority: EvidenceAuthority;
  insideN: number;
  outsideN: number;
  /** Positive = the bucket is more overconfident than the rest. Carried with its error, always. */
  gapDifference: number;
  standardError: number;
  predictsOverconfidence: boolean;
  countable: { inside: CountableSide; outside: CountableSide };
  /**
   * Whether the two counts can be put beside each other in a sentence.
   *
   * FALSE WHEN EITHER SIDE HAS NOTHING THE EVENT COULD HAVE HAPPENED TO, and this is not a
   * pedantic case -- it is the ordinary one on a small record, and it was found by rendering a
   * planted fixture rather than by reasoning. A player who says "confident" on fast decisions and
   * "unsure" on slow ones produces `48 of 60` inside and `0 of 0` outside: both counts correct,
   * and "48 of 60 here, against 0 of 0 elsewhere" is not a comparison. It reads as a total
   * contrast, which is the strongest possible claim, drawn from no observations at all.
   *
   * A FIELD RATHER THAN A ZERO CHECK IN EACH COMPONENT, because a component that forgets it prints
   * the strongest wrong sentence this product can produce, and nothing in the render would look
   * unusual. `of === 0` is the condition; naming it here is what makes forgetting it visible.
   *
   * THE PATTERN IS STILL RETURNED. Its gap and its error are real -- the separability test reads
   * every decision in the bucket, not just the confident ones -- and suppressing the whole finding
   * because one SENTENCE cannot be built would hide a measurement behind a rendering limit.
   */
  comparable: boolean;
  supportingDecisionIds: string[];
}

export interface BlitzStratumReading {
  id: string;
  key: BlitzStratumKey;
  games: number;
  decisions: number;
  patterns: BlitzPattern[];
}

/**
 * WHY THE PRODUCT HAS NOTHING TO SAY, when it has nothing to say.
 *
 * FIVE CAUSES, ORDERED BY WHAT WENT WRONG FIRST, and the order is the same discipline
 * `exclusionOf` applies one level down: a record with no games is reported as having no games, not
 * as having too few readable decisions, even though both are true. The first cause is the one a
 * player can act on.
 *
 *   no-games          nothing has been played.
 *   nothing-scored    games are stored and the engine has not run on any of them.
 *   nothing-asked     scored, and the sampler asked about nothing -- the regime, not a fault.
 *   too-few-readable  asked, and no split has two sides big enough to estimate an error from.
 *   no-split-yet      both sides are big enough somewhere, and no bucketing separated.
 *
 * THE LAST TWO ARE DIFFERENT ANSWERS TO THE PLAYER. `too-few-readable` means keep playing and the
 * question stays open. `no-split-yet` means the question was asked and the answer, so far, is that
 * these six divisions do not describe this player -- which is a finding, is the most common one,
 * and is the one this product has never once said out loud.
 */
export const BLITZ_BLOCKERS = [
  "no-games",
  "nothing-scored",
  "nothing-asked",
  "too-few-readable",
  "no-split-yet",
] as const;
export type BlitzBlocker = (typeof BLITZ_BLOCKERS)[number];

/**
 * How much more record the nearest split needs, and what that is in games.
 *
 * `games` IS NULL UNTIL THERE IS A RATE TO CONVERT AT, and the rate arrives with the number of
 * games it was measured on so a caller can decline to show "2 more games" derived from one game.
 * An invented conversion is worse than none: it is the sentence the player will plan around.
 */
export interface BlitzShortfall {
  /** Readable decisions the nearest bucketing still needs on its smaller side. Always positive. */
  decisions: number;
  /** Which bucketing is nearest. Named so the sentence can say where the record is thin. */
  nearestBucket: string;
  games: number | null;
  readableDecisionsPerGame: number | null;
  gamesMeasuredOn: number;
}

export type BlitzStanding =
  | { may: true; readable: number }
  | { may: false; because: BlitzBlocker; readable: number; needs: BlitzShortfall | null };

/** Which class of thing made one decision worth showing. */
export const BLITZ_EVENT_KINDS = ["confident-and-costly", "unsure-and-fine", "costly"] as const;
export type BlitzEventKind = (typeof BLITZ_EVENT_KINDS)[number];

/**
 * WHAT EACH KIND RESTS ON, and the table is `reveal.ts`'s, not a second one.
 *
 * Two of these fire on something the player recorded before the engine spoke and which a PGN plus
 * an engine could not reconstruct. One fires on the cp-loss alone, which is exactly what Game
 * Review has given players for years. Rendering all three identically is what makes a product
 * unable to answer "is this something an engine could not have told me?".
 */
export const BLITZ_EVENT_EVIDENCE: Readonly<Record<BlitzEventKind, RevealEvidence>> = {
  "confident-and-costly": "process",
  "unsure-and-fine": "process",
  costly: "engine",
};

export interface BlitzEvent {
  gameId: string;
  ply: number;
  /** The position the player FACED, so a screen can show it without replaying anything. */
  fen: string;
  san: string;
  kind: BlitzEventKind;
  evidence: RevealEvidence;
  /** Always `one-event`. One decision cannot be anything else, however striking it is. */
  authority: EvidenceAuthority;
  thinkMs: number;
  clockBeforeMs: number;
  /** Null when the sampler did not ask. The level AND what it asserted, so no screen re-reads it. */
  confidence: { level: number; scale: number; read: number } | null;
  cpLoss: number;
  standingCp: number;
}

export interface BlitzReading {
  games: BlitzGameCounts;
  decisions: BlitzDecisionCounts;
  strata: BlitzStratumReading[];
  /**
   * The stratum this reading speaks about, chosen by size BEFORE anything is scored.
   *
   * Null when there is no readable stratum at all. The others are in `strata` and are not hidden:
   * a reading that quietly dropped a regime would be the pooling this file refuses, achieved by
   * omission instead of by addition.
   */
  spoken: BlitzStratumReading | null;
  standing: BlitzStanding;
}

/**
 * One stored decision as the detector's input, or null when it cannot be read as one.
 *
 * NULL IS NOT AN ERROR PATH HERE. Most decisions in a healthy record are unreadable for calibration
 * -- the sampler asks about roughly one in seven -- and `blitzCalibrationPopulation` has already
 * counted and named every reason. This returns null for the two it cannot: a row whose grid this
 * build does not publish, and a row the population let through with no standing evaluation.
 */
function toScored(decision: StoredBlitzDecision): ScoredDecision | null {
  if (decision.cpLoss === null || decision.standingCp === null) return null;
  const confidence = blitzConfidenceOf(decision, normaliseConfidence);
  if ("unreadable" in confidence) return null;
  return {
    decision_id: `${decision.gameId}#${decision.ply}`,
    fen: decision.fenBefore,
    confidence: confidence.read,
    accurate: accurateDecision(decision.standingCp, decision.cpLoss),
    phase: classifyPhase(decision.fenBefore, decision.ply),
    /*
     * SECONDS FROM MILLISECONDS, AND NOT ROUNDED. `fast-under-45s` is a threshold on this number,
     * and rounding 45.4 to 45 would move a decision across a boundary the whole detector is built
     * on -- silently, and only for decisions that landed near the edge.
     */
    secondsTaken: decision.thinkMs / 1000,
    clockMsRemaining: decision.clockBeforeMs,
  };
}

/** Whether a decision is a `hit` for a pattern pointing in the given direction. */
function countableHit(d: ScoredDecision, predictsOverconfidence: boolean): boolean | null {
  if (predictsOverconfidence) {
    return d.confidence >= CONFIDENT_ENOUGH_TO_NAME ? !d.accurate : null;
  }
  return d.confidence <= UNSURE_ENOUGH_TO_NAME ? d.accurate : null;
}

function countSide(decisions: readonly ScoredDecision[], predictsOverconfidence: boolean): CountableSide {
  let hit = 0;
  let of = 0;
  for (const d of decisions) {
    const outcome = countableHit(d, predictsOverconfidence);
    if (outcome === null) continue;
    of += 1;
    if (outcome) hit += 1;
  }
  return { hit, of };
}

function toPattern(candidate: CandidatePattern, decisions: readonly ScoredDecision[]): BlitzPattern {
  const bucketing = BUCKETINGS.find((b) => b.key === candidate.key);
  /*
   * A CANDIDATE NAMING A BUCKETING THAT DOES NOT EXIST CANNOT HAPPEN, because `detect` iterates
   * BUCKETINGS to produce them. The guard is here so that if it ever does -- a stored candidate
   * replayed against a later build, say -- the counts come back empty rather than computed from
   * the whole record as though the bucket were everything.
   */
  const { inside, outside } = bucketing
    ? splitByBucket(bucketing, decisions)
    : { inside: [], outside: [] };
  const countable = {
    inside: countSide(inside, candidate.predicts_overconfidence),
    outside: countSide(outside, candidate.predicts_overconfidence),
  };
  return {
    key: candidate.key,
    scope: candidate.scope,
    authority: authorityOfRecordReading(candidate.inside.n),
    insideN: candidate.inside.n,
    outsideN: candidate.outside.n,
    gapDifference: candidate.gapDifference,
    standardError: candidate.standardError,
    predictsOverconfidence: candidate.predicts_overconfidence,
    countable: countable,
    comparable: countable.inside.of > 0 && countable.outside.of > 0,
    supportingDecisionIds: candidate.supporting_decision_ids,
  };
}

/**
 * The bucketing whose smaller side is nearest to being measurable, and how far it still is.
 *
 * "NEAREST" IS DECIDED ON MEMBERSHIP COUNTS ALONE. No confidence, no accuracy, no gap. The
 * decisions have been scored by the time this runs -- they have to be, to be countable -- and this
 * function reads none of it. That is what makes naming a bucket here safe: at the moment it
 * chooses, every bucket is equally silent about the answer.
 *
 * NULL WHEN NO BUCKETING CAN READ THE RECORD AT ALL, which is a real state: a record whose think
 * times are all missing has no side to be short on, and reporting "0 more decisions" would say the
 * gate is about to open.
 */
export function shortfallOf(
  decisions: readonly ScoredDecision[],
  gamesMeasuredOn: number,
  readableDecisions: number,
  minBucketN: number = MIN_BUCKET_N,
): BlitzShortfall | null {
  let best: { key: string; missing: number } | null = null;
  for (const bucketing of BUCKETINGS) {
    if (!decisions.some((d) => bucketable(bucketing, d))) continue;
    const { inside, outside } = splitByBucket(bucketing, decisions);
    const smaller = Math.min(inside.length, outside.length);
    const missing = Math.max(0, minBucketN - smaller);
    if (best === null || missing < best.missing || (missing === best.missing && bucketing.key < best.key)) {
      best = { key: bucketing.key, missing };
    }
  }
  if (best === null || best.missing === 0) return null;

  /*
   * THE CONVERSION, AND THE TWO NUMBERS THAT LET A CALLER REFUSE IT. `readableDecisionsPerGame` is
   * measured on this record and nowhere else -- the ask rate is a policy, but how many of a
   * player's decisions actually get asked AND scored is an outcome, and using the policy would
   * promise a schedule the record does not keep.
   *
   * A SHORTFALL ON THE SMALLER SIDE IS NOT A SHORTFALL IN THE RECORD. New decisions do not all
   * land in the thin side, so the games figure is a FLOOR and the caller has to say so. It is
   * still the right number to show: it is the soonest this could possibly resolve, and a number
   * that could only be too optimistic is easier to state honestly than one built from a guess
   * about how the next games will split.
   */
  const perGame = gamesMeasuredOn > 0 ? readableDecisions / gamesMeasuredOn : null;
  return {
    decisions: best.missing,
    nearestBucket: best.key,
    games: perGame !== null && perGame > 0 ? Math.ceil(best.missing / perGame) : null,
    readableDecisionsPerGame: perGame,
    gamesMeasuredOn,
  };
}

function countGames(games: readonly StoredBlitzGame[]): BlitzGameCounts {
  const counts: BlitzGameCounts = {
    stored: games.length,
    scored: 0,
    awaitingAnalysis: 0,
    analysisRefused: 0,
    unrecorded: 0,
  };
  for (const game of games) {
    if (game.analysisState === "complete") counts.scored += 1;
    else if (game.analysisState === "pending") counts.awaitingAnalysis += 1;
    else if (game.analysisState === "refused") counts.analysisRefused += 1;
    else counts.unrecorded += 1;
  }
  return counts;
}

/**
 * WHAT THE WHOLE BLITZ RECORD SAYS.
 *
 * The one entry point. Everything a screen needs about the record as a whole comes from here, and
 * nothing a screen needs is computed anywhere else.
 */
export function readBlitz(
  games: readonly StoredBlitzGame[],
  decisions: readonly StoredBlitzDecision[],
): BlitzReading {
  const gameCounts = countGames(games);
  const population = blitzCalibrationPopulation(games, decisions);

  /*
   * THE TWO COUNTS `blitzCalibrationPopulation` CANNOT PRODUCE, because they are about the grid a
   * confidence was stated on and that module reads conditions, not confidences. A row it admits can
   * still be unreadable here -- stated on a version this build does not publish -- and a reading
   * whose denominator silently shrank between two modules is the failure R1 is against.
   */
  let dated = 0;
  let unreadableGrid = 0;
  const scoredByStratum = new Map<string, ScoredDecision[]>();
  for (const stratum of population.strata) {
    const scored: ScoredDecision[] = [];
    for (const decision of stratum.decisions) {
      const confidence = blitzConfidenceOf(decision, normaliseConfidence);
      if ("unreadable" in confidence) {
        unreadableGrid += 1;
        continue;
      }
      if (confidence.dated) dated += 1;
      const one = toScored(decision);
      if (one !== null) scored.push(one);
    }
    scoredByStratum.set(blitzStratumId(stratum.key), scored);
  }

  const readable = [...scoredByStratum.values()].reduce((n, s) => n + s.length, 0);
  const strata = population.strata.map((stratum) =>
    readStratum(stratum, scoredByStratum.get(blitzStratumId(stratum.key)) ?? []),
  );
  const { chosen } = blitzSearchPopulation(population.strata);
  const spoken =
    chosen === null ? null : strata.find((s) => s.id === blitzStratumId(chosen.key)) ?? null;
  const spokenScored = chosen === null ? [] : scoredByStratum.get(blitzStratumId(chosen.key)) ?? [];

  return {
    games: gameCounts,
    decisions: {
      stored: decisions.length,
      readable,
      dated,
      unreadableGrid,
      excluded: population.excluded,
    },
    strata,
    spoken,
    standing: standingOf(gameCounts, population.excluded, spoken, spokenScored, readable),
  };
}

function readStratum(stratum: BlitzStratum, scored: readonly ScoredDecision[]): BlitzStratumReading {
  /*
   * `detect` IS CALLED ON THE STRATUM AND NEVER ON THE RECORD. That is the entire reason
   * `blitz-strata.ts` was written, and the one line where forgetting it would be invisible: the
   * function takes an array, and an array of everything looks exactly like an array of one regime.
   */
  const candidates = detect([...scored]);
  return {
    id: blitzStratumId(stratum.key),
    key: stratum.key,
    games: stratum.gameIds.length,
    decisions: stratum.decisions.length,
    patterns: candidates.map((c) => toPattern(c, scored)),
  };
}

function standingOf(
  games: BlitzGameCounts,
  excluded: { reason: BlitzExclusion; n: number }[],
  spoken: BlitzStratumReading | null,
  spokenScored: readonly ScoredDecision[],
  readable: number,
): BlitzStanding {
  if (games.stored === 0) return { may: false, because: "no-games", readable, needs: null };
  if (games.scored === 0) {
    return { may: false, because: "nothing-scored", readable, needs: null };
  }
  if (readable === 0) {
    /*
     * SCORED AND EMPTY. `not-asked` is the sampling regime working as designed and it is the
     * expected reason on a short record: at a 15% ask rate a three-minute game contributes a
     * handful. Any other reason here is a fault, and the two must not share a sentence.
     */
    const unasked = excluded.find((e) => e.reason === "not-asked");
    const because: BlitzBlocker = unasked && unasked.n > 0 ? "nothing-asked" : "too-few-readable";
    return { may: false, because, readable, needs: null };
  }
  const needs = shortfallOf(spokenScored, spoken?.games ?? 0, readable);
  if (needs !== null) return { may: false, because: "too-few-readable", readable, needs };
  if (spoken === null || spoken.patterns.length === 0) {
    /*
     * THE STATE THIS PRODUCT HAS NEVER SAID OUT LOUD. The record is large enough, every split was
     * tested, and none of them separated. That is an answer -- these six divisions do not describe
     * this player -- and it is the most common one the M0 audit measured. Reporting it as "not
     * enough data" would be false, and reporting it as nothing at all is what the product does now.
     */
    return { may: false, because: "no-split-yet", readable, needs: null };
  }
  return { may: true, readable };
}

/**
 * The decisions in one game worth putting in front of the player, best first.
 *
 * ORDERED BY WHAT THE RECORD COULD SAY THAT AN ENGINE COULD NOT. Process events first, because
 * those are the ones no game review can produce; cp-loss breaks ties within a class. A list sorted
 * by cp-loss alone would lead with the biggest blunder every time, which is what every engine
 * report already does and is the thing this product is not for.
 *
 * NOT CAPPED HERE. §24 shows one and offers the rest behind a disclosure, and where that line falls
 * is a rendering decision; a cap in this function would silently decide it for every future screen.
 */
export function blitzEventsIn(
  game: StoredBlitzGame,
  decisions: readonly StoredBlitzDecision[],
): BlitzEvent[] {
  if (game.analysisState !== "complete") return [];
  const events: BlitzEvent[] = [];
  for (const decision of decisions) {
    if (decision.gameId !== game.gameId) continue;
    if (decision.cpLoss === null || decision.standingCp === null) continue;
    const confidence = blitzConfidenceOf(decision, normaliseConfidence);
    const stated = "unreadable" in confidence ? null : confidence;
    const costly = decision.cpLoss >= MATERIAL_LOSS_CP;
    const clean = decision.cpLoss <= ENGINE_NOISE_CP;

    let kind: BlitzEventKind | null = null;
    if (stated !== null && stated.read >= CONFIDENT_ENOUGH_TO_NAME && costly) {
      kind = "confident-and-costly";
    } else if (stated !== null && stated.read <= UNSURE_ENOUGH_TO_NAME && clean) {
      kind = "unsure-and-fine";
    } else if (costly) {
      kind = "costly";
    }
    if (kind === null) continue;

    events.push({
      gameId: decision.gameId,
      ply: decision.ply,
      fen: decision.fenBefore,
      san: decision.san,
      kind,
      evidence: BLITZ_EVENT_EVIDENCE[kind],
      authority: "one-event",
      thinkMs: decision.thinkMs,
      clockBeforeMs: decision.clockBeforeMs,
      confidence:
        stated === null || decision.confidence === null
          ? null
          : { level: decision.confidence, scale: stated.scale, read: stated.read },
      cpLoss: decision.cpLoss,
      standingCp: decision.standingCp,
    });
  }
  return events.sort(
    (a, b) =>
      Number(BLITZ_EVENT_EVIDENCE[b.kind] === "process") -
        Number(BLITZ_EVENT_EVIDENCE[a.kind] === "process") ||
      b.cpLoss - a.cpLoss ||
      a.ply - b.ply,
  );
}
