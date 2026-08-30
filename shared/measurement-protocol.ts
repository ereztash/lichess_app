/**
 * THE CONDITIONS AN OBSERVATION WAS PRODUCED UNDER. Not where it came from, and not what it says.
 *
 * Two rows with identical fields and different protocols are different measurements that happen to
 * share a schema. `purpose` already says why a decision existed; this says what the world was like
 * while it was being made -- whether a clock was running, whether an engine was running, whether
 * anybody was asked anything at all.
 *
 * WHY IT IS ITS OWN AXIS AND NOT A SEVENTH `DecisionPurpose`. A purpose and a protocol vary
 * independently: a `play` decision can be made in the untimed commitment loop or in a timed blitz
 * game, and those two are not comparable even though the player's intent was the same in both.
 * Folding one into the other would force a choice between losing the purpose and losing the
 * conditions, and the admission table needs both.
 *
 * THE SHAPE OF THIS FILE IS COPIED DELIBERATELY from `reveal-timing.ts` and the `LEGACY_CONTEXT`
 * argument in `evidence-policy.ts`, because this repository has already had this exact problem
 * twice and solved it the same way both times: a stored value whose meaning depends on a condition
 * nothing recorded is a value nobody can read back.
 */

/**
 * The protocols that exist. `lichess-board-api` is named in `docs/blitz/ADR-001` and is NOT here.
 *
 * An enum value nothing can produce is a branch nothing can test, and this repository would rather
 * pay for a migration later than carry a case that is unreachable now. Adding it is a schema change
 * whenever it arrives, so nothing is saved by declaring it early.
 */
export const MEASUREMENT_PROTOCOLS = [
  /**
   * A game played somewhere else and imported afterwards. Nothing was measured while it happened;
   * every field is reconstructed from the PGN.
   *
   * IT CANNOT CARRY A CALIBRATION GAP AND NEVER WILL. Nobody was asked how sure they were during a
   * game that was already over, and `shared/import-diagnostic.ts` refuses to compute a gap from one
   * in its own words: "There is no confidence in this data." The protocol is what lets a consumer
   * refuse it structurally rather than by remembering.
   */
  "historical-passive",
  /**
   * The commitment loop as it has always run: one position at a time, no clock, the player commits
   * before the engine speaks.
   */
  "instrumented-standard",
  /**
   * A timed game inside the product. Decision time measured to the commit, confidence sampled after
   * it, and no analysis at all until the game is over.
   */
  "instrumented-blitz",
] as const;

export type MeasurementProtocol = (typeof MEASUREMENT_PROTOCOLS)[number];

/**
 * WHEN THE ENGINE RAN -- which is not the same question as when the player was TOLD.
 *
 * This field exists because the two came apart, and the code that separated them says so plainly.
 * `Home.tsx` on the deferred game: *"THE ENGINE RUNS IN BOTH MODES; ONLY THE TELLING DIFFERS."*
 * The reasoning there is sound -- a deferred game that stored no evaluations would be forty
 * decisions nothing ever scored -- but it means `reveal_timing: "end-of-game"` does NOT say the
 * engine was quiet, and for a blitz game that distinction is the entire measurement.
 *
 * So a third field, rather than deriving this from the other two. It would be redundant if the
 * product had ever had a mode where the engine did not run during play. It never has.
 */
export const ANALYSIS_TIMINGS = [
  /** The engine ran while the game was in progress, whether or not the player was shown anything. */
  "during-play",
  /** The engine did not run until play was over. The only timing an instrumented blitz game may have. */
  "after-play",
] as const;

export type AnalysisTiming = (typeof ANALYSIS_TIMINGS)[number];

/**
 * The version of the instrumented protocols, stamped on every decision that runs under one.
 *
 * A protocol whose rules change is a different protocol for analysis even when its name is the
 * same -- if the confidence sampling rate moves, or the moment the question appears moves, then
 * "instrumented-blitz" before and after are two populations. The version is what lets a later
 * reader tell them apart, and it is the same device `EVIDENCE_POLICY_VERSION` already is.
 *
 * BUMP THIS when anything changes about HOW a decision is produced. Not when a bug is fixed in
 * something that reads one.
 */
export const CURRENT_PROTOCOL_VERSION = 1;

/**
 * What analysis timing a protocol is allowed to have.
 *
 * `instrumented-blitz` may only ever be `after-play`, and that is INV-4 expressed as data rather
 * than as a rule somebody has to remember. A row that claims otherwise is a bug that shows up in
 * the record, where a query can find it, rather than only in the code, where it cannot.
 */
export const REQUIRED_ANALYSIS_TIMING: Readonly<
  Partial<Record<MeasurementProtocol, AnalysisTiming>>
> = {
  "historical-passive": "after-play",
  "instrumented-blitz": "after-play",
  /* `instrumented-standard` is genuinely both: the engine runs during play in either reveal mode. */
};

/**
 * True when a decision's protocol and analysis timing contradict each other.
 *
 * NULL IS NOT A CONTRADICTION. An unstamped row is not claiming anything, and the whole point of
 * leaving it null is that it makes no claim -- see `protocolOf` below.
 */
export function contradictsProtocol(
  protocol: MeasurementProtocol | null,
  timing: AnalysisTiming | null,
): boolean {
  if (protocol === null || timing === null) return false;
  const required = REQUIRED_ANALYSIS_TIMING[protocol];
  return required !== undefined && required !== timing;
}

/**
 * A row that never recorded its conditions.
 *
 * NOT A PROTOCOL, which is why it is a separate key rather than a fourth member of the union --
 * exactly the argument `evidence-policy.ts` makes for `LEGACY_CONTEXT`, and `reveal-timing`'s
 * schema makes for a nullable enum.
 *
 * THE TEMPTING BACKFILL IS `instrumented-standard`, AND IT IS A LIE. Every decision written before
 * this field existed was in fact made in the untimed commitment loop, because that was the only
 * loop there was -- so the backfill would even be FACTUALLY right. It is still forbidden, for the
 * reason `reveal_timing` gives about its own: it would assert that a condition was RECORDED when
 * nobody recorded one, and the first comparison between protocols would show a standard arm that
 * is enormous and perfectly measured. A fact nobody wrote down is not a fact the record may claim.
 */
export const LEGACY_PROTOCOL = "legacy" as const;
export type ProtocolKey = MeasurementProtocol | typeof LEGACY_PROTOCOL;

/** The protocol key of one decision: what it recorded, or `legacy` when it recorded nothing. */
export function protocolOf(protocol: MeasurementProtocol | null | undefined): ProtocolKey {
  return protocol ?? LEGACY_PROTOCOL;
}
