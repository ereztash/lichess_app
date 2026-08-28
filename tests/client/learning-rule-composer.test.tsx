// @vitest-environment jsdom
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { render, screen, waitFor, within } from "@testing-library/react";
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
    probe: null,
    reveal_timing: null,
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
    /*
     * Both choices made explicitly. This test used to save without touching either, and passed --
     * because the form pre-selected "סריקת איומים" and "לא" and required neither. It was
     * therefore an assertion that the DEFAULTS round-tripped, wearing the name of an assertion
     * that the player's own language did.
     */
    await user.click(screen.getByRole("button", { name: "סריקת איומים" }));
    await user.click(within(screen.getByRole("group", { name: /בוחרים שוב/ })).getByText("לא"));
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

/**
 * The reflection the record kept, said out loud on the screen that holds the other one.
 *
 * `createLearningRule` writes the reflection and the rule in two statements with no transaction,
 * and this form keeps every field on screen after a failure. So a player whose rule write was lost
 * edits a word and presses save again — sending a DIFFERENT reflection for a decision that already
 * has one. The service used to refuse the whole operation, which locked that decision out of ever
 * carrying a rule. It now keeps the reflection already on the record and writes the rule.
 *
 * Which means the text in the box is not what the record holds, and the form has to say so. Closing
 * silently would leave the player believing what they typed was stored — the same defect, moved.
 */
describe("the reflection the record kept", () => {
  const fill = async (user: ReturnType<typeof userEvent.setup>, revisedRead: string) => {
    await user.type(screen.getByLabelText(/מה אתם מבינים עכשיו/), revisedRead);
    await user.type(screen.getByLabelText(/מתי הכלל אמור/), "כאשר מבנה הרגלים ליד המלך משתנה");
    await user.type(screen.getByLabelText(/איזה סימן/), "נפתח קו למלכה");
    await user.type(screen.getByLabelText(/מה תעשו/), "אסרוק שחים, הכאות ואיומים לפני מסע שקט");
    await user.type(screen.getByLabelText(/איזו תוצאה אתם מצפים/), "פחות החמצות טקטיות");
    await user.type(screen.getByLabelText(/איזו תוצאה תפריך/), "פחות משתי הצלחות בשלוש עמדות חדשות");
    await user.click(screen.getByRole("button", { name: "סריקת איומים" }));
    await user.click(within(screen.getByRole("group", { name: /בוחרים שוב/ })).getByText("לא"));
    await user.click(screen.getByRole("button", { name: /שמירת כלל/ }));
  };

  it("names what was kept, and does not close until the player has seen it", async () => {
    // A reflection is already on this decision, which is what a lost rule write leaves behind.
    await service.feedback(new LocalRecordStore(), ID, {
      revisedRead: "פספסתי שח כפוי",
      wouldChooseAgain: false,
    });

    const onSaved = renderComposer();
    await fill(userEvent.setup(), "פספסתי שח כפוי, וגם לא ספרתי חומר");

    const kept = await screen.findByRole("status");
    expect(kept.textContent, "the kept reflection is not named").toContain("פספסתי שח כפוי");
    // The rule IS saved -- that is the whole point of no longer refusing.
    expect(await new LocalRecordStore().listLearningRules()).toHaveLength(1);
    // And the form stays until acknowledged, so the notice cannot be missed.
    expect(onSaved).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: "הבנתי" }));
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("says nothing when the reflection was the first one, which is every ordinary save", async () => {
    // The half that makes the notice mean something: a message that always shows is not a message.
    const onSaved = renderComposer();
    await fill(userEvent.setup(), "פספסתי שח כפוי");
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("the record says the player authored it, so the player has to have answered", () => {
  /*
   * `authored_by: "player"` is written on every rule and is the product's claim about where the
   * content came from. Two of the fields were PRE-SELECTED and neither was required to save:
   * `mechanism_class` opened on "threat_scan", and "would you choose it again" opened on "לא" with
   * `aria-pressed` already set. A player could save without touching either, and the record would
   * carry two answers they never gave under a field asserting they did.
   *
   * The mechanism is the more consequential of the two: it is the rule's own account of WHAT WENT
   * WRONG, so defaulting it means every untouched rule in the record blames threat scanning.
   */

  /** Fill every free-text field, leaving both choices untouched. */
  async function fillText() {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/מה אתם מבינים עכשיו/), "פספסתי שח כפוי");
    await user.type(screen.getByLabelText(/מתי הכלל אמור/), "כאשר מבנה הרגלים משתנה");
    await user.type(screen.getByLabelText(/איזה סימן/), "נפתח קו למלכה");
    await user.type(screen.getByLabelText(/מה תעשו/), "אסרוק שחים לפני מסע שקט");
    await user.type(screen.getByLabelText(/איזו תוצאה אתם מצפים/), "פחות החמצות");
    await user.type(screen.getByLabelText(/איזו תוצאה תפריך/), "פחות משתי הצלחות");
    return user;
  }
  const save = () => screen.getByRole("button", { name: /שמירת כלל/ });
  const pressedIn = (name: RegExp) =>
    [...screen.getByRole("group", { name }).querySelectorAll("button")]
      .filter((button) => button.getAttribute("aria-pressed") === "true")
      .map((button) => button.textContent);

  it("starts with no mechanism selected", () => {
    renderComposer();
    expect(pressedIn(/מנגנון/), "a mechanism was chosen for the player").toEqual([]);
  });

  it("starts with neither answer pressed on 'would you choose it again'", () => {
    // `aria-pressed={!wouldChooseAgain}` rendered "לא" as chosen from the first paint, so a screen
    // reader announced an answer the player had not given.
    renderComposer();
    expect(pressedIn(/בוחרים שוב/)).toEqual([]);
  });

  it("will not save until both have been chosen explicitly", async () => {
    renderComposer();
    const user = await fillText();
    expect(save(), "saveable with two unanswered questions").toBeDisabled();

    await user.click(screen.getByRole("button", { name: "חישוב" }));
    expect(save(), "saveable with one unanswered question").toBeDisabled();

    await user.click(within(screen.getByRole("group", { name: /בוחרים שוב/ })).getByText("לא"));
    expect(save()).not.toBeDisabled();
  });

  it("stores what the player chose, not what the form opened on", async () => {
    /*
     * The control that matters. A form that merely LOOKS unselected while still posting a default
     * would pass both tests above and write exactly the same false record.
     *
     * "חישוב" and "כן" are chosen because they are the OPPOSITE of the old defaults on both
     * questions -- picking values that happened to match them would prove nothing.
     */
    const onSaved = renderComposer();
    const user = await fillText();
    await user.click(screen.getByRole("button", { name: "חישוב" }));
    await user.click(within(screen.getByRole("group", { name: /בוחרים שוב/ })).getByText("כן"));
    await user.click(save());

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    const [rule] = await new LocalRecordStore().listLearningRules();
    expect(rule.mechanism_class).toBe("calculation");
    const atom = await new LocalRecordStore().getAtom(ID);
    expect(atom?.feedback?.would_choose_again).toBe(true);
  });
});

describe("the hardest thing on the reveal is not also the biggest thing on it", () => {
  /*
   * MEASURED. Built app, Chromium, 390x844, first reveal from an empty profile: this section was
   * 877px of a 3315px page -- 26%, the largest single element on it, and twice the height of the
   * whole reveal panel above it. Nine fields asking for a falsifiable rule, open by default, on
   * decision number one, seven hundred pixels below the reveal's own sentence saying "זו החלטה
   * אחת שנרשמה. שום דבר כאן אינו דפוס".
   *
   * NOTHING IS GATED AND NOTHING WAS REMOVED. A rule written from one decision is a hypothesis,
   * and the product grades it by testing it forward on new decisions -- which is exactly what it
   * is for. What was wrong was the weight.
   */
  it("opens closed, with the offer still fully on screen", () => {
    const { container } = render(<LearningRuleComposer sourceDecisionId={ID} onSaved={() => {}} />);
    const details = container.querySelector("details.learning-composer-body");
    expect(details, "the composer's fields are not behind a disclosure").not.toBeNull();
    expect(details!.hasAttribute("open"), "the composer still opens expanded").toBe(false);
    // The summary IS the heading it replaced, so the offer costs the same screen it always did.
    expect(details!.querySelector("summary")?.textContent).toContain("נסחו כלל שאפשר להפריך");
  });

  it("keeps every field, so this is a weight change and not a removal", () => {
    const { container } = render(<LearningRuleComposer sourceDecisionId={ID} onSaved={() => {}} />);
    const fields = container.querySelectorAll(
      ".learning-composer-fields textarea, .learning-composer-fields input",
    );
    expect(fields.length, "fields were dropped rather than folded").toBeGreaterThan(5);
    expect(
      container.querySelector(".learning-composer-fields .learning-save"),
      "the save control left the disclosure and now sits alone",
    ).not.toBeNull();
  });
});
