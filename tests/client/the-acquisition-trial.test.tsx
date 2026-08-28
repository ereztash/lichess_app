// @vitest-environment jsdom
/**
 * The evidence the next trial runs on, held to the rule that makes it evidence.
 *
 * WHAT THE TRIAL HAS TO BE ABLE TO DISTINGUISH, because this is the list every assertion below
 * serves. Eight to thirty people arrive from a message with a link. When it is over we need to be
 * able to tell these apart:
 *
 *   nobody wanted the promise
 *   the promise brought the wrong expectation
 *   the first-use flow lost them
 *   the interaction did not communicate causality
 *   the reveal was generic
 *   the unique reveal happened and was not noticed
 *   it was noticed and was not worth continuing for
 *   it was understood and they wanted more
 *
 * Every one of those is a DIFFERENT pattern across the same seven observations. Collapse any two
 * observations and two of the outcomes above become the same row -- which is how a trial comes
 * back saying "it did not work" with nothing to act on.
 *
 * THE RULE THIS FILE ENFORCES ABOVE ALL OTHERS. An event records what happened; it never records
 * the conclusion. `user_understood_value` is not a slower way of writing this down, it is the
 * analysis done in advance and stored where nobody can check it.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { theOneThing, CONFIDENT_ENOUGH_TO_NAME, type RevealInputs } from "@shared/reveal";
import { CONFIDENCE_LEVELS, EVEN_ODDS_LEVEL } from "@shared/confidence";
import {
  ACQUISITION_ANGLES,
  ASK_AFTER_REVEALS,
  continuationStarted,
  prohibitedContent,
  readAcquisitionContext,
  shouldAskValueQuestion,
  UNKNOWN,
  type TrialEvent,
} from "@/lib/acquisition-evidence";
import {
  beginVisit,
  clearProgress,
  progress,
  progressReport,
  recordTrialEvent,
  revealsPresented,
} from "@/lib/progress-record";
import { RevealPanel } from "@/components/RevealPanel";
import { ValueReconstruction, VALUE_QUESTION } from "@/components/ValueReconstruction";

const root = resolve(__dirname, "../..");
const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4";

const BASE: RevealInputs = {
  cpLoss: 180,
  depth: 18,
  confidence: EVEN_ODDS_LEVEL,
  confidenceScale: CONFIDENCE_LEVELS,
  statedUnknown: "",
  chosenMove: "f8c5",
  chosenWasBest: false,
  candidatesConsidered: ["f8c5", "g8f6"],
  decisionsOnRecord: 12,
  clampedMate: false,
  bestMove: "g8f6",
};

/** The events of the current visit, in order. */
const events = (): TrialEvent[] => [...(progress()[progress().length - 1]?.events ?? [])];

beforeEach(() => {
  clearProgress();
  beginVisit();
});

describe("the acquisition context is read, never guessed", () => {
  it("keeps an absent angle absent", () => {
    /*
     * THE ASSERTION THE WHOLE COMPARISON RESTS ON. If an unlabelled arrival were filled in with
     * any angle at all, every organic visitor would be counted as evidence for it, and the
     * `angle x outcome` table the trial exists to produce would be an artefact of the default.
     */
    const context = readAcquisitionContext("");
    expect(context.angle).toBe(UNKNOWN);
    expect(context.source).toBe(UNKNOWN);
    expect(context.variant).toBe(UNKNOWN);
  });

  it("refuses a value that is not in the vocabulary rather than keeping the string", () => {
    // Otherwise `Selection`, `sel` and `A` become three cells nobody can reconcile at n=30.
    expect(readAcquisitionContext("?angle=Selection").angle).toBe(UNKNOWN);
    expect(readAcquisitionContext("?angle=whatever").angle).toBe(UNKNOWN);
    expect(readAcquisitionContext("?angle=selection").angle).toBe("selection");
  });

  it("bounds the one field an outside party writes", () => {
    /*
     * The variant travels in a link somebody else composes and ends up in a log a participant is
     * asked to paste into a message. A crafted value has no business in either.
     */
    expect(readAcquisitionContext(`?v=${"x".repeat(40)}`).variant).toBe(UNKNOWN);
    expect(readAcquisitionContext("?v=<script>").variant).toBe(UNKNOWN);
    expect(readAcquisitionContext("?v=post_3").variant).toBe("post_3");
  });

  it("offers no angle the acquisition contract does not cover", () => {
    // Three angles, three contracts in docs/ACQUISITION_EVIDENCE.md. A fourth added in code and
    // not in the doc is an arrival nobody can say what was promised to.
    const doc = readFileSync(resolve(root, "docs/ACQUISITION_EVIDENCE.md"), "utf8");
    for (const angle of ACQUISITION_ANGLES) {
      expect(doc, `the ${angle} angle has no contract`).toContain(`\`${angle}\``);
    }
  });
});

describe("no event is a judgement about a person", () => {
  it("has no name that states a conclusion", () => {
    /*
     * Scanned off the source rather than off a list here, because a list here would be a second
     * vocabulary that drifts. These are the names the brief names, and each of them is an
     * ANALYSIS: it has a denominator, it has a coding scheme, and it is somebody's judgement.
     * Stored as an event it would be the trial's conclusion written into the trial's data.
     */
    const source = readFileSync(resolve(root, "client/src/lib/acquisition-evidence.ts"), "utf8");
    const names = [...source.matchAll(/name:\s*"([a-z_]+)"/g)].map((m) => m[1]);
    expect(names.length, "no event names found; this assertion went blind").toBeGreaterThan(5);
    for (const forbidden of [
      "user_understood_value",
      "user_was_confused",
      "activation_succeeded",
      "unique_value_delivered",
      "user_liked_reveal",
      "user_is_engaged",
    ]) {
      expect(names, `${forbidden} is an analysis, not an observation`).not.toContain(forbidden);
    }
  });

  it("counts a milestone nowhere, because the ordinal already answers it", () => {
    // A `decision_milestone_reached` event would be a second, coarser copy of a number the
    // ledger already holds exactly -- and the shape a streak mechanic arrives in.
    const source = readFileSync(resolve(root, "client/src/lib/acquisition-evidence.ts"), "utf8");
    expect(source).not.toContain("milestone");
    recordTrialEvent({
      name: "decision_committed",
      at: "2026-08-28T10:00:00Z",
      decisionId: "d1",
      ordinal: 5,
      purpose: "play",
      confidenceAsked: false,
    });
    expect((events()[0] as { ordinal: number }).ordinal).toBe(5);
  });
});

describe("the reveal branch recorded is the reveal branch rendered", () => {
  const panel = (inputs: RevealInputs, decisionId: string | null) =>
    render(
      <RevealPanel inputs={inputs} analysis={null} fen={FEN} statedKnown="" decisionId={decisionId} />,
    );

  /** Four inputs that reach four different branches, plus the one that reaches none. */
  const CASES: Array<[string, RevealInputs]> = [
    ["chose-past-it", BASE],
    ["outplayed", { ...BASE, candidatesConsidered: ["f8c5", "d7d6"] }],
    [
      "confident-and-wrong",
      {
        ...BASE,
        candidatesConsidered: ["f8c5"],
        confidence: Math.ceil(CONFIDENT_ENOUGH_TO_NAME * CONFIDENCE_LEVELS),
      },
    ],
    ["trusted-it-too-little", { ...BASE, cpLoss: 4, chosenWasBest: true, bestMove: "f8c5", confidence: 1 }],
    ["silence", { ...BASE, cpLoss: 4, chosenWasBest: true, bestMove: "f8c5", confidence: EVEN_ODDS_LEVEL }],
  ];

  it.each(CASES)("records %s exactly as the panel computed it", (expected, inputs) => {
    /*
     * NOT A SECOND IMPLEMENTATION, and that is the point of comparing against `theOneThing` here
     * rather than against a literal. If the emitter ever re-derived the branch from the inputs,
     * this would still pass on the day it was written and start lying the first time a threshold
     * moved -- the panel showing one sentence, the ledger recording another, nothing failing.
     */
    panel(inputs, "d-kind");
    const kindEvent = events().find((event) => event.name === "reveal_kind_presented");
    expect(kindEvent, "no branch was recorded for a reveal that rendered").toBeTruthy();
    expect((kindEvent as { kind: string }).kind).toBe(expected);
    expect((kindEvent as { kind: string }).kind).toBe(theOneThing(inputs)?.kind ?? "silence");
  });

  it("counts silence as a branch rather than as an absence", () => {
    /*
     * The reveal-yield reading is a distribution over what the product actually said, and on an
     * accurate decision inside engine noise silence is the ONLY thing it can say. Leaving it out
     * would select the denominator on the outcome and make the product look differentiated far
     * more often than it is.
     */
    panel({ ...BASE, cpLoss: 4, chosenWasBest: true, bestMove: "f8c5" }, "d-silent");
    expect(theOneThing({ ...BASE, cpLoss: 4, chosenWasBest: true, bestMove: "f8c5" })).toBeNull();
    const kinds = events()
      .filter((event) => event.name === "reveal_kind_presented")
      .map((event) => (event as { kind: string }).kind);
    expect(kinds).toEqual(["silence"]);
  });

  it("records one reveal per decision however many times the panel re-renders", () => {
    // Every rate in the funnel has this as a denominator; a double count inflates all of them.
    const view = panel(BASE, "d-once");
    view.rerender(
      <RevealPanel inputs={BASE} analysis={null} fen={FEN} statedKnown="" decisionId="d-once" />,
    );
    view.rerender(
      <RevealPanel inputs={{ ...BASE }} analysis={null} fen={FEN} statedKnown="" decisionId="d-once" />,
    );
    expect(events().filter((event) => event.name === "reveal_presented")).toHaveLength(1);
    expect(revealsPresented()).toBe(1);
  });

  it("records nothing for a panel rendered without a decision behind it", () => {
    // A reveal that cannot name its decision cannot be joined to a commit, so it would enter the
    // funnel as a stage with no denominator. Every isolated render in the suite is one of these.
    panel(BASE, null);
    expect(events()).toHaveLength(0);
  });
});

describe("continuation is an act, not a location", () => {
  it("is not started by being on the board before any reveal", () => {
    expect(
      continuationStarted({ movePlaced: true, revealsPresented: 0, alreadyRecorded: false }),
      "the first decision of the session was counted as a continuation",
    ).toBe(false);
  });

  it("is not started by a render with no move placed", () => {
    expect(continuationStarted({ movePlaced: false, revealsPresented: 2, alreadyRecorded: false })).toBe(
      false,
    );
  });

  it("is started by placing a move after a reveal, once", () => {
    expect(continuationStarted({ movePlaced: true, revealsPresented: 1, alreadyRecorded: false })).toBe(
      true,
    );
    expect(continuationStarted({ movePlaced: true, revealsPresented: 1, alreadyRecorded: true })).toBe(
      false,
    );
  });
});

describe("the one question, and what it may not do", () => {
  const mount = (reveals: number) => render(<ValueReconstruction revealsPresented={reveals} />);

  it("says nothing before the rule is met", () => {
    const { container } = mount(ASK_AFTER_REVEALS - 1);
    expect(container.textContent).toBe("");
    expect(events()).toHaveLength(0);
  });

  it("appears once and never again in the same browser", () => {
    mount(ASK_AFTER_REVEALS);
    expect(screen.getByText(VALUE_QUESTION)).toBeTruthy();
    expect(events().filter((event) => event.name === "value_reconstruction_prompted")).toHaveLength(1);

    // A second session: the ledger remembers it was asked, so it is not asked again.
    beginVisit();
    const again = mount(ASK_AFTER_REVEALS + 3);
    expect(again.container.textContent, "the question came back on a later visit").toBe("");
  });

  it("stores exactly what was typed", () => {
    mount(ASK_AFTER_REVEALS);
    const written = "המנוע פשוט הראה לי את המהלך הכי טוב";
    fireEvent.change(screen.getByLabelText(VALUE_QUESTION), { target: { value: written } });
    fireEvent.click(screen.getByRole("button", { name: "שליחה" }));
    const submitted = events().find((event) => event.name === "value_reconstruction_submitted");
    expect(submitted).toBeTruthy();
    expect((submitted as { answer: string }).answer).toBe(written);
    /*
     * A NEGATIVE RESULT KEPT INTACT. That sentence says the player reconstructed ordinary engine
     * value and nothing else -- which is the finding, and the trial is worth running because it
     * can come back. Nothing here scores it, labels it or shortens it; the coding happens offline
     * against preregistered categories, and it is stored apart from this string.
     */
    expect((submitted as { outcome: string }).outcome).toBe("answered");
  });

  it("does not code a dismissal as an answer", () => {
    /*
     * "לא עכשיו" is an interruption, a closed tab, or somebody who does not like typing. Coded as
     * "no value articulated" it would become evidence about the product out of a click that
     * carries none.
     */
    mount(ASK_AFTER_REVEALS);
    fireEvent.click(screen.getByRole("button", { name: "לא עכשיו" }));
    const submitted = events().find((event) => event.name === "value_reconstruction_submitted") as {
      outcome: string;
      answer: string | null;
    };
    expect(submitted.outcome).toBe("dismissed");
    expect(submitted.answer).toBeNull();
  });

  it("cannot be sent empty, so silence and a blank are never the same row", () => {
    mount(ASK_AFTER_REVEALS);
    fireEvent.change(screen.getByLabelText(VALUE_QUESTION), { target: { value: "   " } });
    expect((screen.getByRole("button", { name: "שליחה" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("asks without naming the answer", () => {
    /*
     * THE VALIDITY ASSERTION FOR THE WHOLE QUALITATIVE ARM. A question that names the mechanism
     * -- "did you notice the move was already on your board?" -- teaches the reply and then
     * records it as though the player produced it, and every coded answer afterwards is a
     * measurement of the prompt. The reveal branches, the word for the product's own finding, and
     * any praise of what was shown are all out for the same reason.
     */
    for (const leading of [
      /הבנת/,
      /שמת לב/,
      /ראית/,
      /מעניין/,
      /שיקול/,
      /ביטחון/,
      /דפוס/,
      /האם זה עזר/,
      /מועיל/,
      /\d\s*-\s*\d/,
    ]) {
      expect(VALUE_QUESTION, `the question leads: ${leading}`).not.toMatch(leading);
    }
    // And it is a question about what they RECEIVED, against the comparison the trial is about.
    expect(VALUE_QUESTION).toContain("ניתוח רגיל");
  });

  it("is not a rating scale wearing a textarea", () => {
    mount(ASK_AFTER_REVEALS);
    const radios = screen.queryAllByRole("radio");
    expect(radios, "the free-text answer grew a scale").toHaveLength(0);
    expect(screen.getByLabelText(VALUE_QUESTION).tagName).toBe("TEXTAREA");
  });
});

describe("what the ledger may not carry", () => {
  it("refuses a board position in any field but the answer", () => {
    /*
     * The type already makes this unrepresentable. The runtime guard exists because the ledger is
     * serialised to JSON and pasted into a message by a participant: the cost of a leak is not a
     * bad row, it is somebody's game sitting in a chat log.
     */
    const smuggled = {
      name: "first_position_presented",
      at: "2026-08-28T10:00:00Z",
      purpose: "play",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    } as unknown as TrialEvent;
    expect(prohibitedContent(smuggled)).toMatch(/prohibited field: fen/);
    expect(() => recordTrialEvent(smuggled)).toThrow(/acquisition evidence refused/);
    expect(events(), "the refused event was written anyway").toHaveLength(0);
  });

  it("refuses a username on a generic event", () => {
    const smuggled = {
      name: "acquisition_entry",
      at: "2026-08-28T10:00:00Z",
      context: { angle: "selection", source: "dm", variant: "x" },
      returning: false,
      username: "ereztash",
    } as unknown as TrialEvent;
    expect(prohibitedContent(smuggled)).toMatch(/prohibited field: username/);
    expect(() => recordTrialEvent(smuggled)).toThrow();
  });

  it("keeps a player's own words even when they write a variation in them", () => {
    // The answer is theirs. A guard that stripped chess out of it would be editing the evidence.
    const answer = "ראיתי שהמהלך rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 היה שם";
    expect(
      prohibitedContent({
        name: "value_reconstruction_submitted",
        at: "2026-08-28T10:00:00Z",
        outcome: "answered",
        answer,
      }),
    ).toBeNull();
  });

  it("prints the log with no rate, no funnel and no verdict in it", () => {
    /*
     * A report that computed "reached stage 4 of 5" would hand whoever reads it a denominator
     * somebody would have to defend and nobody chose. The rows are the evidence.
     */
    recordTrialEvent({
      name: "acquisition_entry",
      at: "2026-08-28T10:00:00Z",
      context: { angle: "selection", source: "dm", variant: "post_3" },
      returning: false,
    });
    recordTrialEvent({ name: "reveal_presented", at: "2026-08-28T10:01:00Z", decisionId: "d1" });
    const report = progressReport();
    expect(report).toContain("acquisition_entry");
    expect(report).toContain("angle=selection");
    expect(report, "the report computed a rate").not.toMatch(/%/);
    expect(report, "the report drew a conclusion").not.toMatch(/הצליח|נכשל|activation|converted/i);
  });
});

describe("no third-party telemetry was installed to do any of this", () => {
  it("adds no analytics, replay or survey dependency", () => {
    /*
     * The product tells players the record stays in their browser. A replay SDK, a product
     * analytics SDK or a hosted survey widget would each make that false, and the decision to
     * make it false belongs to the owner rather than to a convenient import. The reasoning for
     * every candidate -- PostHog, OpenReplay, rrweb, Formbricks, GrowthBook -- is in
     * docs/ACQUISITION_EVIDENCE.md.
     */
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const installed = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    for (const vendor of [
      "posthog",
      "openreplay",
      "rrweb",
      "formbricks",
      "growthbook",
      "mixpanel",
      "amplitude",
      "@sentry/replay",
      "logrocket",
      "hotjar",
    ]) {
      expect(
        installed.filter((name) => name.toLowerCase().includes(vendor)),
        `${vendor} was installed without the privacy decision being made`,
      ).toEqual([]);
    }
  });

  it("sends the ledger nowhere", () => {
    /*
     * Asserted over the source of every file that touches the trial log: no fetch, no beacon, no
     * image ping. Handing it over stays an act a person performs from the self-check drawer.
     */
    const files = ["client/src/lib/progress-record.ts", "client/src/lib/acquisition-evidence.ts"];
    for (const file of files) {
      const source = readFileSync(resolve(root, file), "utf8");
      for (const exfiltration of ["fetch(", "sendBeacon", "XMLHttpRequest", "new Image("]) {
        expect(source, `${file} sends the trial log somewhere`).not.toContain(exfiltration);
      }
    }
  });

  it("keeps the angle out of everything that decides what the player sees", () => {
    /*
     * SECTION 30, AS AN IMPORT-GRAPH ASSERTION. Telemetry may not modify the product being
     * measured: no different reveal by angle, no different position, no different sentence. The
     * three writers are allowed to name the module; nothing that chooses a position, computes a
     * reading or renders a finding may.
     */
    const ALLOWED = new Set([
      "client/src/App.tsx",
      "client/src/pages/Home.tsx",
      "client/src/components/ValueReconstruction.tsx",
      "client/src/lib/acquisition-evidence.ts",
      "client/src/lib/progress-record.ts",
    ]);
    const sources = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...sources(full));
        else if ([".ts", ".tsx"].includes(extname(full))) out.push(full);
      }
      return out;
    };
    const importers = ["client/src", "shared", "server"]
      .flatMap((dir) => sources(resolve(root, dir)))
      .filter((file) => /from\s+["'][^"']*acquisition-evidence/.test(readFileSync(file, "utf8")))
      .map((file) => relative(root, file).replaceAll("\\", "/"));
    for (const file of importers) {
      expect(ALLOWED.has(file), `${file} can see the acquisition angle`).toBe(true);
    }
  });
});
