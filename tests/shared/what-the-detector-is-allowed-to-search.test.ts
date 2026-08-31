/**
 * Evidence produced while trying to CHANGE the player may never describe how the player behaved.
 *
 * THE HOLE. `currentClaim` called `listAtoms()` and handed every scoreable row to the detector.
 * So the product could take a player through a drill built to fix a weakness, read the decisions
 * that drill produced, and announce the next weakness from them. The intervention manufactured
 * its own successor. The same door was open to the shared bank, to transfer checks, to positions
 * from games already played, and to every row written before anything recorded why it existed.
 *
 * NOTHING HERE FAILED BEFORE THIS FILE, and that is the shape of the defect rather than an excuse.
 * There was no filter to get wrong: every consumer read the whole record, all the numbers rendered,
 * every screen agreed with every other, and the only symptom would have been a finding built on
 * the wrong decisions, months later, with nothing in the record able to say so.
 *
 * WHAT IS ASSERTED. Not that the policy has a particular shape -- that the boundary HOLDS: a
 * hundred decisions of the wrong kind cannot move a claim, and deleting any one cell of the table
 * makes a control here go red. The last two tests are the ones that matter most, because a policy
 * whose violations are invisible is a comment.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import * as service from "../../shared/record-service";
import { registerDrill } from "../fixtures/registered-drill";
import { registerTransfer } from "../fixtures/registered-transfer";
import { remainingBeforeClaim } from "../../client/src/lib/loop-position";
import { MIN_BUCKET_N } from "../../shared/detector";
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { ANCHOR_POSITIONS } from "../../shared/anchor-set";
import { classifyPhase } from "../../shared/phase";
import {
  EVIDENCE_POLICY,
  EVIDENCE_POLICY_VERSION,
  contextKeyOf,
  forDiscovery,
  LEGACY_CONTEXT,
  type EvidenceContextKey,
} from "../../shared/evidence-policy";
import type { DecisionPurpose } from "../../shared/confidence-asked";
import type { DecisionAtom } from "../../shared/decision-atom";

const NOW = { created_at: "2026-03-01T00:00:00.000Z" };
const FLOOR = MIN_BUCKET_N * 2;

/**
 * An endgame position and a middlegame one, so a record can be built with a real phase contrast.
 *
 * Real FENs rather than a synthetic string: `classifyPhase` is re-derived server-side from the
 * board, so a fixture the classifier disagrees with is refused at the boundary and the test would
 * be measuring the fixture.
 */
const ENDGAME = "8/5k2/8/8/3K4/8/5P2/8 w - - 0 60";
const MIDDLEGAME = "r2q1rk1/pp2bppp/2n1bn2/3pp3/3PP3/2N1BN2/PP2BPPP/R2Q1RK1 w - - 0 12";
/** The third position a preregistered transfer must name. No decision in this file lands on it. */
const UNANSWERED = "8/8/4k3/8/8/4K3/4P3/8 w - - 0 55";
/*
 * Past the opening boundary, because `classifyPhase` reads the ply as well as the board and the
 * service re-derives the phase from both. At ply 0 the middlegame fixture classifies as an opening
 * and the commit is refused -- the fixture would be testing the classifier, not the policy.
 */
const PLY = 30;

let seq = 0;
const nextId = () => `11111111-1111-4111-8111-${String(++seq).padStart(12, "0")}`;

/**
 * One decision, revealed, with the confidence/accuracy pairing the caller asks for.
 *
 * `accurate` is produced by choosing the engine's move or not, because `scoreDecisions` derives
 * accuracy from cp loss rather than from a flag -- a fixture that set accuracy directly would be
 * testing a field the record does not have.
 */
async function record(
  store: MemoryRecordStore,
  options: {
    purpose: DecisionPurpose | null;
    fen: string;
    confidence: number;
    accurate: boolean;
    /** A bank position carries its own, and the classifier reads the ply as well as the board. */
    ply?: number;
  },
) {
  const id = nextId();
  const ply = options.ply ?? PLY;
  const event: service.CommitEvent = {
    decision_id: id,
    entry_state: {
      game_id: "g",
      fen: options.fen,
      ply,
      // Whatever the classifier says, since the service re-derives it and refuses a mismatch.
      phase: classifyPhase(options.fen, ply),
      clock_ms_remaining: null,
    },
    purpose: options.purpose,
    /*
     * A `drill` decision names its drill, because the service resolves the label rather than
     * trusting it (R-07). One drill over both fixture positions, which is what a real run is: the
     * drill registers its positions before it starts and every decision inside it names it.
     */
    drill_id:
      options.purpose === "drill"
        ? await registerDrill(store, [ENDGAME, MIDDLEGAME], "drill-detector-fixture")
        : null,
    /*
     * A `transfer` decision names its transfer, for the drill's reason and by the drill's shape.
     * Three positions, because `TRANSFER_POSITION_COUNT` is three and a transfer holding two is a
     * run the product cannot preregister -- the third is simply never answered here, which is what
     * a transfer looks like partway through.
     */
    transfer_id:
      options.purpose === "transfer"
        ? await registerTransfer(store, [ENDGAME, MIDDLEGAME, UNANSWERED], "transfer-detector-fixture")
        : null,
    known: "המרכז פתוח",
    unknown: "לא יודע איך הוא יענה",
    known_parts: { tapped: ["המרכז פתוח"], typed: "" },
    unknown_parts: { tapped: ["לא יודע איך הוא יענה"], typed: "" },
    decision: options.accurate ? "d4d5" : "d4c4",
    bounded_action: {
      seconds_taken: 20,
      confidence: options.confidence,
      confidence_scale: CONFIDENCE_LEVELS,
      candidate_moves_considered: ["d4d5"],
    },
    probe: null,
    reveal_timing: "per-decision",
    /* Legacy-shaped on purpose: this fixture predates the protocol fields and claims nothing. */
    measurement_protocol: null,
    protocol_version: null,
    analysis_timing: null,
    result: null,
    feedback: null,
  };
  await service.commitDecision(store, event);
  await service.reveal(store, id, {
    engine_eval_cp: 20,
    engine_best_move: "d4d5",
    engine_depth: 18,
    engine_source: "local_sf18",
    engine_build: "sf18-test-build",
    cp_loss: options.accurate ? 0 : 300,
  });
  return id;
}

/**
 * A record with a loud, obvious contrast in one phase, built entirely from decisions of one kind.
 *
 * Confident and mostly wrong in the endgame, unconfident and mostly right elsewhere: about the
 * largest calibration contrast the six buckets can express. If a population is admitted to
 * discovery at all, this shape is what the detector finds in it -- so it is what a test must
 * inject to prove a population is NOT admitted.
 *
 * `MOSTLY`, AND THE WORD IS LOAD-BEARING. This fixture used to be perfectly uniform inside each
 * phase: every endgame decision at the top confidence and wrong, every other one at confidence 2
 * and right. That is a bucket whose per-decision gap has a sample variance of exactly zero, and
 * `gapDifferenceStandardError` refuses such a side by design -- a sample that cannot estimate its
 * own error is not one that knows its gap exactly, and treating it as exact fires on up to 13% of
 * records by that function's own measurement.
 *
 * It passed anyway, because the guard was unreachable: sixty identical doubles do not sum to a mean
 * that cancels exactly, so the variance came out as 6.1e-31 rather than 0 and `<= 0` never fired.
 * With `summarise` now answering "did this sample vary at all" structurally, the guard works and
 * this fixture stopped being one the detector may read. One decision in six is flipped, which
 * leaves the contrast enormous and gives both sides a variance that exists.
 */
async function loudRecord(store: MemoryRecordStore, purpose: DecisionPurpose | null, n = FLOOR) {
  for (let i = 0; i < n; i++) {
    const endgame = i % 2 === 0;
    /*
     * One in five of EACH PHASE goes the other way, so neither side is a constant.
     *
     * `Math.floor(i / 2)` indexes within the phase rather than across the record, and the
     * distinction is the whole of it: `i % 6 !== 0` only ever flips even indices, every one of
     * which is an endgame decision, so the middlegame side stayed perfectly uniform and its
     * variance stayed exactly zero -- the same degeneracy, moved one bucket over.
     */
    const typical = Math.floor(i / 2) % 5 !== 0;
    await record(store, {
      purpose,
      fen: endgame ? ENDGAME : MIDDLEGAME,
      confidence: endgame ? CONFIDENCE_LEVELS : 2,
      accurate: typical ? !endgame : endgame,
    });
  }
}

describe("the loud contrast this file injects is one the detector really does find", () => {
  it("becomes a claim when the decisions are free play", async () => {
    /*
     * THE CONTROL FOR EVERY TEST BELOW. Without it, "adding 100 drill decisions changed nothing"
     * is satisfied by a detector that finds nothing in anything, and the whole file would prove
     * that the product is broken rather than that the boundary holds.
     */
    const store = new MemoryRecordStore();
    await loudRecord(store, "play");
    const view = await service.currentClaim(store, NOW);
    expect(view.claim, "the injected contrast is not detectable at all").not.toBeNull();
  });
});

describe("an intervention cannot manufacture the next weakness", () => {
  const cannotMoveTheClaim = (purpose: DecisionPurpose | null, label: string) =>
    it(label, async () => {
      const store = new MemoryRecordStore();
      await loudRecord(store, purpose, 100);
      const view = await service.currentClaim(store, NOW);
      expect(view.claim, `${purpose ?? "legacy"} decisions produced a claim`).toBeNull();
      expect(view.scored, `${purpose ?? "legacy"} decisions entered the search population`).toBe(0);
    });

  // §17.1 -- a drill is chosen BECAUSE of a weakness and tells the player what is being tested.
  cannotMoveTheClaim("drill", "100 drill decisions cannot produce a claim");
  // §17.2 -- a transfer check is the player deliberately applying a rule they wrote.
  cannotMoveTheClaim("transfer", "100 transfer decisions cannot produce a claim");
  it("anchor decisions cannot create a personal claim", async () => {
    /*
     * §17.3, and it needs REAL BANK POSITIONS rather than the fixture board the others use --
     * because the authority check below refuses a decision claiming to be a bank answer on a
     * position outside the bank. Which is the point: the two guards are consistent, and a test
     * that could smuggle a made-up position in under the `anchor` label would be evidence that
     * one of them was not holding.
     *
     * No injected contrast here, and none is needed. The assertion is that these decisions never
     * reach the search population at all, so what would have been found in them is moot.
     */
    const store = new MemoryRecordStore();
    for (const position of ANCHOR_POSITIONS.slice(0, 40)) {
      await record(store, {
        purpose: "anchor",
        fen: position.fen,
        confidence: CONFIDENCE_LEVELS,
        accurate: false,
      });
    }
    const view = await service.currentClaim(store, NOW);
    expect(view.claim, "the shared bank produced a claim about one player").toBeNull();
    expect(view.scored, "bank answers entered the personal search population").toBe(0);
  });

  // §17.4 -- nothing says a row from before the context existed was not an intervention.
  cannotMoveTheClaim(null, "a legacy decision with no recorded context cannot enter discovery");
  // Two more the constitution's table refuses, and for reasons of their own.
  cannotMoveTheClaim("import", "a game already played cannot produce a claim");
  cannotMoveTheClaim("first", "the front door's handoff cannot produce a claim");

  it("does not let a wall of interventions drown out real free play", async () => {
    /*
     * THE FAILURE THE COUNT ALONE WOULD MISS. A filter that merely diluted the intervention rows
     * would still let 200 of them swamp 60 honest ones -- the claim would come back, built mostly
     * from drill decisions, and every assertion above would still pass. What is checked here is
     * that the population is the free-play decisions and nothing else.
     */
    const store = new MemoryRecordStore();
    await loudRecord(store, "drill", 100);
    await loudRecord(store, "play", FLOOR);
    const view = await service.currentClaim(store, NOW);
    expect(view.claim).not.toBeNull();
    expect(view.scored, "interventions were counted into the search population").toBe(FLOOR);
  });

  it("keeps the claim's own arithmetic in the population it searched", async () => {
    /*
     * R1 and the reason `remainingBeforeClaim` exists. If `scored` counted the whole record while
     * the detector searched a subset, the screen would announce a wait against one set and the
     * engine would run against another -- the exact disagreement this codebase spends its gates
     * on, reintroduced by the fix.
     *
     * `recorded` USED TO BE ASSERTED HERE AS 10 AND IS NOW 50, AND THE CHANGE IS DELIBERATE.
     *
     * Three things settled it. The field's own doc has always read "Always the WHOLE record, even
     * when the claim was searched over a slice of it", and the code disagreed with it. The wait
     * this test is about is computed from `scored` -- `remainingBeforeClaim` never reads
     * `recorded` -- so nothing about the announced distance moves. And the old value was wrong
     * where it was visible: once the front door began handing account-less arrivals a bank
     * position, a player who had committed one decision, had it revealed, and had a reveal branch
     * fire read "0 נמדדו מתוך 0 שנרשמו" and was offered their first decision again.
     *
     * What the difference between the two numbers now needs is a NAME rather than a smaller
     * numerator, which is `readElsewhere`: those rows are `separate` in the evidence policy --
     * read under another heading with their own denominator -- and the strip says so.
     */
    const store = new MemoryRecordStore();
    await loudRecord(store, "drill", 40);
    await loudRecord(store, "play", 10);
    const view = await service.currentClaim(store, NOW);
    expect(view.claim).toBeNull();
    expect(view.scored, "interventions entered the population the detector searches").toBe(10);
    expect(view.recorded).toBe(50);
    expect(
      view.readElsewhere,
      "the forty rows the detector cannot read vanished instead of being named",
    ).toBe(40);
    /*
     * THE ASSERTION THIS TEST WAS ACTUALLY FOR, made directly rather than through `recorded`: the
     * distance announced on screen is measured against the population the detector searches.
     */
    expect(
      remainingBeforeClaim({ scored: view.scored, preregScored: null, unreadable: false }),
      "the wait was measured against rows the detector cannot read",
    ).toBe(MIN_BUCKET_N * 2 - 10);
  });
});

describe("a label with nothing behind it is not provenance", () => {
  it("refuses a decision that claims to be a bank answer on a position outside the bank", async () => {
    /*
     * §17.5, for the one binding this build can verify without believing what it was told. Bank
     * membership is a property of the FEN, so a client cannot inflate the only between-player
     * reading in the product by labelling its own positions as bank answers.
     */
    const store = new MemoryRecordStore();
    await expect(
      record(store, { purpose: "anchor", fen: MIDDLEGAME, confidence: 4, accurate: true }),
    ).rejects.toBeInstanceOf(service.RecordError);
  });

  it("accepts a bank answer on a real bank position", async () => {
    // The other half: the check must not refuse the thing it exists to protect.
    const store = new MemoryRecordStore();
    const bank = ANCHOR_POSITIONS[0];
    const id = nextId();
    await service.commitDecision(store, {
      decision_id: id,
      entry_state: {
        game_id: `anchor-${bank.id}`,
        fen: bank.fen,
        ply: 0,
        phase: classifyPhase(bank.fen, 0),
        clock_ms_remaining: null,
      },
      purpose: "anchor",
      drill_id: null,
      transfer_id: null,
      known: "המרכז פתוח",
      unknown: "לא יודע איך הוא יענה",
      known_parts: { tapped: ["המרכז פתוח"], typed: "" },
      unknown_parts: { tapped: ["לא יודע איך הוא יענה"], typed: "" },
      decision: "e1e2",
      bounded_action: {
        seconds_taken: 20,
        confidence: 4,
        confidence_scale: CONFIDENCE_LEVELS,
        candidate_moves_considered: [],
      },
      probe: null,
      reveal_timing: "per-decision",
      /* Legacy-shaped on purpose: this fixture predates the protocol fields and claims nothing. */
      measurement_protocol: null,
      protocol_version: null,
      analysis_timing: null,
      result: null,
      feedback: null,
    });
    expect((await store.getAtom(id))?.purpose).toBe("anchor");
  });
});

describe("the policy is one table, and every consumer has to ask it", () => {
  const CONTEXTS: EvidenceContextKey[] = [
    "first",
    "anchor",
    "drill",
    "transfer",
    "play",
    "import",
    LEGACY_CONTEXT,
  ];

  it("has an entry for every context under every consumer", () => {
    /*
     * A missing cell would read as `undefined` and throw at the call site rather than at the
     * decision, which is the failure mode of a table that is allowed to be sparse.
     */
    for (const consumer of Object.keys(EVIDENCE_POLICY) as (keyof typeof EVIDENCE_POLICY)[]) {
      for (const context of CONTEXTS) {
        expect(EVIDENCE_POLICY[consumer][context], `${consumer} says nothing about ${context}`).toBeDefined();
      }
    }
  });

  it("gives every cell a reason a reader can check", () => {
    // A refusal nobody can explain is one that gets deleted the next time it is inconvenient.
    for (const consumer of Object.keys(EVIDENCE_POLICY) as (keyof typeof EVIDENCE_POLICY)[]) {
      for (const context of CONTEXTS) {
        expect(EVIDENCE_POLICY[consumer][context].because.length).toBeGreaterThan(20);
      }
    }
  });

  it("admits exactly one context to discovery, and it is free play", () => {
    /*
     * PINNED AS A NUMBER, so that promoting a source into discovery cannot happen quietly. This
     * is the assertion that turns "no source becomes eligible merely because excluding it produces
     * too little data" from a paragraph into something a diff has to argue with.
     */
    const admitted = CONTEXTS.filter((c) => EVIDENCE_POLICY.discovery[c].kind === "admitted");
    expect(admitted).toEqual(["play"]);
  });

  it("reads a legacy row as legacy rather than as a purpose", () => {
    // §2: null means nobody recorded why this decision existed. It is not a seventh purpose.
    const atom = { purpose: null } as unknown as DecisionAtom;
    expect(contextKeyOf(atom)).toBe(LEGACY_CONTEXT);
    expect(EVIDENCE_POLICY.discovery[LEGACY_CONTEXT].kind).toBe("refused");
  });

  it("filters the ids in lockstep with the atoms", () => {
    /*
     * THE SILENT CORRUPTION THIS SHAPE PREVENTS. `scoreDecisions(atoms, ids)` reads the two by
     * index, so a filter applied to one and not the other does not fail -- it relabels every
     * decision after the first removal, and the claim comes back attributing real decisions to
     * the wrong ids. Returning the pair from one function is what makes that unexpressible.
     */
    const atoms = [
      { purpose: "drill" },
      { purpose: "play" },
      { purpose: "anchor" },
      { purpose: "play" },
    ] as unknown as DecisionAtom[];
    /*
     * These four share their conditions -- none records a protocol or a reveal timing -- so they
     * form one stratum, and the lockstep property is asserted inside it.
     */
    const strata = forDiscovery(atoms, ["a", "b", "c", "d"]);
    expect(strata).toHaveLength(1);
    expect(strata[0].atoms).toHaveLength(2);
    expect(strata[0].ids, "the ids no longer belong to the atoms beside them").toEqual(["b", "d"]);
  });

  it("carries a version, because a finding is only a finding under one policy", () => {
    // §14: a claim formed under one population is not the same quantity as under another.
    expect(EVIDENCE_POLICY_VERSION).toBeGreaterThanOrEqual(2);
  });
});
