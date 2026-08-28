// @vitest-environment jsdom
/**
 * GATE-REACHABILITY: from an empty record, a new person can reach the thing the product measures;
 * and no test is promised that the protocol cannot run.
 *
 * WHY THIS IS A CATEGORY THE OTHER NINE GATES DO NOT COVER. Every gate here so far asks "is this
 * component correct?" -- and every one of them can pass while the product is a dead end, because
 * a dead end is not a broken part. It is a set of correct parts that do not compose. The suite had
 * 1,582 passing tests, ten green gates and ten red controls on a build where a newcomer's front
 * door produced a decision carrying no confidence three times in four, leaving `scored` at zero,
 * leaving the shared bank locked behind `scored > 0`, and returning them to the same screen that
 * had just sent them out. No local invariant was wrong. That is the whole point.
 *
 * The distinction is the one between correctness and LIVENESS in a distributed protocol: every
 * message handler can be right while the system never makes progress. These are progress
 * assertions.
 *
 * TWO CLAIMS, AND THEY ARE THE SAME CLAIM AT TWO SCALES.
 *
 *   1. THE FRONT DOOR REACHES A MEASUREMENT. Walked through the real modules -- the handoff store,
 *      the purpose rule, the commit builder, the scorer -- with nothing between them stubbed. What
 *      is asserted at the end is `summary.scored === 1`, which is the precise condition the Record
 *      page gates the rest of the product on.
 *
 *   2. NO BUCKET IS PROMISED A TEST THE PROTOCOL CANNOT RUN. Preregistration relaxes the
 *      threshold from 30 to 20 in exchange for naming the bucket in advance. A bucket the live
 *      loop cannot fill turns that into a countdown that never ends, and the screen goes on
 *      saying "40 more decisions" forever.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { BUCKETINGS, MIN_BUCKET_N } from "@shared/detector";
import { isRegistrableBucket } from "@shared/prereg";
import { LIVE_DECISION_CARRIES_CLOCK, collectibleInLiveLoop } from "@shared/live-acquisition";
import { ANCHOR_POSITIONS } from "@shared/anchor-set";
import { classifyPhase } from "@shared/phase";
import { CONFIDENCE_LEVELS } from "@shared/confidence";
import { scoreDecisions } from "@shared/scoring";
import type { DecisionAtom } from "@shared/decision-atom";
import { buildCommitEvent, emptyDraft } from "@/lib/decision-session";
import { readPosition, writePosition } from "@/lib/session-position";
import { confidenceIsAsked, type DecisionPurpose } from "@shared/confidence-asked";

const HOME = resolve(__dirname, "../../client/src/pages/Home.tsx");

/**
 * The position the front door hands over: a real game, past the opening, from the player's own
 * history. Six plies of Italian, decided on at ply 6 -- the same shape `pickFirstDecision` emits.
 */
const HANDOFF = {
  sans: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"],
  ply: 5,
  source: "finished" as const,
  orientation: "w" as const,
  opponent: null,
  gameId: "lichess-first",
  revealTiming: "per-decision" as const,
  firstDecisionPly: 6,
};

const FEN = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";

describe("GATE-REACHABILITY: a new person can reach a measurement", () => {
  beforeEach(() => localStorage.clear());

  it("carries the front door's handoff to a decision that states a confidence", () => {
    /*
     * The chain, one link at a time, through the shipped modules. Every step here is the real
     * function: a stub anywhere in the middle would be asserting that the chain works if it works.
     */
    writePosition(HANDOFF);
    const restored = readPosition();
    expect(restored, "the handoff did not survive the trip to the board").not.toBeNull();

    // The board derives the decision's ply as the shown ply plus one; that is the stamped one.
    const decisionPly = restored!.ply + 1;
    const purpose: DecisionPurpose =
      decisionPly === restored!.firstDecisionPly ? "first" : "play";
    expect(purpose, "the handoff reached the board and the board called it ordinary play").toBe(
      "first",
    );

    expect(
      confidenceIsAsked({ purpose, gameId: restored!.gameId, fen: FEN, ply: decisionPly }),
      "the front door asked nothing, so the newcomer's one decision measures nothing",
    ).toBe(true);

    const event = buildCommitEvent(
      "11111111-1111-4111-8111-111111111111",
      {
        gameId: restored!.gameId,
        fen: FEN,
        ply: decisionPly,
        clockMsRemaining: null,
        purpose,
      },
      /*
       * Four required answers on a newcomer's first decision: the move, what they could read,
       * what they could not, and -- now -- how sure they were. The last is what this gate is
       * about; the middle two are R3's ordering and are required of every decision in the product.
       */
      {
        ...emptyDraft(),
        chosenMove: "e1g1",
        knownTags: ["המרכז פתוח"],
        unknownTags: ["לא יודע איך הוא יענה"],
        confidence: 5,
      },
      31.2,
      restored!.revealTiming,
    );
    expect(event.bounded_action.confidence, "the commit wrote no confidence").toBe(5);

    /*
     * The reveal the engine writes. Scoring needs it -- a decision awaiting a reveal is a wait,
     * not a measurement -- and it is the last link before the number the Record page gates on.
     */
    const atom = {
      ...event,
      result: {
        engine_eval_cp: 20,
        engine_best_move: "e1g1",
        engine_depth: 18,
        engine_source: "local_sf18" as const,
        cp_loss: 0,
      },
      feedback: null,
      probe: event.probe ?? null,
      reveal_timing: event.reveal_timing ?? null,
      bounded_action: { ...event.bounded_action, confidence_scale: CONFIDENCE_LEVELS },
    } as unknown as DecisionAtom;

    const summary = scoreDecisions([atom], [event.decision_id]);
    expect(
      summary.scored,
      "one decision through the whole front door and the record still reads empty",
    ).toHaveLength(1);
    expect(summary.withoutConfidence).toBe(0);
  });

  it("carries the OTHER front door -- the board with no handoff at all -- to the same place", () => {
    /*
     * THE ROUTE THIS GATE DID NOT WALK, AND IT IS THE ONE MOST ARRIVALS TAKE.
     *
     * `Record`'s header carries `ללוח`, a bare `navigate("/play")` with no handoff written. It is
     * the first interactive element on the front door and the only one that does not require a
     * username, so it is the whole route for anyone without an account. The board it lands on is
     * a live game at the opening position -- and that board went through neither `newGame` (which
     * sets `firstDecisionPly` to 0 and says why) nor the handoff (which sets it to the ply it
     * means). It ran on the component's own `useState` initial value.
     *
     * Walked in Chromium from an empty profile: the stored atom came back `purpose: "play"`,
     * `confidence: null`, and the record read `0 נמדדו מתוך 1 שנרשמו`. Every local invariant was
     * satisfied. The gate above was green. It is the same liveness failure this file was written
     * for, one door along -- which is why the fix is a second walk rather than a second assertion
     * inside the first.
     *
     * THE TWO DEFAULTS ARE READ OFF THE SOURCE, not restated here, for the reason the clock
     * assertion below gives: a stated fact drifts. What the rule compares is `currentPly + 1`
     * against `firstDecisionPly`, so both halves have to come from the file that renders them or
     * the comparison is a fixture agreeing with itself.
     */
    const source = ts.createSourceFile(
      "Home.tsx",
      readFileSync(HOME, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    /** The literal a `useState` is initialised with, for one destructured state name. */
    const initialOf = (name: string): number | null | undefined => {
      let found: number | null | undefined;
      const walk = (node: ts.Node): void => {
        if (
          ts.isVariableDeclaration(node) &&
          ts.isArrayBindingPattern(node.name) &&
          node.name.elements.some(
            (el) => ts.isBindingElement(el) && ts.isIdentifier(el.name) && el.name.text === name,
          ) &&
          node.initializer &&
          ts.isCallExpression(node.initializer)
        ) {
          const [arg] = node.initializer.arguments;
          if (!arg) found = undefined;
          else if (arg.kind === ts.SyntaxKind.NullKeyword) found = null;
          else if (ts.isNumericLiteral(arg)) found = Number(arg.text);
          else if (ts.isPrefixUnaryExpression(arg) && ts.isNumericLiteral(arg.operand)) {
            found = arg.operator === ts.SyntaxKind.MinusToken
              ? -Number(arg.operand.text)
              : Number(arg.operand.text);
          }
        }
        ts.forEachChild(node, walk);
      };
      walk(source);
      return found;
    };

    const currentPly = initialOf("currentPly");
    const firstDecisionPly = initialOf("firstDecisionPly");
    expect(typeof currentPly, "no currentPly state in Home; this assertion went blind").toBe(
      "number",
    );

    // `Home` derives it exactly this way, and nothing else in the component decides it.
    const decisionPly = (currentPly as number) + 1;
    const purpose: DecisionPurpose = decisionPly === firstDecisionPly ? "first" : "play";
    expect(
      purpose,
      "the board every account-less arrival lands on calls its opening decision ordinary play",
    ).toBe("first");

    const gameId = "live-1787903252462";
    const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(
      confidenceIsAsked({ purpose, gameId, fen: START, ply: decisionPly }),
      "the account-less route asked nothing, so its one decision measures nothing",
    ).toBe(true);

    /*
     * AND THE SAME POSITION UNDER THE OTHER PURPOSE IS THE CONTROL, in the same test rather than
     * in a mutation: this exact game, position and ply is one the draw passes over. So the
     * assertion above is not passing because the sampler happened to say yes here -- it is
     * passing because `first` is in `ALWAYS`.
     */
    expect(
      confidenceIsAsked({ purpose: "play", gameId, fen: START, ply: decisionPly }),
      "the draw says yes on this position anyway; the assertion above proves nothing",
    ).toBe(false);

    const event = buildCommitEvent(
      "11111111-1111-4111-8111-222222222222",
      { gameId, fen: START, ply: decisionPly, clockMsRemaining: null, purpose },
      { ...emptyDraft(), chosenMove: "e2e4", confidence: 5 },
      12.4,
      "per-decision",
    );
    const atom = {
      ...event,
      result: {
        engine_eval_cp: 33,
        engine_best_move: "e2e4",
        engine_depth: 14,
        engine_source: "local_sf18" as const,
        cp_loss: 0,
      },
      feedback: null,
      probe: event.probe ?? null,
      reveal_timing: event.reveal_timing ?? null,
      bounded_action: { ...event.bounded_action, confidence_scale: CONFIDENCE_LEVELS },
    } as unknown as DecisionAtom;

    const summary = scoreDecisions([atom], [event.decision_id]);
    expect(
      summary.scored,
      "one decision through the account-less door and the record still reads empty",
    ).toHaveLength(1);
    expect(summary.withoutConfidence).toBe(0);
  });

  it("holds the shared bank behind exactly the condition the chain above satisfies", () => {
    /*
     * The gate's own premise, asserted rather than assumed. If `Record` ever stops keying the
     * bank on `scored`, the walk above stops being the route it is named for and this gate would
     * be proving something about a screen nobody sees.
     */
    const record = readFileSync(resolve(__dirname, "../../client/src/pages/Record.tsx"), "utf8");
    expect(record).toContain("scored === 0");
    expect(record).toContain("<FirstDecision");
    expect(record).toContain("<AnchorRunControl");
  });
});

describe("GATE-REACHABILITY: no bucket is promised a test that cannot run", () => {
  it("refuses to register a bucket the live loop can never fill", () => {
    for (const bucketing of BUCKETINGS) {
      if (collectibleInLiveLoop(bucketing)) continue;
      expect(
        isRegistrableBucket(bucketing.key),
        `${bucketing.key} can be preregistered and no live decision can ever fall inside it`,
      ).toBe(false);
    }
  });

  it("still registers the buckets the live loop does fill, so this is not a blanket refusal", () => {
    const registrable = BUCKETINGS.filter((b) => isRegistrableBucket(b.key)).map((b) => b.key);
    expect(registrable).toContain("fast-under-45s");
    expect(registrable).toContain("phase-opening");
    expect(registrable).toContain("phase-middlegame");
    expect(registrable).toContain("phase-endgame");
    expect(
      registrable.length,
      "refusing everything would pass the assertion above and break the product",
    ).toBeGreaterThan(1);
  });

  it("grounds the clock claim in what the board actually constructs", () => {
    /*
     * WHY THIS IS READ OFF THE FILE. `shared/` cannot import the client, so
     * LIVE_DECISION_CARRIES_CLOCK is a stated fact -- and a stated fact drifts. This holds it to
     * the two places `Home` builds a decision's position. Wire a real clock into either and this
     * goes red naming the constant to change, which is the only way that constant stops being a
     * comment somebody has to remember.
     */
    const source = ts.createSourceFile(
      "Home.tsx",
      readFileSync(HOME, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    const clocks: { line: number; isNull: boolean }[] = [];
    const walk = (node: ts.Node): void => {
      if (
        ts.isPropertyAssignment(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === "clockMsRemaining"
      ) {
        clocks.push({
          line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          isNull: node.initializer.kind === ts.SyntaxKind.NullKeyword,
        });
      }
      ts.forEachChild(node, walk);
    };
    walk(source);

    expect(clocks.length, "no decision position built in Home; this assertion went blind").toBe(2);
    const clocked = clocks.filter((c) => !c.isNull);
    if (LIVE_DECISION_CARRIES_CLOCK) {
      expect(clocked.length, "the constant says live decisions carry a clock; none does").toBeGreaterThan(0);
    } else {
      expect(
        clocked.map((c) => c.line),
        "Home now builds a clocked decision -- flip LIVE_DECISION_CARRIES_CLOCK",
      ).toEqual([]);
    }
  });

  it("records why the bank alone could not carry the phase buckets", () => {
    /*
     * NOT DECORATION, AND NOT A TEST OF THE BANK. This is the measurement that makes the rule
     * above necessary, kept where it will be re-run: the bank is phase-homogeneous, so under any
     * rule that made it the only source of confidence, `phase-middlegame` had nothing OUTSIDE it
     * and the other two had nothing inside. Regenerate the bank across phases and this reddens --
     * correctly, because the reasoning in live-acquisition.ts would then need rewriting.
     */
    const phases = new Set(
      ANCHOR_POSITIONS.map((position) => {
        const ply = Number(position.id.match(/(\d+)\s*$/)?.[1] ?? 0);
        return classifyPhase(position.fen, ply);
      }),
    );
    expect([...phases]).toEqual(["middlegame"]);
    expect(
      ANCHOR_POSITIONS.length,
      "a bank of one phase cannot supply both sides of a phase bucket at any size",
    ).toBeLessThan(MIN_BUCKET_N * 2 + 1);
  });
});
