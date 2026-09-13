/**
 * Code that exists, passes its tests, and no user path reaches (`GATE-JOURNEY-REACHABLE`).
 *
 * THIS REPOSITORY HAS SHIPPED THIS CLASS THREE TIMES AND CAUGHT IT LATE EVERY TIME. Layer C's unit
 * tests passed for months while no router imported it. `DrizzleRecordStore` had never executed a
 * statement, because its tests skipped without `DATABASE_URL`. And the learning journey shipped
 * with `loopPosition`'s `rules` branch proved by nine tests and reached by nothing: `ruleLoad` was
 * exported and called by no product file, so a player with a retrieval test due still read "more
 * decisions may produce the next claim". Every one of those was green.
 *
 * WHAT THIS CAN AND CANNOT SEE, stated because a gate whose limits are not written down gets read
 * as a proof. It checks that a named module's exports have a caller under `client/src`, and that a
 * named component is rendered somewhere under `client/src`. It CANNOT tell whether the call site is
 * on a path a user can walk, whether the render is behind a condition that is never true, or
 * whether the rendered thing is visible. It closes the cheapest and most-repeated version of the
 * class -- an export with no caller at all -- and nothing beyond it.
 *
 * SCOPED TO A NAMED FAMILY RATHER THAN THE WHOLE TREE. A repository-wide unused-export scan would
 * flag every public API written for a consumer that does not exist yet, and a gate that fires on
 * things that are fine is a gate people learn to ignore.
 */

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { sourceFiles, type Finding } from "./gate-scan";

const posix = (file: string) => file.replaceAll("\\", "/");

/**
 * The family this gate covers, and what each member must be reached by.
 *
 * `definedIn` is excluded from its own search by name: a module mentions its own exports, and a
 * scanner that counted those would report everything as reached.
 */
export const REACHABLE_FAMILY: ReadonlyArray<{
  definedIn: string;
  kind: "export" | "component";
  names: readonly string[];
}> = [
  {
    definedIn: "client/src/lib/rule-load.ts",
    kind: "export",
    names: ["ruleLoad"],
  },
  {
    definedIn: "client/src/lib/journey-readings.ts",
    kind: "export",
    names: ["recordReading", "ruleReadings"],
  },
  {
    definedIn: "client/src/components/JourneyLedger.tsx",
    kind: "component",
    names: ["JourneyLedger"],
  },
  {
    definedIn: "client/src/components/GoalNote.tsx",
    kind: "component",
    names: ["GoalNote"],
  },
  {
    definedIn: "client/src/lib/player-goal.ts",
    kind: "export",
    names: ["readGoal", "writeGoal"],
  },
];

export function findUnreachedMembers(roots: string[]): Finding[] {
  const out: Finding[] = [];
  for (const member of REACHABLE_FAMILY) {
    for (const name of member.names) {
      let reached = false;
      for (const root of roots) {
        for (const file of sourceFiles(root)) {
          const path = posix(relative(process.cwd(), file));
          if (path.endsWith(member.definedIn)) continue;
          const source = readFileSync(file, "utf8");
          /*
           * A CALL OR A RENDER, NOT A MENTION. `ruleLoad(` and `<JourneyLedger` are uses; the same
           * word inside a comment or a type position is not, and counting it would let a module
           * stay "reached" by the docblock that describes it.
           */
          const used =
            member.kind === "component"
              ? new RegExp(`<${name}[\\s/>]`).test(source)
              : new RegExp(`\\b${name}\\s*\\(`).test(source);
          if (used) {
            reached = true;
            break;
          }
        }
        if (reached) break;
      }
      if (!reached) {
        out.push({
          file: member.definedIn,
          line: 1,
          text: `${name} is exported and no product file ${member.kind === "component" ? "renders" : "calls"} it`,
        });
      }
    }
  }
  return out;
}
