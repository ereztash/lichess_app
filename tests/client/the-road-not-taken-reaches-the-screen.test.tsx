// @vitest-environment jsdom
/**
 * The probe's readings, RENDERED -- not grepped for.
 *
 * WHY A RENDER AND NOT A SOURCE SCAN. This session already made that mistake once: the phase
 * caveat was checked by grepping `RecordDashboard.tsx` for two identifier names, and a mutation
 * that rewrote the caveat's opening sentence PASSED, because the interpolations were still in the
 * source while the sentence no longer said what the figures meant. A claim reaches a screen or it
 * does not, and only a render can tell.
 *
 * AND THIS IS THE STEP THE WHOLE PROBE DEPENDED ON. Collecting an arm on every decision, an
 * answer on the probed ones and a price on the answered ones is not a measurement until something
 * reads it back. A distinction measured and discarded before display is this session's recurring
 * defect, found nine times.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CounterfactualPanel } from "../../client/src/components/CounterfactualPanel";
import { readCounterfactuals } from "@shared/counterfactual-reading";
import { MIN_BUCKET_N } from "@shared/detector";
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

const atom = (over: { probe?: Probe | null; cpLoss?: number } = {}): DecisionAtom => ({
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
    engine_eval_cp: 15,
    engine_best_move: "e2e4",
    engine_depth: 14,
    engine_source: "local_sf18",
    cp_loss: over.cpLoss ?? 10,
  },
  feedback: null,
});

const show = (atoms: DecisionAtom[]) =>
  render(<CounterfactualPanel reading={readCounterfactuals(atoms)} />);

const many = (n: number, make: () => DecisionAtom) => Array.from({ length: n }, make);

describe("with nothing collected yet", () => {
  it("says so instead of rendering an empty list", () => {
    // R2: an unmeasured thing must not render as a measured one, and a blank panel is
    // indistinguishable from a broken one.
    show([]);
    expect(document.body.textContent).toMatch(/עדיין לא נשאלתם/);
  });

  it("shows no percentage anywhere", () => {
    show([]);
    expect(document.body.textContent).not.toMatch(/\d+%/);
  });
});

describe("with answers but not enough of them", () => {
  const few = () => show(many(3, () => atom({ cpLoss: 300, probe: probe({ alternative_cp_loss: 10 }) })));

  it("prints the count with its denominator and no rate", () => {
    /*
     * THE ASSERTION R1 IS ABOUT. Three out of three is 100%, and rendering it as 100% would put a
     * figure on screen whose provenance the reader cannot see.
     */
    few();
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/3\s*מתוך\s*3/);
    expect(text, "a rate appeared below the record's own floor").not.toMatch(/\d+%\s*\(/);
  });

  it("says how many more are needed, rather than going quiet", () => {
    few();
    expect(document.body.textContent).toMatch(new RegExp(`עוד\\s*${MIN_BUCKET_N - 3}`));
  });

  it("names the reading the instrument exists for", () => {
    /*
     * `reachable` -- a better move named after the commitment. Asserted as the SENTENCE and not as
     * a key, because a key can survive a rewrite that removes the meaning, which is exactly how
     * the phase caveat passed a test while saying nothing.
     */
    few();
    expect(screen.getByText(/המהלך שנקבתם אחרי הרישום היה טוב יותר/)).toBeTruthy();
  });

  it("claims nothing about the player, only about the two moves", () => {
    /*
     * The standing constraint: the product must not say more about the player than it measured.
     * A sentence about knowing, seeing, or talking oneself out of a move is an account of a mind;
     * what happened is that two moves were compared.
     */
    few();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/ידעת|ראית|החמצת|שכנעת את עצמך|היית צריך/);
  });
});

describe("once there are enough", () => {
  it("states a rate, with the fraction beside it", () => {
    show(many(MIN_BUCKET_N, () => atom({ cpLoss: 300, probe: probe({ alternative_cp_loss: 10 }) })));
    expect(document.body.textContent).toMatch(new RegExp(`100%\\s*\\(${MIN_BUCKET_N}/${MIN_BUCKET_N}\\)`));
  });

  it("stops asking for more", () => {
    show(many(MIN_BUCKET_N, () => atom()));
    expect(document.body.textContent).not.toMatch(/עוד \d+ חלופות/);
  });
});

describe("the three denominators stay three", () => {
  it("separates asked, answered and scored on screen", () => {
    /*
     * A single "probed" number would fuse them, and the readings would then be divided by
     * decisions that never produced one.
     */
    show([
      atom(),
      atom({ probe: probe({ answered: false, alternative: null, alternative_cp_loss: null }) }),
      atom({ probe: probe({ alternative: null, alternative_cp_loss: null }) }),
      atom({ probe: probe({ alternative_cp_loss: null }) }),
    ]);
    const text = (document.body.textContent ?? "").replace(/\s+/g, " ");
    expect(text).toMatch(/נשאלתם ב־4/);
    expect(text).toMatch(/עניתם ב־3/);
    expect(text).toMatch(/ב־1 מהן נקבתם מהלך שהמנוע תמחר/);
  });

  it("says that only the scored ones feed the readings", () => {
    show([atom()]);
    expect(document.body.textContent).toMatch(/רק הן נכנסות לקריאות/);
  });
});

describe("the randomisation check is on the screen, not just in the code", () => {
  it("shows both arms and says they should match", () => {
    /*
     * The arm is drawn after the decision is complete, so it cannot have changed that decision.
     * A player looking at their own numbers is entitled to know which comparison is the one that
     * is supposed to come out empty -- otherwise a chance difference reads as a finding.
     */
    show([atom(), atom({ probe: probe({ assignment: "not-probed" }) })]);
    expect(document.body.textContent).toMatch(/אמורים לצאת דומים/);
    expect(document.body.textContent).toMatch(/אחרי שההחלטה ננעלה/);
  });
});
