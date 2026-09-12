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
