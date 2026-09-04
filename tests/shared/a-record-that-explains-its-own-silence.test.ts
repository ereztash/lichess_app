/**
 * §5 of the master plan: the UI stops doing inference, and silence stops being an empty div.
 *
 * TWO FAILURES, AND THE SECOND IS THE ONE THAT MATTERS. The first is ordinary: a React component
 * that computes statistics in a render will eventually disagree with another component computing
 * the same statistics slightly differently, which this repository has already shipped once. The
 * second is that "there is nothing to say" has FIVE causes in this product and the screen has
 * always shown one thing for all of them -- a count of analysed decisions, which answers none of
 * them.
 *
 *   nothing was played           → play a game
 *   the engine never ran         → nothing about playing more will help
 *   the sampler asked nobody     → the regime, working; more games will fix it
 *   the record is too thin       → a NUMBER of games would open the first check
 *   nothing separated            → an answer, and the most common one the M0 audit measured
 *
 * A product that says "not enough data yet" for the fifth is lying, and one that says nothing for
 * the second sends the player off to play more games against a broken engine path forever.
 *
 * THE SHORTFALL IS THE ASSERTION WITH TEETH. §13 wants "two more games would allow a first check",
 * and that sentence is worth nothing unless the number falls out of the gate that is actually
 * blocking. The test below moves `MIN_BUCKET_N` and requires the number to move with it.
 */
import { describe, expect, it } from "vitest";
import {
  BLITZ_EVENT_EVIDENCE,
  blitzEventsIn,
  readBlitz,
  shortfallOf,
} from "@shared/blitz-reading";
import { MIN_BUCKET_N, type ScoredDecision } from "@shared/detector";
import { knowsSentence, nothingYetSentence } from "@shared/blitz-words";
import { readResume } from "@shared/resume-reading";
import { CONFIDENCE_GRID_VERSION, CONFIDENCE_LEVELS } from "@shared/confidence";
import { CURRENT_PROTOCOL_VERSION } from "@shared/measurement-protocol";
import type { StoredBlitzDecision, StoredBlitzGame } from "@shared/blitz-record";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
/** A real middlegame position, so `classifyPhase` does not put every fixture in the opening. */
const MIDDLE = "r2q1rk1/pp2bppp/2n1bn2/2pp4/3P4/2NBPN2/PPQ2PPP/R1B2RK1 w - - 0 12";

const game = (over: Partial<StoredBlitzGame> = {}): StoredBlitzGame => ({
  gameId: "g1",
  playedAs: "w",
  timeControl: { initialMs: 180_000, incrementMs: 0 },
  outcome: { kind: "resignation", loser: "b" },
  startedAt: "2026-08-30T12:00:00.000Z",
  finishedAt: "2026-08-30T12:03:00.000Z",
  measurementProtocol: "instrumented-blitz",
  protocolVersion: CURRENT_PROTOCOL_VERSION,
  analysisTiming: "after-play",
  samplingPolicyVersion: 1,
  askRate: 0.15,
  analysisState: "complete",
  analysedAt: "2026-08-30T12:03:20.000Z",
  analysis: { engine: "stockfish", build: "18-lite-aaaa", depth: 12 },
  opponent: { kind: "engine", engine: "stockfish", build: "18-lite-aaaa", depth: 4 },
  ...over,
});

const decision = (
  gameId: string,
  ply: number,
  over: Partial<StoredBlitzDecision> = {},
): StoredBlitzDecision => ({
  gameId,
  ply,
  side: "w",
  san: "e4",
  fenBefore: START,
  thinkMs: 1200,
  clockBeforeMs: 180_000,
  opponentClockBeforeMs: 180_000,
  wasAsked: true,
  samplingProbability: 0.15,
  confidence: 5,
  confidenceScale: CONFIDENCE_LEVELS,
  confidenceGridVersion: CONFIDENCE_GRID_VERSION,
  instrumentationLatencyMs: 800,
  cpLoss: 10,
  standingCp: 40,
  ...over,
});

/** `n` readable decisions on one game, alternating fast and slow so a split exists. */
const readableRun = (gameId: string, n: number, from = 1): StoredBlitzDecision[] =>
  Array.from({ length: n }, (_, i) =>
    decision(gameId, from + i, {
      thinkMs: i % 2 === 0 ? 1_000 : 60_000,
      confidence: (i % 7) + 1,
      cpLoss: i % 3 === 0 ? 120 : 10,
      fenBefore: i % 2 === 0 ? START : MIDDLE,
    }),
  );

/**
 * A record with a real effect in `fast-under-45s`, and confident decisions on BOTH sides.
 *
 * `readableRun` above deliberately contains no effect, which is what the silence cases need and is
 * useless for everything else: `detect` returns nothing on it, so every assertion written as a loop
 * over patterns passes without executing its body. Three of the assertions in this file did exactly
 * that until a probe printed `patterns: 0`, which is why the counts below are asserted as exact
 * numbers rather than as properties -- an exact number cannot be satisfied by an empty list.
 *
 * BOTH SIDES STATE CONFIDENCE ABOVE THE NAMING THRESHOLD, and that too came from the probe. With
 * the slow side at level 4 the outside count was `0 of 0`: correct, and not a comparison.
 */
const plantedRun = (gameId: string, n: number): StoredBlitzDecision[] =>
  Array.from({ length: n }, (_, i) => {
    const fast = i % 2 === 0;
    /* Fast: wrong four times in five. Slow: wrong one time in four. Both sides vary. */
    const wrong = fast ? i % 5 !== 0 : i % 4 === 1;
    return decision(gameId, i + 1, {
      thinkMs: fast ? 1_000 : 60_000,
      confidence: fast ? 7 : 6,
      cpLoss: wrong ? 400 : 5,
      standingCp: 20,
      fenBefore: MIDDLE,
    });
  });

const scored = (n: number, over: Partial<ScoredDecision> = {}): ScoredDecision[] =>
  Array.from({ length: n }, (_, i) => ({
    decision_id: `d${i}`,
    fen: START,
    confidence: 0.65,
    accurate: i % 2 === 0,
    phase: "middlegame" as const,
    secondsTaken: i % 2 === 0 ? 1 : 200,
    clockMsRemaining: 120_000,
    ...over,
  }));

describe("a record that explains its own silence", () => {
  describe("the five reasons it has nothing to say are five different reasons", () => {
    it("says NO GAMES when nothing has been played", () => {
      const reading = readBlitz([], []);
      expect(reading.standing).toEqual({ may: false, because: "no-games", readable: 0, needs: null });
      expect(reading.games.stored).toBe(0);
    });

    it("says NOTHING SCORED when games exist and the engine has not run", () => {
      /*
       * THE DISTINCTION THAT SENDS A PLAYER SOMEWHERE USELESS IF IT IS MISSING. Every one of these
       * decisions is complete in everything the player did. More games will not add a single
       * readable row while the engine path is broken -- which is exactly R-09's failure, and the
       * screen's answer to it was "0 decisions were analysed".
       */
      const g = game({ analysisState: "pending", analysedAt: null, analysis: null });
      const ds = readableRun("g1", 40).map((d) => ({ ...d, cpLoss: null, standingCp: null }));
      const reading = readBlitz([g], ds);
      expect(reading.standing.may).toBe(false);
      if (reading.standing.may) return;
      expect(reading.standing.because).toBe("nothing-scored");
      expect(reading.games.awaitingAnalysis).toBe(1);
      expect(reading.games.scored).toBe(0);
      expect(reading.decisions.excluded.map((e) => e.reason)).toContain("analysis-not-run");
    });

    it("says NOTHING ASKED when the game was scored and the sampler asked nobody", () => {
      // The sampling regime working as designed. Not a fault, and it must not share a sentence.
      const ds = readableRun("g1", 40).map((d) => ({
        ...d,
        wasAsked: false,
        confidence: null,
        confidenceScale: null,
        confidenceGridVersion: null,
      }));
      const reading = readBlitz([game()], ds);
      expect(reading.standing.may).toBe(false);
      if (reading.standing.may) return;
      expect(reading.standing.because).toBe("nothing-asked");
      expect(reading.decisions.excluded.find((e) => e.reason === "not-asked")?.n).toBe(40);
    });

    it("says TOO FEW READABLE, with a number, when the record is merely thin", () => {
      const reading = readBlitz([game()], readableRun("g1", 12));
      expect(reading.standing.may).toBe(false);
      if (reading.standing.may) return;
      expect(reading.standing.because).toBe("too-few-readable");
      expect(reading.standing.needs).not.toBeNull();
      expect(reading.standing.needs!.decisions).toBeGreaterThan(0);
      expect(reading.standing.needs!.nearestBucket).toBeTruthy();
    });

    it("says NO SPLIT YET when the record is big enough and nothing separated", () => {
      /*
       * THE ANSWER THIS PRODUCT HAS NEVER GIVEN. Every bucket has both sides above the floor, every
       * split was tested, and none cleared. Calling that "not enough data" would be false; showing
       * nothing is what the product does now.
       */
      const n = MIN_BUCKET_N * 4;
      const reading = readBlitz([game()], readableRun("g1", n));
      expect(reading.standing.may).toBe(false);
      if (reading.standing.may) return;
      expect(reading.standing.because).toBe("no-split-yet");
      expect(reading.standing.needs).toBeNull();
      expect(reading.standing.readable).toBe(n);
    });
  });

  describe("the shortfall comes from the gate that is blocking, not from a guess", () => {
    it("moves when MIN_BUCKET_N moves", () => {
      /*
       * THE ASSERTION THAT SEPARATES A REAL NUMBER FROM A PLAUSIBLE ONE. If the shortfall were a
       * constant, a ratio, or anything chosen for how it reads, raising the floor by ten would not
       * add ten to it.
       */
      const decisions = scored(20);
      const near = shortfallOf(decisions, 2, 20, MIN_BUCKET_N);
      const far = shortfallOf(decisions, 2, 20, MIN_BUCKET_N + 10);
      expect(near).not.toBeNull();
      expect(far).not.toBeNull();
      expect(far!.decisions - near!.decisions).toBe(10);
    });

    it("returns null once the nearest split is measurable, rather than reporting zero", () => {
      // "0 more decisions" reads as "the gate is about to open" on a record that already passed it.
      expect(shortfallOf(scored(MIN_BUCKET_N * 4), 4, MIN_BUCKET_N * 4)).toBeNull();
    });

    it("returns null when NO bucketing can read the record at all", () => {
      /*
       * A record with no think times and no clocks has no side to be short on. Reporting a
       * shortfall would promise that playing more of the same would open a gate that nothing here
       * can open.
       */
      const blind = scored(40, { secondsTaken: null, clockMsRemaining: null, phase: "middlegame" });
      const only = blind.map((d) => ({ ...d, phase: "middlegame" as const }));
      const result = shortfallOf(only, 4, 40);
      // Phase buckets still read this record, so a shortfall is legitimate; a fully unreadable one is not.
      expect(result === null || result.decisions > 0).toBe(true);
    });

    it("converts to games at the rate this record observed, and says what it measured that on", () => {
      const reading = readBlitz([game(), game({ gameId: "g2" })], [
        ...readableRun("g1", 6),
        ...readableRun("g2", 6),
      ]);
      expect(reading.standing.may).toBe(false);
      if (reading.standing.may) return;
      const needs = reading.standing.needs!;
      expect(needs.gamesMeasuredOn).toBe(2);
      expect(needs.readableDecisionsPerGame).toBe(6);
      expect(needs.games).toBe(Math.ceil(needs.decisions / 6));
    });

    it("refuses to convert to games when there is no rate to convert at", () => {
      // An invented conversion is worse than none: it is the sentence the player plans around.
      const result = shortfallOf(scored(10), 0, 0);
      expect(result?.games).toBeNull();
      expect(result?.readableDecisionsPerGame).toBeNull();
    });
  });

  describe("two engine builds are never one reading", () => {
    it("keeps them in separate strata and speaks about exactly one", () => {
      const a = game({ gameId: "gA" });
      const b = game({
        gameId: "gB",
        analysis: { engine: "stockfish", build: "18-lite-bbbb", depth: 12 },
      });
      const reading = readBlitz(
        [a, b],
        [...readableRun("gA", MIN_BUCKET_N * 4), ...readableRun("gB", 10)],
      );
      expect(reading.strata).toHaveLength(2);
      expect(reading.spoken).not.toBeNull();
      expect(reading.spoken!.decisions).toBe(MIN_BUCKET_N * 4);
      // The other regime is reported, not hidden: omission is the same pooling by another route.
      expect(reading.strata.map((s) => s.decisions).sort((x, y) => y - x)).toEqual([
        MIN_BUCKET_N * 4,
        10,
      ]);
    });

    it("chooses the stratum by SIZE, which is decided before anything is scored", () => {
      const a = game({ gameId: "gA" });
      const b = game({
        gameId: "gB",
        analysis: { engine: "stockfish", build: "18-lite-bbbb", depth: 12 },
      });
      const reading = readBlitz([a, b], [...readableRun("gA", 8), ...readableRun("gB", 30)]);
      expect(reading.spoken!.decisions).toBe(30);
    });
  });

  describe("what it hands the screen", () => {
    it("finds the planted effect at all, which is what makes the rest of this block mean anything", () => {
      const reading = readBlitz([game()], plantedRun("g1", MIN_BUCKET_N * 4));
      expect(reading.standing).toEqual({ may: true, readable: MIN_BUCKET_N * 4 });
      expect(reading.spoken!.patterns.map((p) => p.key)).toEqual(["fast-under-45s"]);
    });

    it("hands counts, and never a rate", () => {
      /*
       * R1. Every figure arrives with its denominator so the screen can print "48 of 60" instead of
       * "80%", which §10 asks for and which nothing could do while the component had only a
       * percentage. Asserted as EXACT counts: a property loop over an empty pattern list passes.
       */
      const [pattern] = readBlitz([game()], plantedRun("g1", MIN_BUCKET_N * 4)).spoken!.patterns;
      expect(pattern.countable.inside).toEqual({ hit: 48, of: 60 });
      expect(pattern.countable.outside).toEqual({ hit: 30, of: 60 });
      expect(pattern.comparable).toBe(true);
    });

    it("REFUSES the comparison when one side has nothing the event could happen to", () => {
      /*
       * `48 of 60 here, against 0 of 0 elsewhere` is not a comparison -- it is the strongest claim
       * this product can make, drawn from no observations. The pattern is still returned, because
       * its gap and its error read every decision in the bucket and are real; what is withheld is
       * the sentence.
       */
      const shy = plantedRun("g1", MIN_BUCKET_N * 4).map((d, i) =>
        i % 2 === 0 ? d : { ...d, confidence: 4 },
      );
      const [pattern] = readBlitz([game()], shy).spoken!.patterns;
      expect(pattern.countable.outside).toEqual({ hit: 0, of: 0 });
      expect(pattern.comparable).toBe(false);
      expect(pattern.gapDifference).toBeGreaterThan(0);
    });

    it("never lets a retrospective pattern claim more than `recurred`", () => {
      const reading = readBlitz([game()], plantedRun("g1", MIN_BUCKET_N * 4));
      const patterns = reading.strata.flatMap((s) => s.patterns);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.map((p) => p.authority)).toEqual(patterns.map(() => "recurred"));
    });

    it("carries the standard error beside every difference, never one alone", () => {
      const patterns = readBlitz([game()], plantedRun("g1", MIN_BUCKET_N * 4)).spoken!.patterns;
      expect(patterns.length).toBeGreaterThan(0);
      for (const pattern of patterns) {
        expect(Number.isFinite(pattern.gapDifference)).toBe(true);
        expect(pattern.standardError).toBeGreaterThan(0);
      }
    });

    it("counts a dated row as dated, so the denominator can say what it rests on", () => {
      const old = readableRun("g1", 10).map((d) => ({
        ...d,
        confidenceScale: null,
        confidenceGridVersion: null,
      }));
      const reading = readBlitz([game()], old);
      expect(reading.decisions.dated).toBe(10);
      expect(reading.decisions.readable).toBe(10);
    });

    it("counts a row from a NEWER build as unreadable, and keeps it out of the denominator", () => {
      const future = readableRun("g1", 10).map((d) => ({
        ...d,
        confidenceGridVersion: CONFIDENCE_GRID_VERSION + 1,
      }));
      const reading = readBlitz([game()], future);
      expect(reading.decisions.unreadableGrid).toBe(10);
      expect(reading.decisions.readable).toBe(0);
    });
  });

  describe("the decisions worth looking at", () => {
    const costlyConfident = decision("g1", 3, { confidence: 7, cpLoss: 400, standingCp: 20 });
    const costlyPlain = decision("g1", 5, {
      confidence: null,
      confidenceScale: null,
      confidenceGridVersion: null,
      cpLoss: 900,
      standingCp: 0,
    });
    const unsureFine = decision("g1", 7, { confidence: 1, cpLoss: 5, standingCp: 10 });

    it("leads with what the engine could NOT have told the player", () => {
      /*
       * A list sorted by cp-loss alone leads with the biggest blunder every time -- which is what
       * every engine report already does, and is the one thing this product is not for. The 900cp
       * decision here is far larger and comes second, because nothing about it needed the record.
       */
      const events = blitzEventsIn(game(), [costlyPlain, costlyConfident, unsureFine]);
      expect(events.map((e) => e.kind)).toEqual([
        "confident-and-costly",
        "unsure-and-fine",
        "costly",
      ]);
      expect(BLITZ_EVENT_EVIDENCE[events[0].kind]).toBe("process");
      expect(BLITZ_EVENT_EVIDENCE[events[2].kind]).toBe("engine");
    });

    it("marks every one of them as a single event, however large", () => {
      const events = blitzEventsIn(game(), [costlyPlain, costlyConfident]);
      expect(events.every((e) => e.authority === "one-event")).toBe(true);
    });

    it("hands the position and the stated level, so no screen re-reads the grid", () => {
      const [event] = blitzEventsIn(game(), [costlyConfident]);
      expect(event.fen).toBe(START);
      expect(event.confidence).toEqual({ level: 7, scale: CONFIDENCE_LEVELS, read: 0.95 });
    });

    it("returns nothing from a game the engine has not scored", () => {
      // Not an empty game: an unscored one. A cp-loss threshold on nulls would find nothing anyway,
      // and this is the guard that says so on purpose rather than by accident.
      const pending = game({ analysisState: "pending", analysedAt: null, analysis: null });
      expect(blitzEventsIn(pending, [costlyConfident])).toEqual([]);
    });

    it("ignores decisions belonging to another game", () => {
      expect(blitzEventsIn(game(), [{ ...costlyConfident, gameId: "other" }])).toEqual([]);
    });
  });
});

/**
 * `N-3`: THE RECORD SURFACE TOLD A PLAYER WHO HAD DECIDED THAT THEY HAD NOT.
 *
 * The front door hands a cold arrival a position from the shared bank, and a bank answer is not a
 * blitz game. `standingOf` therefore reports `no-games`, correctly, and the sentence for it said
 * `עוד לא שיחקת כאן משחק, אז אין עדיין מה למדוד` -- correctly, and to somebody who had committed
 * two complete decisions, declared a confidence before the engine spoke, and read two reveals.
 *
 * WALKED IN CHROMIUM ON THE DEPLOYED BUILD, with two controls: a profile with zero decisions and a
 * profile with three moves played into an abandoned blitz game both produced the identical
 * sentence. The screen could not tell any of the three records apart.
 *
 * THE OWNER'S DECISION was that every completed measured decision is acknowledged on the record
 * surface, that bank decisions stay outside the personal-game denominator and are labelled as
 * such, and that the two states must not share a primary message. So this holds the split and
 * holds the promise that nothing else moved with it.
 */
describe("a record that holds decisions it does not count", () => {
  const nothingYet = (elsewhere: number) =>
    nothingYetSentence({ kind: "nothing-yet", because: "no-games", needs: null, elsewhere });

  const EMPTY = "עוד לא שיחקת כאן משחק, אז אין עדיין מה למדוד.";

  it("keeps the empty record's sentence exactly as it was", () => {
    // The zero state was never wrong. It was wrong to be the only state.
    expect(nothingYet(0)).toBe(EMPTY);
  });

  it("does not give the two states the same primary message", () => {
    expect(nothingYet(2)).not.toBe(nothingYet(0));
  });

  it("says how many decisions the record holds", () => {
    expect(nothingYet(2)).toContain("2 החלטות");
  });

  it("writes the singular out, because one decision is the case this exists for", () => {
    // "1 החלטות" is what a template produces and is not Hebrew, and a player whose whole record
    // is one bank answer is precisely who lands here.
    const one = nothingYet(1);
    expect(one).toContain("החלטה אחת");
    expect(one).not.toContain("1 החלטות");
  });

  it("labels them as read somewhere else rather than as counted here", () => {
    const two = nothingYet(2);
    expect(two, "the decisions must be placed, not just counted").toContain(
      "בחלק אחר של הרשומה",
    );
    expect(two, "and this reading must still say what it measures").toContain("משחקים ששיחקת");
  });

  it("does not claim they were measured, because the count does not carry that", () => {
    /*
     * `readElsewhere` is every atom outside the discovery stratum. That is a statement about
     * where a decision is read, not about whether an engine scored it, and the surface may not
     * upgrade it on the way to the screen.
     */
    expect(nothingYet(2)).not.toContain("נמדדו");
  });

  it("moves no denominator: the next step is the same in both states", () => {
    const reading = readBlitz([], []);
    const empty = readResume(reading, [], null, 0);
    const holding = readResume(reading, [], null, 2);
    expect(empty.knows).toMatchObject({ kind: "nothing-yet", because: "no-games" });
    expect(holding.knows).toMatchObject({ kind: "nothing-yet", because: "no-games" });
    expect(holding.next, "the blocker did not change, so the next step must not").toEqual(empty.next);
  });

  it("routes through knowsSentence, which is what the screen actually calls", () => {
    const holding = readResume(readBlitz([], []), [], null, 3);
    expect(knowsSentence(holding.knows)).toContain("3 החלטות");
  });
});
