// @vitest-environment jsdom
/**
 * The reason to take a second decision, which the product had never given.
 *
 * WHAT WAS STANDING IN FOR IT. The only continuation reason stated anywhere in this build lived in
 * the record: *"עוד N החלטות מדודות עד שאפשר לומר משהו"*. That sentence is correct, and it is
 * about what a CLAIM requires before a detector may speak. It is not about the player. Read as
 * motivation -- which is the only way it can be read at the foot of a reveal -- it is a countdown
 * to a locked thing, and this product refuses countdowns for the same reason it refuses streaks:
 * they make continuing about the number rather than about the chess.
 *
 * So there were two options and the build had neither: state the marginal value of one more
 * decision, or say nothing. It said the floor.
 *
 * THE SENTENCE THAT REPLACED THE ABSENCE. One more decision is a separate observation, and a
 * separate observation is the only thing that can turn "this happened" into "this happens". That
 * is true before any claim exists, it is true after every reveal branch, and it promises nothing:
 * a pattern may not be there.
 *
 * WHAT THIS FILE ASSERTS, and every one of these is a way the sentence could rot into a mechanic:
 * that it is identical after all five outcomes, that it contains no digit, that it never appears
 * before a decision is committed, and that it has not borrowed the record's denominators.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RevealPanel } from "@/components/RevealPanel";
import {
  CONTINUATION_CTA,
  CONTINUATION_PROPOSITION,
  ENGINE_NOISE_CP,
  MATERIAL_LOSS_CP,
  theOneThing,
  type RevealInputs,
} from "@shared/reveal";
import { CONFIDENCE_LEVELS } from "@shared/confidence";
import type { EngineLine } from "@/lib/stockfish";

const root = resolve(__dirname, "../..");
const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4";
const BASE: RevealInputs = {
  depth: 20,
  cpLoss: MATERIAL_LOSS_CP + 40,
  chosenMove: "g8f6",
  bestMove: "f8c5",
  chosenWasBest: false,
  confidence: null,
  confidenceScale: CONFIDENCE_LEVELS,
  statedUnknown: "",
  decisionsOnRecord: 120,
  candidatesConsidered: [],
};

/** All five outcomes: the four branches and both bands of silence. */
const OUTCOMES: Record<string, RevealInputs> = {
  "chose-past-it": { ...BASE, candidatesConsidered: ["g8f6", "f8c5"] },
  "confident-and-wrong": { ...BASE, confidence: CONFIDENCE_LEVELS },
  outplayed: BASE,
  "trusted-it-too-little": { ...BASE, cpLoss: ENGINE_NOISE_CP - 5, confidence: 1 },
  "silence, inside the noise": { ...BASE, cpLoss: ENGINE_NOISE_CP - 5, confidence: 4 },
  "silence, above the noise and below the line": { ...BASE, cpLoss: ENGINE_NOISE_CP + 20 },
};

const ANALYSIS: EngineLine = { scoreCp: 180, depth: 20, pv: ["f8c5"], bestMove: "f8c5", fen: FEN };
const panel = (inputs: RevealInputs) =>
  render(<RevealPanel inputs={inputs} analysis={ANALYSIS} fen={FEN} statedKnown="" />).container;

describe("the same proposition after every outcome", () => {
  it("covers both a finding and a silence, so the invariance below is not trivial", () => {
    const kinds = Object.values(OUTCOMES).map((inputs) => theOneThing(inputs)?.kind ?? "silence");
    expect(new Set(kinds).size, "the fixtures do not actually reach different outcomes").toBe(5);
  });

  it.each(Object.keys(OUTCOMES))("renders it after %s", (outcome) => {
    const text = panel(OUTCOMES[outcome]).querySelector(".reveal-continuation")?.textContent;
    expect(text, "an outcome ended with no reason to continue").toBe(CONTINUATION_PROPOSITION);
  });

  it("is a constant and not a function of anything about the player", () => {
    /*
     * THE INVARIANCE THAT MATTERS MOST, and the one a later "improvement" is most likely to break.
     * A proposition that got warmer after `chose-past-it` and cooler after silence would be
     * measuring the player and answering them -- and the acquisition trial would then be reading
     * its own copy back instead of measuring comprehension. Same string, every branch, every
     * record size.
     */
    const said = new Set(
      Object.values(OUTCOMES).flatMap((inputs) =>
        [1, 2, 30].map(
          (decisionsOnRecord) =>
            panel({ ...inputs, decisionsOnRecord }).querySelector(".reveal-continuation")
              ?.textContent,
        ),
      ),
    );
    expect(said.size, "the continuation sentence varies by outcome or by record size").toBe(1);
  });
});

describe("what the proposition may not become", () => {
  it("contains no number, because a number here is a countdown", () => {
    /*
     * "עוד 12 החלטות" is a progress bar written in words. It also answers a different question:
     * how much evidence a CLAIM needs, which belongs to the record and keeps its denominators
     * there.
     */
    expect(CONTINUATION_PROPOSITION).not.toMatch(/\d/);
  });

  it("uses no reward, unlock, streak or progress vocabulary", () => {
    for (const word of [
      /נותרו/,
      /עוד \d/,
      /רצף/,
      /נפתח|ייפתח|לפתוח/,
      /פרס|בונוס|נקוד/,
      /התקדמות|מד |אחוז/,
    ]) {
      expect(CONTINUATION_PROPOSITION, `${word} turns the reason into a mechanic`).not.toMatch(word);
    }
  });

  it("does not promise that a pattern is there", () => {
    /*
     * The branches that carry a pattern fire only when the record happens to contain the evidence
     * for them. "תגלו את הדפוס שלכם" would be a promise no build can keep, and a player who took
     * ten decisions and got silence on all ten would have been lied to rather than measured.
     */
    expect(CONTINUATION_PROPOSITION).not.toMatch(/תגלו|יתגלה|תראו את הדפוס|הדפוס שלך|בטוח ש/);
    expect(CONTINUATION_PROPOSITION, "the reason is a question, not a prediction").toMatch(/אם/);
  });

  it("does not borrow the record's measurement floor", () => {
    /*
     * TWO SENTENCES, TWO OWNERS. The floor says what a claim needs before a detector may speak and
     * lives in `loop-position.ts` with its denominators. This says what one more decision adds
     * before any claim exists. Neither may be written in the other's words -- the failure that
     * produces is a player reading a research threshold as a personal target.
     */
    const floor = readFileSync(resolve(root, "client/src/lib/loop-position.ts"), "utf8");
    expect(floor, "the floor sentence moved out of the record").toContain("החלטות מדודות");
    expect(CONTINUATION_PROPOSITION).not.toMatch(/מדודות|סף|בסוג אחד/);
  });
});

describe("the button names the experiment rather than the movement", () => {
  it("says what taking the decision is for", () => {
    expect(CONTINUATION_CTA).not.toBe("ההחלטה הבאה");
    expect(CONTINUATION_CTA, "the CTA describes navigation").not.toMatch(/הבא|המשך|קדימה|עוד אחת/);
  });

  it("shares its words with the proposition, so the two read as one idea", () => {
    /*
     * Not decoration. A button whose words appear nowhere in the sentence above it is a second
     * message; a reader has to work out for themselves that they are the same offer.
     */
    expect(CONTINUATION_PROPOSITION).toContain("חוזר");
    expect(CONTINUATION_CTA).toContain("חוזר");
  });

  it("can come back false, which is what makes it an experiment", () => {
    expect(CONTINUATION_CTA).toMatch(/לבדוק אם/);
  });

  it("sits next to the sentence that justifies it", () => {
    /*
     * MEASURED, NOT ASSUMED. The control lived only in the page header, which is not sticky: at
     * 390x844 the proposition renders around y=1200 of a 2715px page and the header button at
     * y=0, with the whole engine analysis column between them. A reason the reader cannot act on
     * where they read it is a reason that did not reach them.
     */
    const container = render(
      <RevealPanel
        inputs={OUTCOMES.outplayed}
        analysis={ANALYSIS}
        fen={FEN}
        statedKnown=""
        onContinue={() => {}}
      />,
    ).container;
    const button = container.querySelector(".reveal-continue");
    expect(button, "the reveal offers no way to take the decision it just argued for").not.toBeNull();
    expect(button?.textContent).toBe(CONTINUATION_CTA);
    const nodes = [...container.querySelectorAll(".reveal-continuation, .reveal-continue")];
    expect(nodes).toHaveLength(2);
    expect(
      nodes[0].classList.contains("reveal-continuation"),
      "the button comes before the reason for it",
    ).toBe(true);
  });

  it("offers nothing where there is nothing to offer", () => {
    // A panel rendered for inspection, or a transfer run with its own control, gets no button.
    expect(panel(OUTCOMES.outplayed).querySelector(".reveal-continue")).toBeNull();
  });

  it("is the label the reveal screen actually renders", () => {
    /*
     * ASSERTED AGAINST THE COMPONENT THAT RENDERS IT, which is now the only one. A constant nobody
     * uses is a sentence in a file, so this checks a render -- and it checks it where the render
     * is: `Home.tsx` used to carry a SECOND copy of this control in its header, both
     * `primary-control`, both calling `nextDecision`, under identical conditions. LAW 2 took it,
     * and `GATE-ONE-PRIMARY-ACTION` keeps it taken.
     */
    const reveal = readFileSync(resolve(root, "client/src/components/RevealPanel.tsx"), "utf8");
    expect(reveal).toContain("CONTINUATION_CTA");
    expect(reveal, "the navigation label is back on the post-reveal button").not.toMatch(
      /: "ההחלטה הבאה"/,
    );
    /* And there is exactly one of them in the product. */
    const home = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8");
    expect(home, "the header renders the continuation control again").not.toContain(
      "CONTINUATION_CTA",
    );
  });
});

describe("the proposition is post-commit only", () => {
  it("lives in the reveal panel and nowhere a decision has not been committed", () => {
    /*
     * STANDING CONSTRAINT, AND IT IS NOT ABOUT THIS SENTENCE. Nothing pre-commit may evaluate,
     * motivate or frame the decision the player is about to take -- that is the ordering the whole
     * record depends on. The reveal panel renders only after a commit, so the sentence is
     * structurally post-commit as long as it exists in exactly one place.
     */
    /*
     * COMMENTS STRIPPED, BECAUSE THE CLAIM IS ABOUT WHERE IT RENDERS. A note in another file
     * explaining why the sentence lives here is not a second place it is shown -- and this
     * assertion fired on exactly that: a comment in `Home.tsx` about which control sits under the
     * proposition. A test that cannot tell a rendering from a mention is one people work around by
     * not writing the note.
     */
    const rendered = (name: string) =>
      readFileSync(resolve(root, "client/src", name), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .includes("CONTINUATION_PROPOSITION");
    const wearers = readdirSync(resolve(root, "client/src"), { recursive: true, encoding: "utf8" })
      .filter((name) => /\.tsx?$/.test(name))
      .filter(rendered);
    expect(wearers, "the proposition is rendered somewhere other than the reveal").toEqual([
      "components/RevealPanel.tsx",
    ]);
  });
});
