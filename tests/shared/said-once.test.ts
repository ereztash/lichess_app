/**
 * The same fact, twice, on one screen -- three times over.
 *
 * `ContextRibbon` renders `loopPosition()` at the top of the page, and `ClaimPanel` renders
 * `ClaimView.reason` roughly five hundred pixels below it on a phone. In every one of the three
 * silent states they were saying the same thing in different words:
 *
 *   FLOOR NOT MET, ORDINARY SCAN
 *     ribbon  "עוד 52 החלטות חשופות עד שאפשר לומר משהו. 2 כבר רשומות וממתינות לחשיפה."
 *             basis "8 חשופות מתוך 10 רשומות"
 *     panel   "נרשמו 10 החלטות, מתוכן 8 נחשפו. צריך עוד 52 החלטות חשופות לפני שאפשר לומר משהו
 *              — ו-2 ממתינות לחשיפה."
 *     -- the same four numbers, and the panel added nothing at all.
 *
 *   FLOOR NOT MET, NARROWED SEARCH
 *     panel   opened with "המשחקים שייבאת הצביעו על X כמקום לבדוק בו, וזה נרשם מראש", which is
 *             what `.claim-prereg` renders ONE PARAGRAPH ABOVE IT in the same component. That is
 *             the worst of the three: not two surfaces agreeing, but one panel repeating itself.
 *
 *   FLOOR MET, NOTHING CLEARED
 *     ribbon  "יש מספיק החלטות, ואף דפוס לא עבר את הסף. זו תשובה ולא שתיקה."
 *     panel   "נבדקו 60 החלטות חשופות ולא נמצא דפוס שעובר את הסף. זו תשובה תקינה — ..."
 *
 * THE SPLIT IS DISTANCE VERSUS RULE. The ribbon owns how far THIS record is from a claim: it
 * changes every time a decision is revealed, and it sits above the fold where it is read. The
 * panel owns why the floor is where it is and what a result would be worth -- the same for every
 * player, every record, and unreadable anywhere else on the screen.
 *
 * Which makes the contract falsifiable in a way rewording cannot satisfy: THE PANEL'S LINE MUST
 * NOT VARY WITH THE RECORD, and the ribbon's must. One surviving count would break the first.
 */
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import { currentClaim, registerHypothesis, type ClaimView } from "../../shared/record-service";
import { loopPosition, remainingBeforeClaim } from "../../client/src/lib/loop-position";
import { MIN_BUCKET_N } from "../../shared/detector";

const NOW = { created_at: "2026-08-25T12:00:00.000Z" };

async function commit(store: MemoryRecordStore, id: string, index: number, reveal = true) {
  await store.commitDecision({
    decisionId: id,
    gameId: "g",
    fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
    ply: index,
    phase: index % 2 === 0 ? "opening" : "endgame",
    clockMsRemaining: 60_000,
    secondsTaken: 10,
    chosenMove: "a1b1",
    candidateMovesConsidered: ["a1b1"],
    statedRead: "r",
    statedUnknown: "u",
    confidence: 4,
    confidenceScale: CONFIDENCE_LEVELS,
    probeAssignment: "not-probed",
    legalMoves: 20,
  });
  if (reveal) {
    await store.recordReveal(id, {
      engine_eval_cp: 20,
      engine_best_move: "a1b1",
      engine_depth: 18,
      engine_source: "local_sf18",
      // Cycles on the index rather than on the phase, so no bucketing carries structure.
      cp_loss: index % 3 === 0 ? 10 : 90,
    });
  }
}

/** A record of `revealed` revealed decisions and `pending` awaiting reveal, and its claim view. */
async function recordOf(revealed: number, pending: number): Promise<ClaimView> {
  const store = new MemoryRecordStore();
  for (let i = 0; i < revealed; i += 1) await commit(store, `r-${i}`, i, true);
  for (let i = 0; i < pending; i += 1) await commit(store, `p-${i}`, revealed + i, false);
  return currentClaim(store, NOW);
}

/**
 * The ribbon's sentence for a claim view, derived exactly as `useLoopPosition` derives it.
 *
 * Duplicating the derivation rather than importing the hook because the hook needs a React tree
 * and three contexts; what is under test is the two STRINGS, and the arithmetic between them is
 * `remainingBeforeClaim`, which is imported rather than reimplemented.
 */
function ribbonText(view: ClaimView): string {
  const position = loopPosition({
    drill: null,
    recorded: view.recorded,
    scored: view.scored,
    claimGrade: view.claim?.grade ?? null,
    scoredStillNeeded: remainingBeforeClaim({
      scored: view.scored,
      preregScored: view.preregScored,
      unreadable: false,
    }),
    narrowedTo: view.prereg?.scope ?? null,
  });
  return `${position.headline} ${position.basis}`;
}

describe("the panel explains the rule; the ribbon carries the distance", () => {
  it("stops restating the counts once the record grows", async () => {
    /*
     * Two records that differ in every count. If a single per-record number survived in the
     * panel's line -- however it were phrased -- these two strings would differ.
     */
    const small = await recordOf(4, 2);
    const larger = await recordOf(21, 7);
    expect(small.reason, "the small record has no silence to explain").toBeTruthy();
    expect(larger.reason).toBeTruthy();
    expect(small.scored).not.toBe(larger.scored);
    expect(small.recorded).not.toBe(larger.recorded);
    expect(small.reason, "the panel is still counting this player's decisions").toBe(larger.reason);
  });

  it("keeps the distance moving on the ribbon, which is the half that must vary", async () => {
    // The mirror of the assertion above: a split that froze BOTH surfaces would pass that one.
    const small = await recordOf(4, 2);
    const larger = await recordOf(21, 7);
    expect(ribbonText(small)).not.toBe(ribbonText(larger));
    expect(ribbonText(small)).toContain(`${MIN_BUCKET_N * 2 - 4}`);
    expect(ribbonText(larger)).toContain(`${MIN_BUCKET_N * 2 - 21}`);
  });

  it("does not repeat the ribbon's clause about decisions awaiting reveal", async () => {
    const view = await recordOf(4, 2);
    expect(ribbonText(view), "the ribbon stopped carrying it").toContain("ממתינות לחשיפה");
    expect(view.reason, "the panel says it a second time").not.toContain("ממתינות לחשיפה");
  });

  it("still says the one thing the ribbon does not: why the floor is doubled", async () => {
    /*
     * A bucket is compared against the rest of the record, so it needs MIN_BUCKET_N decisions
     * inside it AND outside it. Nothing else on the screen says that, which is why this line
     * still earns its space instead of being deleted outright.
     */
    const view = await recordOf(4, 2);
    expect(view.reason).toContain(`${MIN_BUCKET_N}`);
    expect(view.reason).toContain(`${MIN_BUCKET_N * 2}`);
    expect(ribbonText(view), "the ribbon does not explain the floor").not.toContain("בתוך הדלי");
  });

  it("never upgrades a hypothesis to a finding, which is what the wait is FOR", async () => {
    // Carried over from the line this replaced: "ואפילו אז זו תהיה השערה".
    const view = await recordOf(4, 2);
    expect(view.reason).toContain("השערה");
  });
});

describe("the narrowed search stops repeating the paragraph above it", () => {
  async function narrowed(): Promise<ClaimView> {
    const store = new MemoryRecordStore();
    for (let i = 0; i < 3; i += 1) await commit(store, `before-${i}`, i, true);
    await registerHypothesis(store, {
      bucket_key: "phase-opening",
      scope: "החלטות בפתיחה",
      registered_at: NOW.created_at,
      evidence: {
        accurate_rate: 0.4,
        n: 40,
        runner_up_key: "phase-endgame",
        separation: 0.2,
        threshold: 0.1,
        games: 60,
      },
      refutation_condition: "אם לא יימצא פער בהחלטות בפתיחה",
    });
    for (let i = 0; i < 5; i += 1) await commit(store, `after-${i}`, 3 + i, true);
    return currentClaim(store, NOW);
  }

  it("leaves the scope to .claim-prereg, which renders it one paragraph above", async () => {
    /*
     * `ClaimPanel` renders "החיפוש מצומצם לX — הדלי שהמשחקים המיובאים הצביעו עליו, שנרשם לפני
     * שנרשמה כאן החלטה" whenever `prereg` is set -- on the claim AND on the silence. The reason
     * used to open by saying the same thing, so the panel introduced its own narrowing twice.
     */
    const view = await narrowed();
    expect(view.prereg?.scope, "the fixture did not narrow anything").toBe("החלטות בפתיחה");
    expect(view.reason).toBeTruthy();
    expect(view.reason!, "the silence reason names the bucket a second time").not.toContain(
      view.prereg!.scope,
    );
    expect(view.reason!, "and repeats how it was registered").not.toContain("הצביעו");
  });

  it("keeps the number that is the whole point of registering: the smaller floor", async () => {
    const view = await narrowed();
    expect(view.reason!).toContain("40");
    expect(view.reason!).toContain("60");
  });

  it("does not restate the distance the ribbon is already showing", async () => {
    const view = await narrowed();
    expect(ribbonText(view), "the ribbon lost the narrowed distance").toMatch(/עוד \d+/);
    expect(view.reason!, "the panel counts the wait too").not.toMatch(/חסרות עוד/);
  });
});

describe("an answered silence says why the threshold exists, not that it is an answer", () => {
  async function nothingCleared(): Promise<ClaimView> {
    const store = new MemoryRecordStore();
    // Above the floor, and deliberately structureless: cp_loss cycles on index, not on phase.
    for (let i = 0; i < MIN_BUCKET_N * 2 + 4; i += 1) await commit(store, `d-${i}`, i, true);
    return currentClaim(store, NOW);
  }

  it("leaves 'this is an answer, not silence' to the ribbon that already says it", async () => {
    const view = await nothingCleared();
    expect(view.claim, "the fixture produced a claim, so there is no silence to check").toBeNull();
    expect(view.reason).toBeTruthy();
    expect(ribbonText(view)).toContain("תשובה ולא שתיקה");
    expect(view.reason!, "the panel asserts it is an answer too").not.toContain("תשובה");
  });

  it("explains what the threshold is protecting against", async () => {
    /*
     * The part that is genuinely absent everywhere else: a gap that looks large in a small bucket
     * shrinks as decisions are added, and the threshold is sized so noise does not clear it.
     *
     * ASSERTED ON THE MECHANISM, NOT ON THE WORD. The first version of this checked only that
     * "רעש" appeared -- and a mutation that deleted the entire explanation still passed it,
     * because the word survives twice over in the sentence. Naming the threshold is not the
     * same as saying what it is for.
     */
    const view = await nothingCleared();
    expect(view.reason!).toContain("רעש");
    expect(view.reason!, "names the threshold without explaining it").toMatch(/מצטמצם/);
    expect(view.reason!, "does not say a small bucket is what inflates a gap").toMatch(/קטן/);
  });

  it("does not count the decisions it searched, because the basis already did", async () => {
    const view = await nothingCleared();
    expect(ribbonText(view)).toContain(`${MIN_BUCKET_N * 2 + 4}`);
    expect(view.reason!, "the panel counts them again").not.toMatch(/\d/);
  });
});

describe("the three silences still do not render alike", () => {
  it("gives a different reason for each, which is section 4.5", async () => {
    const store = new MemoryRecordStore();
    for (let i = 0; i < MIN_BUCKET_N * 2 + 4; i += 1) await commit(store, `d-${i}`, i, true);
    const reasons = [
      (await recordOf(4, 2)).reason,
      (await currentClaim(store, NOW)).reason,
    ].filter(Boolean);
    expect(reasons).toHaveLength(2);
    expect(new Set(reasons).size, "two different silences read identically").toBe(reasons.length);
  });
});
