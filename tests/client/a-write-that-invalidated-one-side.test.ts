/**
 * THE TWO DECISION WRITES RETURNED FROM THE SERVER PATH BEFORE INVALIDATING ANYTHING.
 *
 * FOUND BY A REVIEW BOT ON THE PULL REQUEST, at `Home.tsx`'s reveal, and confirmed in the source:
 * `useReveal` and `useCommitDecision` both open with `if (!local) return server.mutateAsync(...)`,
 * which returns BEFORE the `invalidateQueries` calls the local branch runs underneath. So on a
 * signed-in session a commit and a reveal left every record query holding what it held before the
 * write -- and `useRecordReading` passes `refetchOnWindowFocus: false`, so nothing brought it back.
 *
 * WHAT THAT PUTS ON THE SCREEN. `RevealPanel` reads `mixAll` from that query. Stale, it does not
 * contain the decision being revealed, so the accumulation block can tell a player that the branch
 * they are looking at has appeared `0 מתוך N` times -- a screen displaying a thing and counting it
 * zero, which is the same shape as the count `N-7` was about.
 *
 * AND THE RULE WAS ALREADY WRITTEN, ONE FUNCTION AWAY. `invalidateBlitz` states it in as many
 * words: *"BOTH SIDES ALWAYS, not the active one: signing in mid-session leaves the other side's
 * cache in place, and a screen that switched back would read a row from before the write."* That
 * argument was made for the two blitz writes and never carried to the two decision writes. It is
 * the fifth instance in this pass of a rule argued once, at the site where it was learned, and left
 * at its siblings -- so the repair is one function with both callers, not a line in each.
 *
 * WHY THIS FILE IS STRUCTURAL. The rule lives in the branch a hook takes, and reaching it needs a
 * tRPC client, a session and a server store. `readRecord` and `CountView.forReveal` are pinned the
 * same way for the same reason: some rules are only checkable where they are written, and a
 * behavioural test that cannot reach the branch is worth less than a source assertion that can.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "../../client/src/lib/record-api.ts"), "utf8");

/** The body of a named exported hook, from its declaration to the next top-level one. */
function bodyOf(name: string): string {
  const start = source.indexOf(`export function ${name}(`);
  expect(start, `${name} is no longer an exported function in record-api.ts`).toBeGreaterThan(-1);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

const WRITES = ["useCommitDecision", "useReveal"];

describe("a write that invalidated one side", () => {
  for (const write of WRITES) {
    it(`${write} does not return from the server path before invalidating`, () => {
      const body = bodyOf(write);
      /*
       * The exact shape the bot found. A bare `return server.mutateAsync(...)` is the early exit:
       * everything below it, including the invalidation, is unreachable on that path.
       */
      expect(
        body,
        `${write} returns the server mutation directly, so nothing is invalidated on that path`,
      ).not.toMatch(/if \(!local\) return server\.mutateAsync/);
    });

    it(`${write} invalidates through the shared rule rather than restating it`, () => {
      /*
       * A rule that lives in two places gets repaired in one -- which is how this defect survived
       * in the first place, one function below the argument for it.
       */
      expect(bodyOf(write)).toContain("invalidateRecord(");
    });
  }

  it("the shared rule reaches both sides, the way `invalidateBlitz` does", () => {
    const body = bodyOf("useCommitDecision");
    void body;
    const rule = source.slice(source.indexOf("async function invalidateRecord"));
    const stop = rule.indexOf("\n}\n");
    const fn = rule.slice(0, stop === -1 ? rule.length : stop);
    expect(fn, "the local keys are not invalidated").toContain("invalidateQueries");
    for (const procedure of ["reading", "count", "claim"]) {
      expect(fn, `the server's \`${procedure}\` query is never invalidated`).toContain(
        `utils.record.${procedure}.invalidate()`,
      );
    }
  });

  it("POSITIVE CONTROL: the blitz writes still invalidate through their own shared rule", () => {
    /*
     * Without this, a repair that deleted `invalidateBlitz` and inlined everything would pass every
     * case above. The two rules are separate on purpose -- different keys, different procedures --
     * and this file must not be readable as permission to merge them.
     */
    expect(source).toContain("async function invalidateBlitz");
    expect(bodyOf("useSaveBlitzGame")).toContain("invalidateBlitz(");
  });
});
