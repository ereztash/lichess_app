/**
 * The raw-centipawn accuracy rule survived the migration to win-probability loss, in two places.
 *
 * `shared/detector.ts` records why the raw rule was abandoned: thirty centipawns is 2.76 points of
 * winning chances at a level position and 0.28 at +10.00, so "accurate" meant something different
 * depending on how the game stood, and calibration against an event that is not one event is
 * undefined. `scoreDecisions` migrated. Two call sites did not:
 *
 *   shared/record-service.ts  finishLearningTransfer  `atom.result.cp_loss <= ACCURATE_CP_LOSS`
 *   shared/import-diagnostic.ts                       `cpLoss <= ACCURATE_CP_LOSS`
 *
 * MEASURED before the fix — what the record calls accurate and those two called failure:
 *
 *     at eval     0: up to  30cp     at eval   300: up to  38cp
 *     at eval   500: up to  58cp     at eval  1000: up to 212cp
 *
 * AND THE TRANSFER'S VERDICT IS TERMINAL. Two sittings inside that band grade the player's own
 * learning rule `refuted`, `next_due_at` goes null, and `beginLearningTransfer` refuses every
 * later test — while the profile screen shows those same decisions as accurate. The rule is
 * killed by the evidence that supports it.
 *
 * WHY NO TEST CAUGHT IT, which is the part worth keeping. `tests/shared/import-diagnostic.test.ts`
 * asserted `d.accurate === (d.cpLoss <= ACCURATE_CP_LOSS)` — pinning the OLD rule by name — and
 * passed, because its fixture only ever produces `cpLoss` of 0 or 200 at an evaluation of 0 or
 * ±200, and those two values agree under both rules. An assertion satisfied by the fixture rather
 * than by the code, which is the exact failure this repository keeps finding in its own controls.
 * That test now asserts the real rule, and the band is covered here.
 */
import { describe, expect, it } from "vitest";
import {
  ACCURATE_CP_LOSS,
  ACCURATE_WIN_PROBABILITY_LOSS,
  accurateDecision,
} from "../../shared/detector";
import { winProbabilityLoss } from "../../shared/win-probability";

describe("what counts as accurate is one rule", () => {
  it("is the win-probability rule, against the evaluation the position stood at", () => {
    for (const [evalCp, cpLoss] of [
      [0, 10],
      [0, 400],
      [500, 55],
      [1000, 150],
    ] as const) {
      expect(accurateDecision(evalCp, cpLoss)).toBe(
        winProbabilityLoss(evalCp, cpLoss) <= ACCURATE_WIN_PROBABILITY_LOSS,
      );
    }
  });

  it("disagrees with the retired centipawn cut, and the band is wide", () => {
    /*
     * The whole reason this matters. If the two rules agreed everywhere, carrying the evaluation
     * around would be ceremony. They diverge by a factor of seven at a winning evaluation.
     */
    const widest = (evalCp: number) => {
      let last = 0;
      for (let cp = 0; cp <= 600; cp += 1) if (accurateDecision(evalCp, cp)) last = cp;
      return last;
    };
    expect(widest(0), "at a level position the two rules coincide, by construction").toBe(
      ACCURATE_CP_LOSS,
    );
    expect(widest(500)).toBeGreaterThan(ACCURATE_CP_LOSS);
    expect(widest(1000)).toBeGreaterThan(ACCURATE_CP_LOSS * 5);
  });

  it("never calls inaccurate a decision the retired rule called accurate", () => {
    /*
     * `ACCURATE_WIN_PROBABILITY_LOSS` is anchored at the peak rather than at zero precisely so the
     * change is a pure relaxation. Asserted here because the anchoring is a one-line expression
     * whose whole justification is this property.
     */
    for (let evalCp = -1500; evalCp <= 1500; evalCp += 25) {
      for (let cp = 0; cp <= ACCURATE_CP_LOSS; cp += 1) {
        expect(accurateDecision(evalCp, cp), `eval ${evalCp}, ${cp}cp`).toBe(true);
      }
    }
  });

  it("the import diagnostic reads a winning position by the same rule", async () => {
    /*
     * The second of the two sites, and it needs its own behavioural case for the same reason: a
     * fixture at a level evaluation cannot tell the two rules apart, which is exactly why the
     * existing import suite stayed green through the whole defect.
     *
     * White stands at +10.00 throughout and gives away 150cp on one move. The record's rule calls
     * that accurate at this evaluation; the retired centipawn cut calls it a failure. The import
     * screen's `דיוק` must agree with the record, because the bucket this screen picks is what
     * `registerHypothesis` pre-registers for the live detector to grade.
     */
    const { decisionsFromGame } = await import("../../shared/import-diagnostic");
    const FULL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const plies = 8;
    // A steady +10.00 that drops 150cp across White's third ply (index 2 -> index 3) and stays
    // there. White is the player, so only odd plies are their decisions.
    const evalScores = [1000, 1000, 1000, 850, 850, 850, 850, 850, 850];
    const decisions = decisionsFromGame({
      fens: Array.from({ length: plies + 1 }, () => FULL),
      evalScores,
      clockTimes: Array.from({ length: plies + 1 }, (_, i) => 600 - Math.floor(i / 2) * 20),
      playerColor: "w",
    });
    const dipped = decisions.find((d) => d.cpLoss === 150);
    expect(dipped, "fixture did not produce the 150cp move it is about").toBeDefined();
    expect(dipped!.cpLoss).toBeGreaterThan(ACCURATE_CP_LOSS);
    expect(
      accurateDecision(1000, 150),
      "fixture is outside the band; it would prove nothing",
    ).toBe(true);
    expect(
      dipped!.accurate,
      "the import screen called a decision inaccurate that the record scores accurate",
    ).toBe(true);
  });

  it("the learning transfer counts a decision the record calls accurate as a SUCCESS", async () => {
    /*
     * BEHAVIOURAL, NOT TEXTUAL. The first version of this assertion grepped the source for
     * `cp_loss <= ACCURATE_CP_LOSS` and passed its own positive control -- restoring the defect
     * with the literal `30` instead of the constant left it green. A test that only recognises one
     * spelling of a bug is a test satisfied by its own phrasing.
     *
     * So it is driven end to end instead: a player who recalls their own rule verbatim and plays
     * three moves at +10.00 that cost 150cp -- inside the band where the two rules disagree --
     * must be counted as having succeeded, because that is what the record's own scorer says
     * about those same three decisions.
     */
    const { MemoryRecordStore } = await import("../../server/record");
    const { CONFIDENCE_LEVELS } = await import("../../shared/confidence");
    const service = await import("../../shared/record-service");

    const EVAL_CP = 1000;
    const CP_LOSS = 150;
    // The fixture is only meaningful if it sits in the band. Guard it, or the test proves nothing.
    expect(CP_LOSS).toBeGreaterThan(ACCURATE_CP_LOSS);
    expect(accurateDecision(EVAL_CP, CP_LOSS), "fixture is outside the disagreement band").toBe(
      true,
    );

    const FENS = [
      "8/8/8/4k3/8/4K3/4P3/8 w - - 0 40",
      "8/8/8/4k3/8/4K3/4P3/8 b - - 0 41",
      "8/8/4k3/8/8/4K3/4P3/8 w - - 0 42",
      "8/8/4k3/8/4P3/4K3/8/8 b - - 0 43",
      "8/8/4k3/4P3/8/4K3/8/8 w - - 0 44",
      "8/4k3/8/4P3/8/4K3/8/8 b - - 0 45",
    ];
    const SOURCE = "11111111-1111-4111-8111-111111111111";
    const store = new MemoryRecordStore();

    const commit = async (id: string, fen: string) => {
      await store.commitDecision({
        decisionId: id,
        gameId: "g",
        fen,
        ply: 80,
        phase: "endgame",
        clockMsRemaining: 120_000,
        purpose: "play",
        secondsTaken: 40,
        chosenMove: "e2e4",
        candidateMovesConsidered: ["e2e4"],
        statedRead: "r",
        statedUnknown: "u",
        confidence: CONFIDENCE_LEVELS - 2,
        confidenceScale: CONFIDENCE_LEVELS,
        probeAssignment: "not-probed",
        legalMoves: 12,
        revealTiming: "per-decision",
      });
      await store.recordReveal(id, {
        engine_eval_cp: EVAL_CP,
        engine_best_move: "e2e4",
        engine_depth: 18,
        engine_source: "local_sf18",
        cp_loss: CP_LOSS,
      });
    };

    await commit(SOURCE, "8/8/8/8/8/4k3/4p3/4K3 w - - 0 60");
    await service.feedback(store, SOURCE, { revisedRead: "נלמד", wouldChooseAgain: false });
    const ACTION = "לפני מהלך רגלי בסיום, לספור טמפי";
    const { rule } = await service.createLearningRule(
      store,
      {
        reflection: { revised_read: "נלמד", would_choose_again: false },
        rule: {
          source_decision_id: SOURCE,
          trigger: "סיום רגלים",
          mechanism_class: "calculation",
          missed_signal: "טמפו",
          action_rule: ACTION,
          predicted_outcome: "אפסיק להפסיד טמפי",
          exception_rule: null,
          refutation_condition: "אם זה לא ישתפר בשלוש בדיקות — הכלל שגוי",
        },
      },
      { rule_id: "rule-accuracy", created_at: "2026-01-01T00:00:00.000Z" },
    );

    const begun = await service.beginLearningTransfer(
      store,
      { rule_id: rule.rule_id, candidate_fens: FENS },
      { transfer_id: "transfer-accuracy", started_at: "2026-01-05T09:00:00.000Z" },
    );
    expect(begun.transfer, begun.reason ?? "no transfer").not.toBeNull();

    for (const [index, fen] of begun.transfer!.fens.entries()) {
      const id = `t-${index}`;
      await commit(id, fen);
      await service.recordLearningTransferObservation(
        store,
        {
          transfer_id: begun.transfer!.transfer_id,
          // Verbatim recall, so the recall half of the criterion is never what fails.
          observation: { decision_id: id, recalled_rule: ACTION, applied_rule: true },
        },
      );
    }
    const done = await service.finishLearningTransfer(
      store,
      { transfer_id: begun.transfer!.transfer_id },
      { completed_at: "2026-01-05T10:00:00.000Z" },
    );

    expect(
      done.result.successes,
      "the transfer counted a failure on decisions the record scores accurate",
    ).toBe(begun.transfer!.fens.length);
    expect(done.rule.grade, "and so the rule was not refuted by evidence supporting it").not.toBe(
      "refuted",
    );
  });
});
