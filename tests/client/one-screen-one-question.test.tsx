// @vitest-environment jsdom
/**
 * §14: one screen, one question -- as a mechanism rather than as a rule.
 *
 * THE PLAN STATES IT AS A LAW, and laws drift. Nobody adds a fourth question to a screen
 * deliberately; a panel grows a helpful extra section over six commits and nobody reads the whole
 * screen at once again. So the question each surface answers is DECLARED in
 * `shared/screen-questions.ts`, and this file asserts that the declaration and the screen cannot
 * come apart: the declared string is the region's accessible label AND its heading, from one
 * constant, so improving one of them improves both.
 *
 * THE LABEL BEING THE ACCESSIBLE NAME IS NOT A COINCIDENCE. A screen reader announcing "what
 * happened in this game" on entering the region tells its user exactly what §14 wants every user
 * told. A region labelled with a noun -- "record", "analysis", "dashboard" -- names a container;
 * one labelled with a question names its job.
 *
 * §15 IS THE SECOND HALF OF THIS FILE. Complexity is not deleted, it stops compelling everyone to
 * read it -- so every disclosure on these surfaces must start CLOSED, and what is behind it must be
 * in the document rather than fetched on open. A `<details open>` is a section pretending to be a
 * disclosure.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SCREEN_QUESTIONS, SCREEN_QUESTION_LIST } from "@shared/screen-questions";

const root = resolve(__dirname, "../..");
const CLIENT = resolve(root, "client/src");

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if ([".ts", ".tsx"].includes(extname(full))) out.push(full);
  }
  return out;
}

const clientFiles = sources(CLIENT).map((file) => ({ file, text: readFileSync(file, "utf8") }));

/** The five surfaces that carry a declared question, and the file each lives in. */
const SURFACES: readonly { key: keyof typeof SCREEN_QUESTIONS; file: string }[] = [
  { key: "resume", file: "client/src/components/ResumeScreen.tsx" },
  { key: "postGame", file: "client/src/components/PostGame.tsx" },
  { key: "unclear", file: "client/src/components/WhatIsUnclear.tsx" },
  { key: "underTest", file: "client/src/components/WhatIsUnderTest.tsx" },
  { key: "outcome", file: "client/src/components/OutcomeSummary.tsx" },
];

describe("one screen, one question", () => {
  it("declares a distinct question for every surface", () => {
    expect(new Set(SCREEN_QUESTION_LIST).size).toBe(SCREEN_QUESTION_LIST.length);
    expect(SCREEN_QUESTION_LIST).toHaveLength(SURFACES.length);
  });

  it.each(SURFACES)("labels $key's region from the table, not from a literal", ({ key, file }) => {
    const text = readFileSync(resolve(root, file), "utf8");
    expect(text, `${file} does not read its question from the table`).toContain(
      `aria-label={SCREEN_QUESTIONS.${key}}`,
    );
  });

  it("keeps every declared question out of the source as a bare literal", () => {
    /*
     * THE ASSERTION WITH TEETH, and it is the one that catches the real failure. A heading beside
     * an `aria-label` saying the same sentence is the same sentence written twice, and the way that
     * fails is not that they disagree today -- it is that somebody improves one of them. Both now
     * read the constant, and this stops the next copy from being pasted in.
     */
    const offenders: string[] = [];
    for (const { file, text } of clientFiles) {
      for (const question of SCREEN_QUESTION_LIST) {
        if (text.includes(`"${question}"`) || text.includes(`>${question}<`)) {
          offenders.push(`${file}: ${question}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it.each(SURFACES)("gives $key exactly one labelled region", ({ key, file }) => {
    // Two regions with one question is two screens sharing a heading.
    const text = readFileSync(resolve(root, file), "utf8");
    const uses = text.split(`aria-label={SCREEN_QUESTIONS.${key}}`).length - 1;
    expect(uses).toBe(1);
  });

  it.each(SURFACES)("gives $key at most one finding card", ({ key, file }) => {
    /*
     * The 1-1-1-1 law at the level of the screen rather than of the card. A surface rendering two
     * cards is answering two questions, whatever its label says -- and the type system cannot catch
     * it, because a second `<FindingCard>` is perfectly well-typed.
     */
    const text = readFileSync(resolve(root, file), "utf8");
    expect(text.split("<FindingCard").length - 1, `${file} renders more than one card`).toBeLessThanOrEqual(1);
  });
});

describe("progressive disclosure, not deletion (§15)", () => {
  it("opens no disclosure by default, anywhere in the client", () => {
    /*
     * A `<details open>` is a section pretending to be a disclosure: it costs the reader the same
     * attention as an always-visible block while looking like something they chose to expand.
     */
    const offenders = clientFiles
      .filter(({ text }) => /<details[^>]*\sopen[\s>]/.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("gives every disclosure a summary that says what opening it answers", () => {
    /*
     * "פרטים" names a drawer. "למה אנחנו אומרים את זה?" names what opening it answers, which is the
     * only reason anybody opens one. Asserted as the absence of the container words rather than as
     * the presence of a question, because there are legitimately many good summaries and only a few
     * bad ones, and the bad ones are the same three words every time.
     */
    const CONTAINER_WORDS = [">פרטים<", ">עוד<", ">מידע נוסף<"];
    const offenders: string[] = [];
    for (const { file, text } of clientFiles) {
      for (const word of CONTAINER_WORDS) if (text.includes(word)) offenders.push(`${file}: ${word}`);
    }
    expect(offenders).toEqual([]);
  });

  it("keeps what is behind the disclosure IN the document, not fetched on open", () => {
    /*
     * §15 says complexity is not deleted, it stops compelling everyone to read it. Content that
     * arrives only on open is deleted for anybody who does not open it -- and, more concretely, is
     * not there for a find-in-page, a screen reader's browse mode, or a copy of the whole card into
     * a bug report. Asserted as the absence of an `onToggle` handler that loads: a `<details>` in
     * this codebase renders its children eagerly, and that is the property being protected.
     */
    const offenders = clientFiles
      .filter(({ text }) => /<details[^>]*onToggle/.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
