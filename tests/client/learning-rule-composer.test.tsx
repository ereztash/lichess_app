// @vitest-environment jsdom
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LocalRecordStore,
  resetSessionFallbackForTests,
} from "../../client/src/lib/local-record-store";
import * as service from "../../shared/record-service";

vi.mock("../../client/src/lib/record-api", () => ({
  useCreateLearningRule: () => ({
    mutateAsync: (input: Parameters<typeof service.createLearningRule>[1]) =>
      service.createLearningRule(new LocalRecordStore(), input, {
        rule_id: "rule-test",
        created_at: "2026-01-01T00:00:00.000Z",
      }),
  }),
}));

const { LearningRuleComposer } = await import("../../client/src/components/LearningRuleComposer");

const ID = "11111111-1111-4111-8111-111111111111";
const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

beforeEach(async () => {
  localStorage.clear();
  resetSessionFallbackForTests();
  vi.stubGlobal("fetch", () => Promise.reject(new Error("no server")));
  const store = new LocalRecordStore();
  await service.commitDecision(store, {
    decision_id: ID,
    entry_state: { game_id: "g", fen: FEN, ply: 0, phase: "opening", clock_ms_remaining: null },
    known: "The center is open",
    unknown: "A forcing move may exist",
    decision: "e2e4",
    bounded_action: { seconds_taken: 10, confidence: 3, confidence_scale: CONFIDENCE_LEVELS, candidate_moves_considered: ["e2e4"] },
    result: null,
    feedback: null,
  });
  await service.reveal(store, ID, {
    engine_eval_cp: 0,
    engine_best_move: "d2d4",
    engine_depth: 18,
    engine_source: "local_sf18",
    cp_loss: 40,
  });
});

function renderComposer(onSaved = vi.fn()) {
  render(<LearningRuleComposer sourceDecisionId={ID} onSaved={onSaved} />);
  return onSaved;
}

describe("player-authored learning rule composer", () => {
  it("starts empty and stores the player's own language as a hypothesis", async () => {
    const onSaved = renderComposer();
    const save = screen.getByRole("button", { name: /שמירת כלל/ });
    expect(save).toBeDisabled();
    expect(
      screen.getAllByRole("textbox").every((field) => (field as HTMLInputElement).value === ""),
    ).toBe(true);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/מה אתם מבינים עכשיו/), "פספסתי שח כפוי");
    await user.type(screen.getByLabelText(/מתי הכלל אמור/), "כאשר מבנה הרגלים ליד המלך משתנה");
    await user.type(screen.getByLabelText(/איזה סימן/), "נפתח קו למלכה");
    await user.type(screen.getByLabelText(/מה תעשו/), "אסרוק שחים, הכאות ואיומים לפני מסע שקט");
    await user.type(screen.getByLabelText(/איזו תוצאה אתם מצפים/), "פחות החמצות טקטיות");
    await user.type(
      screen.getByLabelText(/איזו תוצאה תפריך/),
      "פחות משתי הצלחות בשלוש עמדות חדשות",
    );
    await user.click(save);

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    const [rule] = await new LocalRecordStore().listLearningRules();
    expect(rule).toMatchObject({
      authored_by: "player",
      grade: "hypothesis",
      action_rule: "אסרוק שחים, הכאות ואיומים לפני מסע שקט",
    });
  });
});
