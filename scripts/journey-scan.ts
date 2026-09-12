/**
 * Two claims a new learning layer makes, held by scanning rather than by intention.
 *
 * Both exist because the thing they guard is invisible to every gate already here. `GATE-DENOM`
 * reads a paragraph for a percentage with no denominator beside it; neither defect below contains
 * a percentage, and one of them contains no arithmetic at all.
 */

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { sourceFiles, type Finding } from "./gate-scan";

const posix = (file: string) => file.replaceAll("\\", "/");

/**
 * The goal's text may leave storage in exactly one place (`GATE-GOAL-CONTAINED`).
 *
 * WHY THE ADJACENCY SCAN BELOW IS NOT ENOUGH, PROVEN BY PROBE. `findGoalBesideACount` keys on the
 * tokens `GOAL_LEAD`, `PlayerGoal` and `goal.statement`. A component that takes the sentence as a
 * prop called `statement`, prints a hardcoded Hebrew lead and puts a count in the same element
 * carries the exact defect and contains none of those tokens. Written as a probe during an
 * assurance pass, it passed every gate.
 *
 * So the adjacency scan keeps its job -- it is the within-file check on the one file allowed to
 * render the goal -- and this one closes the way around it. The goal reaches the DOM only through
 * `readGoal`, and `readGoal` may be called only from the component that owns the goal. A second
 * renderer cannot get the text without a call this refuses.
 *
 * WHAT IT STILL CANNOT SEE: a caller inside `GoalNote` that passes the sentence onward to a child
 * in another file. That is a narrower hole than the one it closes and it is not closed here.
 */
export function findGoalReadOutsideItsOwner(roots: string[]): Finding[] {
  const out: Finding[] = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const path = posix(relative(process.cwd(), file));
      if (GOAL_OWNERS.some((owner) => path.endsWith(owner))) continue;
      const source = readFileSync(file, "utf8");
      for (const [index, line] of source.split("\n").entries()) {
        if (/\breadGoal\s*\(/.test(line)) {
          out.push({
            file: path,
            line: index + 1,
            text: "the goal is read outside the component that owns it",
          });
        }
      }
    }
  }
  return out;
}

/** The module that defines the read, and the one component allowed to perform it. */
const GOAL_OWNERS = ["client/src/lib/player-goal.ts", "client/src/components/GoalNote.tsx"];

/**
 * A journey stage's number may be read in exactly one place (`GATE-CONSTRUCT-NAMED`).
 *
 * WHY THE PARAGRAPH SCAN BELOW IS NOT ENOUGH, PROVEN BY PROBE. `findUnnamedConstructs` keys on the
 * literal `count.n`. `const { n } = reading.count` renders the same number, carries the same
 * defect, and does not match. Written as a probe during an assurance pass, it passed every gate.
 *
 * So the paragraph scan stays as the within-file check on the one file allowed to render a stage,
 * and this refuses the reading of `JourneyReading.count` anywhere else, in any spelling: a file
 * that mentions the count of a journey reading at all, and is not the ledger, is reported.
 */
export function findStageCountReadOutsideTheLedger(roots: string[]): Finding[] {
  const out: Finding[] = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const path = posix(relative(process.cwd(), file));
      if (path.endsWith(COUNT_OWNER)) continue;
      const source = readFileSync(file, "utf8");
      for (const [index, line] of source.split("\n").entries()) {
        /*
         * Any read of a reading's count, however spelled: the property access, a destructure of it,
         * or the type itself used somewhere that is not the ledger.
         */
        if (/\.count\b|\bJourneyCount\b|\{\s*n\s*[,}]\s*=?/.test(line) && /count|Journey/.test(source)) {
          if (/reading\.count|\.count\.n|JourneyCount|=\s*reading\.count|\}\s*=\s*\w*\.?count\b/.test(line)) {
            out.push({
              file: path,
              line: index + 1,
              text: "a journey stage count is read outside the ledger that renders it",
            });
          }
        }
      }
    }
  }
  return out;
}

/** The one component allowed to read a stage's count. */
const COUNT_OWNER = "client/src/components/JourneyLedger.tsx";

/**
 * A goal rendered in the same element as a count (`GATE-GOAL-NOT-A-DENOMINATOR`).
 *
 * WHAT THE DEFECT LOOKS LIKE ON SCREEN. The player wrote "I'm 1500 and I want 1800". Put that
 * sentence in the same row as "42 decisions measured" and the reader supplies the arithmetic the
 * product refused to do: two numbers and a direction is a progress bar with the bar left out. The
 * code computes nothing, every gate passes, and the screen still promises distance to a target.
 *
 * SO THE SCAN IS ABOUT ADJACENCY, NOT ABOUT MATHS. It finds the element that renders the goal and
 * refuses a `JourneyCount`, a `<Value`, or a brace-wrapped `.n` inside it. The goal gets its own
 * element with nothing countable in it, or it does not render.
 */
export function findGoalBesideACount(roots: string[]): Finding[] {
  const out: Finding[] = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, "utf8");
      if (!/GOAL_LEAD|PlayerGoal|goal\.statement/.test(source)) continue;
      const lines = source.split("\n");
      for (const [index, line] of lines.entries()) {
        if (!/GOAL_LEAD|goal\.statement/.test(line)) continue;
        /*
         * The element is the blank-line paragraph, the same window `GATE-DENOM` settled on and for
         * the same reason: it is where this codebase and prettier separate one rendered thing from
         * the next, so the verdict does not depend on how a line happened to wrap.
         */
        const start = lastBlankBefore(lines, index);
        const end = firstBlankAfter(lines, index);
        const element = lines.slice(start, end).join("\n");
        if (COUNTABLE.test(element)) {
          out.push({
            file: posix(relative(process.cwd(), file)),
            line: index + 1,
            text: "the goal renders in the same element as a count",
          });
        }
      }
    }
  }
  return out;
}

/** A number the reader can put the goal over: a journey count, a Value, or a rendered `.n`. */
const COUNTABLE = /JourneyCount|<Value|\{[^}]*\.n\b|\bcount\.n\b|\bscored\b|\bMIN_BUCKET_N\b/;

/**
 * A journey stage rendered without saying what its number counts (`GATE-CONSTRUCT-NAMED`).
 *
 * THE WHOLE POINT OF THE STATE MACHINE IS THAT NO TWO STAGES SHARE A NUMBER. A drill score, a
 * prompted-retrieval score and a count of unprompted decisions are three constructs, and rendering
 * any of them as a bare figure re-creates the single progress number the architecture was chosen to
 * avoid. `JourneyCount.construct` is what prevents it, so a file that renders `count.n` without
 * also rendering `count.construct` has dropped the only thing that made the number readable.
 */
export function findUnnamedConstructs(roots: string[]): Finding[] {
  const out: Finding[] = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, "utf8");
      const lines = source.split("\n");
      for (const [index, line] of lines.entries()) {
        if (!/\{[^}]*\bcount\.n\b/.test(line)) continue;
        const start = lastBlankBefore(lines, index);
        const end = firstBlankAfter(lines, index);
        const element = lines.slice(start, end).join("\n");
        if (!/count\.construct/.test(element)) {
          out.push({
            file: posix(relative(process.cwd(), file)),
            line: index + 1,
            text: "a stage count renders without the construct it counts",
          });
        }
      }
    }
  }
  return out;
}

function lastBlankBefore(lines: string[], at: number): number {
  for (let i = at; i >= 0; i -= 1) if (lines[i].trim() === "") return i + 1;
  return 0;
}

function firstBlankAfter(lines: string[], at: number): number {
  for (let i = at; i < lines.length; i += 1) if (lines[i].trim() === "") return i;
  return lines.length;
}

/**
 * A panel's finding rendered after, or quieter than, the numbers it is about
 * (`GATE-FINDING-OUTRANKS-ITS-NUMBERS`).
 *
 * THE DEFECT THIS EXISTS FOR SHIPPED, AND WAS FOUND BY LOOKING RATHER THAN BY A TEST. The import
 * panel listed six accuracy rates in its largest type and then, roughly eight hundred phone pixels
 * below them and after a horizontal rule, said through `NotMeasured` that none of them separates
 * from the others. `NotMeasured` renders `.value-provenance`: the register this codebase reserves
 * for WHERE A NUMBER CAME FROM. So a conclusion was wearing the typography of a footnote about the
 * numbers it was denying.
 *
 * WHAT IS CHECKED, and it is deliberately the narrow half. A file that renders a reading list
 * (`.bucket-list`) must render its finding BEFORE that list in source order, and must not render
 * the finding through `NotMeasured`. Source order is not visual order in general -- but in this
 * codebase these are block elements in one column, and the shipped defect was exactly a source
 * ordering. What this CANNOT check is relative type size, which lives in CSS, and it does not
 * pretend to: the register half is enforced by refusing `NotMeasured`, which is the one component
 * that guarantees the wrong size.
 *
 * NOT A CLAIM ABOUT READERS. That the ordering renders the denial below the ranking is an
 * observation. That players misread it needs R6 and is not asserted by this gate.
 */
export function findFindingsBelowTheirNumbers(roots: string[]): Finding[] {
  const out: Finding[] = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, "utf8");
      if (!/className="bucket-list"/.test(source)) continue;
      const path = posix(relative(process.cwd(), file));
      const lines = source.split("\n");
      /*
       * ONLY A LIST THAT INVITES A RANKING READ. A `.bucket-list` whose rows are a COMPOSITION --
       * how the one-thing kinds divide up, each a share of the same n -- carries no claim that one
       * row is worse than another, so demanding a separation finding above it would be demanding a
       * sentence about a comparison nobody made. The discriminator is the row content: a signed gap
       * or an accuracy rate is a quantity readers rank; a share of a whole is not.
       *
       * Found by this gate firing on `MixBlock` on its first run, which was the gate being too
       * broad rather than a second defect.
       */
      const list = lines.findIndex(
        (l, i) =>
          /className="bucket-list"/.test(l) &&
          /SignedProportion|accurateRate|versusPopulation/.test(lines.slice(i, i + 40).join("\n")),
      );
      if (list === -1) continue;
      /*
       * A RENDER, NOT A DEFINITION, and the difference is why this gate once passed on the defect
       * it was written for. The first pattern also matched `className="import-finding"` inside the
       * component's own body, which sits above the list in the same file -- so moving the CALL back
       * to the bottom, which is exactly the shipped state, left the gate green. Same trap LAW 1's
       * scanner avoids by excluding a component's own file by name.
       */
      const finding = lines.findIndex((l) => /<[A-Za-z]*Finding[\s/>]/.test(l));
      if (finding === -1) {
        out.push({ file: path, line: list + 1, text: "a reading list with no finding above it" });
      } else if (finding > list) {
        out.push({
          file: path,
          line: finding + 1,
          text: "the finding renders after the numbers it is about",
        });
      }
      for (const [index, line] of lines.entries()) {
        if (/<NotMeasured\b/.test(line) && /separ|נבדל|קרובים|סף/.test(line)) {
          out.push({
            file: path,
            line: index + 1,
            text: "a finding rendered through NotMeasured, which is the provenance register",
          });
        }
      }
    }
  }
  return out;
}
