/**
 * How much rule work is waiting, for the one surface that says where you are.
 *
 * ITS OWN MODULE, AND THE REASON IS BYTES RATHER THAN TIDINESS. This lived in
 * `journey-readings.ts` beside the ledger's adapter, and `useLoopPosition` is on the decision
 * screen -- so importing it from there pulled `@shared/learning-journey` and the learning-record
 * zod schemas back into the entry chunk that every arrival downloads, 4.1 kB of it, for two
 * integers. The bundle budget refused it, which was the correct answer: the pointer needs a count
 * of what is due, not the machinery that renders a stage.
 *
 * SO THE TYPE IS STRUCTURAL AND NOT `LearningRule`. Importing the interface would import the module
 * that declares it, which is the schema file, which is the cost this module exists to avoid. The
 * two fields below are the whole of what a due-count needs, and `ruleLoad` is called with real
 * `LearningRule`s that structurally satisfy it.
 */

/** The part of a learning rule a due-count reads. Deliberately not the whole type. */
export interface RuleDueFields {
  grade: string;
  next_due_at: string | null;
}

/**
 * What the loop pointer needs to know about rules: how many are due, and how many are open.
 *
 * `hypothesis` AND `replicated` ARE THE LIVE ONES. A refuted rule is closed by the record and a
 * retired rule is closed by the player; neither is work waiting, and counting them would send a
 * player to a queue with nothing in it.
 */
export function ruleLoad(
  rules: readonly RuleDueFields[] | undefined,
  now: Date,
): { due: number; open: number } {
  if (!rules?.length) return { due: 0, open: 0 };
  const live = rules.filter((rule) => rule.grade === "hypothesis" || rule.grade === "replicated");
  const due = live.filter(
    (rule) => rule.next_due_at !== null && new Date(rule.next_due_at) <= now,
  ).length;
  return { due, open: live.length };
}
