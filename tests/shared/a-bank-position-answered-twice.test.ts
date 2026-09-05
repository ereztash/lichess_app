/**
 * THE ONLY BETWEEN-PLAYER READING THIS PRODUCT HAS, AND ITS PRECONDITION.
 *
 * `forAnchorReference`'s own argument: *"the bank is the only reading this product claims is
 * comparable BETWEEN players, and the whole of that claim is that the item difficulty is held
 * fixed."* Two answers by one player to one bank position do not hold it fixed. A player who
 * answered thirty distinct positions and a player who answered twenty-five plus five repeats have
 * not met the same set, and the number that compares them says they have.
 *
 * IT IS REACHABLE BY A GESTURE, NOT BY A CONTRIVANCE. Walked in Chromium on the built app: take a
 * bank decision, read the reveal, then reload `/play`. The board comes back -- `session-position.ts`
 * persists it so a reload does not lose the game -- and the reveal does not, because it is component
 * state. So the screen keeps the position and drops the only thing that said it had been decided,
 * re-arms the commitment, and accepts a second answer. Browser Back from `/`, and the brand lockup
 * out and the `ללוח` control back, reach the same screen.
 *
 * MEASURED CONSEQUENCE, at the service level, before this rule existed: five bank decisions over
 * four positions read `anchorAnswered.length === 4` and `anchor.n === 5`. The two numbers on the
 * same screen disagreed by exactly the repeat -- progress dedupes by position id, the reading did
 * not -- and because the second answer was taken WITH the engine's verdict on the first already
 * shown, it moved the measured accuracy from 0/4 to 1/5. A reading a player can improve by
 * reloading is not a measurement of the player.
 *
 * THE FIRST ANSWER IS THE ONE KEPT, and it is not a preference. It is the only one the record can
 * place before any verdict on that position existed: the store contract orders by `createdAt,
 * decisionId` on the database, by Map insertion in memory, and by append in the browser, and
 * `listDecisionIds` promises the same order as `listAtoms` for exactly this class of reason.
 *
 * FREE PLAY IS DELIBERATELY NOT TOUCHED, and the last case here is what holds that. The descriptive
 * reading never claimed a fixed item set -- `two-readings-two-populations` records ten decisions on
 * one FEN and expects ten -- so a rule that deduped it would be answering the bank's question with
 * the other population's data.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import * as service from "../../shared/record-service";
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { ANCHOR_POSITIONS } from "../../shared/anchor-set";
import { classifyPhase } from "../../shared/phase";
import type { DecisionPurpose } from "../../shared/confidence-asked";

const FREE_PLAY = "r2q1rk1/pp2bppp/2n1bn2/3pp3/3PP3/2N1BN2/PP2BPPP/R2Q1RK1 w - - 0 12";

let seq = 0;
const nextId = () => `33333333-3333-4333-8333-${String(++seq).padStart(12, "0")}`;

async function decide(
  store: MemoryRecordStore,
  options: { fen: string; accurate: boolean; purpose?: DecisionPurpose; build?: string },
) {
  const id = nextId();
  await service.commitDecision(store, {
    decision_id: id,
    entry_state: {
      game_id: "g",
      fen: options.fen,
      ply: 30,
      phase: classifyPhase(options.fen, 30),
      clock_ms_remaining: null,
    },
    purpose: options.purpose ?? "anchor",
    drill_id: null,
    transfer_id: null,
    known: "המרכז פתוח",
    unknown: "לא יודע איך הוא יענה",
    known_parts: { tapped: ["המרכז פתוח"], typed: "" },
    unknown_parts: { tapped: ["לא יודע איך הוא יענה"], typed: "" },
    decision: options.accurate ? "d4d5" : "d4c4",
    bounded_action: {
      seconds_taken: 20,
      confidence: CONFIDENCE_LEVELS,
      confidence_scale: CONFIDENCE_LEVELS,
      candidate_moves_considered: ["d4d5"],
    },
    probe: null,
    reveal_timing: "per-decision",
    measurement_protocol: null,
    protocol_version: null,
    analysis_timing: null,
    result: null,
    feedback: null,
  });
  await service.reveal(store, id, {
    engine_eval_cp: 20,
    engine_best_move: "d4d5",
    engine_depth: 18,
    engine_source: "local_sf18",
    engine_build: options.build ?? "sf18-test-build",
    cp_loss: options.accurate ? 0 : 300,
  });
}

describe("a bank position answered twice", () => {
  it("does not enter the between-player reading twice", async () => {
    const store = new MemoryRecordStore();
    for (let i = 0; i < 4; i += 1) await decide(store, { fen: ANCHOR_POSITIONS[i].fen, accurate: false });
    /* The reload path: the same position, answered again, this time with the verdict already seen. */
    await decide(store, { fen: ANCHOR_POSITIONS[0].fen, accurate: true });

    const reading = await service.recordReading(store);
    expect(reading.anchorAnswered.length, "the set-up did not answer four distinct positions").toBe(4);
    expect(
      reading.anchor.n,
      `the comparable reading counted ${reading.anchor.n} answers to ${reading.anchorAnswered.length} positions`,
    ).toBe(4);
  });

  it("keeps the answer taken before any verdict on that position existed", async () => {
    const store = new MemoryRecordStore();
    for (let i = 0; i < 4; i += 1) await decide(store, { fen: ANCHOR_POSITIONS[i].fen, accurate: false });
    await decide(store, { fen: ANCHOR_POSITIONS[0].fen, accurate: true });

    const reading = await service.recordReading(store);
    /*
     * Every first answer was wrong, so the observed rate at the stated level must be zero. If the
     * repeat were the one kept -- or if both were -- the player would have been credited with an
     * answer they gave after being told it.
     */
    const level = reading.anchor.levels.find((l) => l.n > 0);
    expect(level?.observed, "the post-verdict answer was credited to the player").toBe(0);
  });

  it("says how many repeats it set aside, so the count can name what it dropped", async () => {
    const store = new MemoryRecordStore();
    for (let i = 0; i < 4; i += 1) await decide(store, { fen: ANCHOR_POSITIONS[i].fen, accurate: false });
    await decide(store, { fen: ANCHOR_POSITIONS[0].fen, accurate: true });
    await decide(store, { fen: ANCHOR_POSITIONS[1].fen, accurate: true });

    const reading = await service.recordReading(store);
    expect(reading.anchorRepeated).toBe(2);
    expect(reading.anchor.n).toBe(4);
  });

  it("POSITIVE CONTROL: a record with no repeat loses nothing and reports nothing", async () => {
    /*
     * Without this the rule is indistinguishable from one that shrinks every bank reading, and the
     * qualification would appear on readings that do not need it -- which teaches a reader to
     * discount all of them.
     */
    const store = new MemoryRecordStore();
    for (let i = 0; i < 5; i += 1) await decide(store, { fen: ANCHOR_POSITIONS[i].fen, accurate: false });

    const reading = await service.recordReading(store);
    expect(reading.anchor.n).toBe(5);
    expect(reading.anchorRepeated).toBe(0);
  });

  it("POSITIVE CONTROL: free play is untouched, because it never claimed a fixed set", async () => {
    /*
     * The descriptive reading answers "what does this player's own play look like". Ten decisions
     * on one position are ten decisions there, and deduping them would answer the bank's question
     * with the other population's data.
     */
    const store = new MemoryRecordStore();
    for (let i = 0; i < 10; i += 1) await decide(store, { fen: FREE_PLAY, accurate: false, purpose: "play" });

    const reading = await service.recordReading(store);
    expect(reading.scored, "the described population was deduped by position").toBe(10);
  });

  it("cannot change which regime the reading describes, however many repeats arrive", async () => {
    /*
     * THE FAILURE MODE THIS PAIR OF RULES COULD HAVE HAD, and the one `67bad3c` calls disqualifying:
     * an instrument that answers differently because it was given more evidence. `regimeInForceFirst`
     * sizes the strata, so if it sized them by rows a pile of repeats in one regime could win it the
     * reading. It sizes by the population the reading is over, which repeats are not in.
     */
    const build = async (repeats: number) => {
      const store = new MemoryRecordStore();
      for (let i = 0; i < 4; i += 1) await decide(store, { fen: ANCHOR_POSITIONS[i].fen, accurate: false });
      for (let i = 0; i < repeats; i += 1) await decide(store, { fen: ANCHOR_POSITIONS[0].fen, accurate: true });
      return service.recordReading(store);
    };
    const none = await build(0);
    const many = await build(12);
    expect(many.anchor.n, "twelve repeats changed the size of the reading").toBe(none.anchor.n);
    expect(many.anchor.brier, "twelve repeats changed the reading itself").toBe(none.anchor.brier);
    expect(many.anchorRepeated).toBe(12);
  });

  it("cannot let a pile of repeats win a regime the contest it would otherwise lose", async () => {
    /*
     * WRITTEN BECAUSE THE FIRST VERSION OF THE CASE ABOVE DID NOT DISCRIMINATE. Sizing
     * `regimeInForceFirst` by rows instead of by the population the reading is over was reverted
     * into the tree on purpose and every case here stayed green: they all build ONE stratum, and
     * with one stratum the sizing function never runs.
     *
     * Two regimes, neither over `MIN_BUCKET_N`, so the choice falls back to size. The retired one
     * holds five distinct positions. The running one holds four, and ten repeats of one of them --
     * fourteen rows. By rows the repeats win it the reading and the answer is 4; by the population
     * the reading is over, the honest five-position regime wins and the answer is 5.
     */
    const store = new MemoryRecordStore();
    for (let i = 0; i < 5; i += 1) {
      await decide(store, { fen: ANCHOR_POSITIONS[i].fen, accurate: false, build: "sf18-retired" });
    }
    for (let i = 0; i < 4; i += 1) {
      await decide(store, { fen: ANCHOR_POSITIONS[i].fen, accurate: false, build: "sf19-running" });
    }
    for (let i = 0; i < 10; i += 1) {
      await decide(store, { fen: ANCHOR_POSITIONS[0].fen, accurate: true, build: "sf19-running" });
    }

    const reading = await service.recordReading(store);
    expect(
      reading.anchor.n,
      "a regime was chosen on the strength of its repeats",
    ).toBe(5);
  });

  it("is monotone: a new position only ever adds to the reading", async () => {
    /*
     * The other half of the same property. A repeat leaves the number where it was; a position the
     * player has not answered raises it. Neither ever lowers it, which is what "more evidence" has
     * to mean for a count.
     */
    const store = new MemoryRecordStore();
    const sizes: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      await decide(store, { fen: ANCHOR_POSITIONS[i].fen, accurate: false });
      sizes.push((await service.recordReading(store)).anchor.n);
      await decide(store, { fen: ANCHOR_POSITIONS[0].fen, accurate: true });
      sizes.push((await service.recordReading(store)).anchor.n);
    }
    expect(sizes, "the reading shrank as decisions were added").toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("POSITIVE CONTROL: progress through the set is not narrowed by the rule", async () => {
    /*
     * `anchorAnswered` decides which position the front door serves next. If the repeat rule reached
     * it, a player would be re-served a position they had answered -- which is the defect this file
     * is about, arriving from the other direction.
     */
    const store = new MemoryRecordStore();
    for (let i = 0; i < 4; i += 1) await decide(store, { fen: ANCHOR_POSITIONS[i].fen, accurate: false });
    await decide(store, { fen: ANCHOR_POSITIONS[0].fen, accurate: true });

    const reading = await service.recordReading(store);
    expect(reading.anchorAnswered.length).toBe(4);
  });
});
