/**
 * WHAT A MOVE ON THE BOARD MAY BE USED FOR (`GATE-PLACEMENT-NOT-EVIDENCE`).
 *
 * `bounded_action.candidate_moves_considered` holds every move the player PUT ON THE BOARD before
 * committing. Two mechanisms produce the same entry and this record cannot separate them: a move
 * weighed and rejected, and a move the hand passed through -- a drag to look at a square and back,
 * or a mis-drag corrected before the commit, which the deciding screen explicitly invites by
 * saying "אפשר לשנות עד הרישום".
 *
 * `shared/reveal.ts` says so on the decision where it matters: `PLACEMENT_IS_NOT_CONSIDERATION`
 * renders in the inference limits whenever `bestMoveWasPlaced` is true, and the reading above it
 * stops short of naming which mechanism it was. THAT IS A SENTENCE, AND A SENTENCE PROTECTS ONE
 * SCREEN. What it cannot protect is the far more expensive version of the same mistake: a bucket,
 * a grade, a claim or a learning object formed from a field that carries an unresolved slip.
 *
 * TODAY NOTHING ON THE CLAIM PATH READS IT, which is exactly why this gate is worth writing now
 * rather than after something does. `shared/detector.ts`, `shared/claim.ts`,
 * `shared/claim-derivation.ts`, `shared/record-dashboard.ts` and `shared/learning-record.ts` are
 * all clean at the commit this was added. A gate written while an invariant already holds costs one
 * file; the same gate written afterwards costs a migration and an explanation to whoever read the
 * number in between.
 *
 * WHY AN ALLOWLIST AND NOT A FORBIDDEN-PATH LIST. A list of modules that may NOT read the field is
 * a list that a new module joins by not being on it -- the failure mode this repository has already
 * shipped twice, where a probe walks past a scan by adding a file the scan never heard of. The
 * permitted readers are few, stable, and each one is a place the field is carried rather than
 * interpreted: the schema that defines it, the stores that persist it, the service that maps it,
 * the screen that collects it, and the one module licensed to make a bounded statement about it.
 * Anything else is a finding, and adding a reader is a deliberate edit to this list with a reason
 * beside it.
 *
 * WHAT THIS CANNOT SEE, stated so the gate is not read as a proof. It matches the field's three
 * spellings in source text. A module that reached the value through an alias, a destructure two
 * hops away, or a generic record copy would pass. It closes the cheapest and most likely version --
 * a claim-path module naming the field directly -- and nothing beyond it.
 */

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { sourceFiles, stripComments, type Finding } from "./gate-scan";

const posix = (file: string) => file.replaceAll("\\", "/");

/**
 * The three spellings of one field: the wire/schema name, the store name, and the reveal's name.
 *
 * ALL THREE, because the value crosses two renames on its way from the board to a sentence and a
 * scan that knew only the schema spelling would have been blind to every consumer downstream of
 * `record-service`.
 */
const SPELLINGS = /candidate_moves_considered|candidateMovesConsidered|candidatesConsidered/;

/**
 * Files that may name the field, and what each one does with it.
 *
 * EVERY ENTRY IS A CARRIER OR A COLLECTOR, WITH ONE EXCEPTION. `shared/reveal.ts` is the exception
 * and it is the whole reason the list is annotated: it INTERPRETS the field, and it is allowed to
 * because it is also the module that states the interpretation's limit in the same breath. A second
 * interpreter would need the same property, and putting it on this list without it is the edit this
 * comment exists to make somebody notice.
 */
export const PLACEMENT_READERS: Readonly<Record<string, string>> = {
  "shared/decision-atom.ts": "defines the field",
  "shared/record-store.ts": "the store's row shape",
  "shared/record-service.ts": "maps the atom onto the row and back",
  "shared/counterfactual.ts": "names it in prose to say what it is NOT",
  "shared/reveal.ts": "interprets it, and states the limit of that interpretation beside it",
  "server/record.ts": "persists it",
  "client/src/lib/local-record-store.ts": "persists it in the browser",
  "client/src/lib/decision-session.ts": "collects it while the decision is open",
  "client/src/pages/Home.tsx": "collects it from the board",
  "client/src/components/CommitmentScreen.tsx": "shows the player what they placed",
};

export function findPlacementReadEvidence(roots: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const rel = posix(relative(process.cwd(), file));
      if (rel in PLACEMENT_READERS) continue;
      const source = stripComments(readFileSync(file, "utf8"));
      const line = source.split("\n").findIndex((text) => SPELLINGS.test(text));
      if (line === -1) continue;
      findings.push({
        file: rel,
        line: line + 1,
        text:
          "reads the moves a player placed on the board. A placement is not a consideration: " +
          "a mis-drag and a weighed move are the same entry. Add a reason to PLACEMENT_READERS " +
          "in scripts/placement-scan.ts, or read something that is not ambiguous.",
      });
    }
  }
  return findings;
}
