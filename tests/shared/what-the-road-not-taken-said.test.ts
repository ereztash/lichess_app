/**
 * Reading the four counterfactual readings back, and refusing to read them when there is nothing
 * to read.
 *
 * THIS FILE IS THE ANSWER TO THIS SESSION'S OWN RECURRING DEFECT, found nine times: the product
 * measures a distinction and discards it before display. Everything the probe collects has been
 * stored for three commits and no screen has said a word about it, which is that defect with the
 * measurement half finished.
 *
 * WHAT MAY BE SAID, AND IT IS LESS THAN IT LOOKS. Counts with their denominators, and nothing
 * else until there are enough. `MIN_BUCKET_N` is the same floor the rest of the record uses; a
 * rate computed from nine answers has a very confident-looking provenance and no content.
 *
 * THE RANDOMISATION CHECK IS A NEGATIVE CONTROL AND IT IS THE MOST USEFUL THING HERE. The arm is
 * drawn at COMMIT -- after the decision is complete and before the question is put -- so being in
 * the probed arm CANNOT have changed the accuracy of the decision it is attached to. There is no
 * causal path. A difference between arms on that decision is therefore either chance or a broken
 * randomisation, and it is the one comparison whose expected answer is known in advance. Anything
 * the product reports about the probe rests on it.
 */
import { describe, expect, it } from "vitest";
import { MIN_BUCKET_N } from "@shared/detector";
import { readCounterfactuals } from "@shared/counterfactual-reading";
import type { DecisionAtom, Probe } from "@shared/decision-atom";

const OPEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const probe = (over: Partial<Probe> = {}): Probe => ({
  assignment: "probed",
  legal_moves: 20,
  alternative: "d2d4",
  answered: true,
  alternative_cp_loss: 10,
  ...over,
});

const atom = (over: { probe?: Probe | null; cpLoss?: number; evalCp?: number } = {}): DecisionAtom => ({
  entry_state: { game_id: "g", fen: OPEN, ply: 0, phase: "opening", clock_ms_remaining: null },
  purpose: "play",
  known: "k",
  unknown: "u",
  // Null, not an empty pair: this fixture records no vocabulary, it does not assert silence.
  known_parts: null,
  unknown_parts: null,
  decision: "e2e4",
  bounded_action: { seconds_taken: 5, confidence: 4, confidence_scale: 7, candidate_moves_considered: [] },
  probe: over.probe === undefined ? probe() : over.probe,
  reveal_timing: "per-decision",
  /* Legacy-shaped on purpose: this fixture predates the protocol fields and claims nothing. */
  measurement_protocol: null,
  protocol_version: null,
  analysis_timing: null,
  result: {
    engine_eval_cp: over.evalCp ?? 15,
    engine_best_move: "e2e4",
    engine_depth: 14,
    engine_source: "local_sf18",
    engine_build: "sf18-test-build",
    cp_loss: over.cpLoss ?? 10,
  },
  feedback: null,
});

const many = (n: number, make: (i: number) => DecisionAtom) => Array.from({ length: n }, (_, i) => make(i));

describe("every decision lands in exactly one arm, and the arms are counted", () => {
  it("counts the three arms and the decisions that have none", () => {
    /*
     * FOUR NUMBERS, AND THE FOURTH IS NOT AN ARM. Decisions written before the probe existed were
     * never randomised into anything, and a report that folded them into the control would make
     * the control group look enormous and perfectly measured.
     */
    const reading = readCounterfactuals([
      atom(),
      atom({ probe: probe({ assignment: "not-probed", answered: false, alternative: null, alternative_cp_loss: null }) }),
      atom({ probe: probe({ assignment: "ineligible", answered: false, alternative: null, alternative_cp_loss: null }) }),
      atom({ probe: null }),
    ]);
    expect(reading.arms).toEqual({ probed: 1, "not-probed": 1, ineligible: 1, "no-arm": 1 });
  });

  it("adds up to the record it was given", () => {
    // A count that does not sum to the total has silently dropped a decision somewhere.
    const atoms = [atom(), atom({ probe: null }), atom({ probe: probe({ assignment: "ineligible" }) })];
    const { arms } = readCounterfactuals(atoms);
    expect(Object.values(arms).reduce((t, n) => t + n, 0)).toBe(atoms.length);
  });
});

describe("the four readings, each with the denominator it came out of", () => {
  it("classifies only the probes that were answered AND scored", () => {
    /*
     * THREE DIFFERENT NUMBERS THAT A SINGLE "probed" COUNT WOULD FUSE. Asked; asked and answered;
     * asked, answered with a move, and that move scored by the engine. Only the third can carry a
     * reading, and reporting the first as the denominator would divide by decisions that never
     * produced one.
     */
    const reading = readCounterfactuals([
      atom(),
      atom({ probe: probe({ answered: false, alternative: null, alternative_cp_loss: null }) }),
      atom({ probe: probe({ alternative: null, alternative_cp_loss: null }) }),
      atom({ probe: probe({ alternative_cp_loss: null }) }),
    ]);
    expect(reading.asked).toBe(4);
    expect(reading.answered).toBe(3);
    expect(reading.namedNothing).toBe(1);
    expect(reading.scored).toBe(1);
  });

  it("reads the move that was named and not played", () => {
    // chosen inaccurate, alternative accurate -- the Einstellung signature.
    const reading = readCounterfactuals([
      atom({ cpLoss: 300, probe: probe({ alternative_cp_loss: 10 }) }),
    ]);
    expect(reading.readings.reachable).toBe(1);
    expect(reading.readings.neither).toBe(0);
  });

  it("keeps the four apart", () => {
    const reading = readCounterfactuals([
      atom({ cpLoss: 10, probe: probe({ alternative_cp_loss: 10 }) }),
      atom({ cpLoss: 10, probe: probe({ alternative_cp_loss: 300 }) }),
      atom({ cpLoss: 300, probe: probe({ alternative_cp_loss: 10 }) }),
      atom({ cpLoss: 300, probe: probe({ alternative_cp_loss: 300 }) }),
    ]);
    expect(reading.readings).toEqual({ "both-good": 1, narrow: 1, reachable: 1, neither: 1 });
  });

  it("says nothing about a decision the engine never scored", () => {
    // R3's other side: no result means no reading, and a missing reading is not a `neither`.
    const noResult = { ...atom(), result: null };
    const reading = readCounterfactuals([noResult]);
    expect(reading.scored).toBe(0);
    expect(reading.readings.neither).toBe(0);
  });
});

describe("what may not be said yet", () => {
  it("refuses a rate below the record's own floor", () => {
    /*
     * The same `MIN_BUCKET_N` the rest of the record uses. A rate from nine answers is a number
     * with a confident-looking provenance and no content, and R1 forbids a claim wider than its
     * measurement.
     */
    const reading = readCounterfactuals(many(MIN_BUCKET_N - 1, () => atom()));
    expect(reading.measurable).toBe(false);
    expect(reading.shortBy).toBe(1);
  });

  it("allows one once there are enough scored answers", () => {
    const reading = readCounterfactuals(many(MIN_BUCKET_N, () => atom()));
    expect(reading.measurable).toBe(true);
    expect(reading.shortBy).toBe(0);
  });

  it("counts the floor against SCORED answers, not against decisions asked", () => {
    /*
     * The denominator the readings actually come out of. Counting asked-but-unanswered probes
     * toward the floor would open the rate on a record whose readings are still a handful.
     */
    const reading = readCounterfactuals(
      many(MIN_BUCKET_N * 2, () => atom({ probe: probe({ answered: false, alternative: null, alternative_cp_loss: null }) })),
    );
    expect(reading.measurable).toBe(false);
  });
});

describe("the randomisation check, whose answer is known before it is run", () => {
  it("reports both arms' accuracy so the null can be seen", () => {
    /*
     * THE NEGATIVE CONTROL. The arm is drawn at commit, after the decision is complete, so being
     * probed cannot have changed the accuracy of the decision it is attached to -- there is no
     * causal path from the arm to the outcome. Both arms should read the same, and a difference
     * is chance or a broken randomisation. It is reported rather than asserted because the
     * expected answer is "no difference", and a test that demanded one on a fixture would be
     * asserting the fixture.
     */
    const reading = readCounterfactuals([
      ...many(2, () => atom({ cpLoss: 10 })),
      ...many(2, () => atom({ cpLoss: 300, probe: probe({ assignment: "not-probed" }) })),
    ]);
    expect(reading.accuracyByArm.probed).toEqual({ accurate: 2, n: 2 });
    expect(reading.accuracyByArm["not-probed"]).toEqual({ accurate: 0, n: 2 });
  });

  it("leaves decisions with no arm out of both", () => {
    const reading = readCounterfactuals([atom({ probe: null }), atom({ probe: null })]);
    expect(reading.accuracyByArm.probed.n).toBe(0);
    expect(reading.accuracyByArm["not-probed"].n).toBe(0);
  });

  it("counts an unrevealed decision in its arm but not in the arm's accuracy", () => {
    /*
     * TWO DENOMINATORS THAT LOOK LIKE ONE. A decision the engine has not scored yet belongs to
     * its arm -- it was randomised, and dropping it would make the arm sizes wrong -- but it has
     * no accuracy, and counting it as inaccurate would charge the player for a search that has
     * not finished. Since decisions awaiting a reveal are the most RECENT ones, that error would
     * land almost entirely on whichever arm the player is currently in.
     *
     * The mutation that made `if (atom.result)` unconditional survived the first version of this
     * file: every fixture but one had a result, and the one that did not was only checked for its
     * reading. Ninth-and-tenth instance of an assertion satisfied by a fixture.
     */
    const unrevealed = { ...atom(), result: null };
    const reading = readCounterfactuals([unrevealed, atom()]);
    expect(reading.arms.probed).toBe(2);
    expect(reading.accuracyByArm.probed).toEqual({ accurate: 1, n: 1 });
  });
});
