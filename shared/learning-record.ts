import { z } from "zod";

export const MECHANISM_CLASSES = [
  "threat_scan",
  "candidate_generation",
  "calculation",
  "evaluation",
  "time_allocation",
] as const;
export type MechanismClass = (typeof MECHANISM_CLASSES)[number];

export const LEARNING_RULE_GRADES = ["hypothesis", "replicated", "refuted", "retired"] as const;
export type LearningRuleGrade = (typeof LEARNING_RULE_GRADES)[number];

export const RETRIEVAL_INTERVAL_DAYS = [1, 3, 7, 21] as const;
export const TRANSFER_POSITION_COUNT = 3;
export const TRANSFER_MINIMUM_SUCCESSES = 2;

export const reflectionDraftSchema = z.object({
  revised_read: z.string().trim().min(1).max(200),
  would_choose_again: z.boolean(),
});
export type ReflectionDraft = z.infer<typeof reflectionDraftSchema>;

export const learningRuleDraftSchema = z.object({
  source_decision_id: z.string().uuid(),
  trigger: z.string().trim().min(1).max(200),
  mechanism_class: z.enum(MECHANISM_CLASSES),
  missed_signal: z.string().trim().min(1).max(200),
  action_rule: z.string().trim().min(1).max(300),
  exception_rule: z.string().trim().max(200).nullable(),
  predicted_outcome: z.string().trim().min(1).max(300),
  refutation_condition: z.string().trim().min(1).max(500),
});
export type LearningRuleDraft = z.infer<typeof learningRuleDraftSchema>;

export interface LearningRule extends LearningRuleDraft {
  rule_id: string;
  readonly authored_by: "player";
  grade: LearningRuleGrade;
  /** Index into RETRIEVAL_INTERVAL_DAYS for the next delayed test. */
  retrieval_step: number;
  next_due_at: string | null;
  created_at: string;
  last_evaluated_at: string;
}

export interface LearningTransfer {
  transfer_id: string;
  rule_id: string;
  fens: string[];
  rule_snapshot: Pick<
    LearningRule,
    "trigger" | "mechanism_class" | "action_rule" | "predicted_outcome"
  >;
  refutation_condition: string;
  minimum_successes: number;
  retrieval_step: number;
  scheduled_for: string;
  started_at: string;
}

export interface LearningTransferObservation {
  decision_id: string;
  /** Written before reveal. Empty recall is recorded as a failed retrieval, not omitted. */
  recalled_rule: string;
  /** Player report; outcome accuracy is derived from the revealed DecisionAtom. */
  applied_rule: boolean;
}

/**
 * Build an observation, or refuse to build one.
 *
 * `applied_rule` is the player's report of whether they used their own rule, and it is half of
 * `successes` -- the number the preregistered refutation condition is tested against. The client
 * held it as `boolean | null` and wrote `learningTransferApplied ?? false`, guarded by a check
 * earlier in the same callback and a comment saying the default could not fire.
 *
 * It could. `onCommit` did not list that value among its dependencies, so a stale `null` would
 * have become a written `false`: "did not apply the rule", about a player who said they did, in
 * an append-only record, with every screen showing the right answer. The dependency is fixed;
 * this exists so the next way of reaching that line is a thrown error rather than a fabricated
 * observation. A missing measurement must not be recorded as a measured negative.
 */
export function transferObservation(input: {
  decision_id: string;
  recalled_rule: string;
  applied_rule: boolean | null;
}): LearningTransferObservation {
  if (input.applied_rule === null)
    throw new Error(
      "לא ניתן לרשום תצפית העברה בלי תשובה על יישום הכלל: היעדר תשובה אינו תשובה שלילית.",
    );
  return {
    decision_id: input.decision_id,
    recalled_rule: input.recalled_rule,
    applied_rule: input.applied_rule,
  };
}

export interface LearningTransferResult {
  readonly kind: "learning_transfer_result";
  transfer_id: string;
  rule_id: string;
  decision_ids: string[];
  recalled_rules: string[];
  applied_rule: boolean[];
  successes: number;
  observed: boolean;
  completed_at: string;
}

const addDays = (iso: string, days: number): string => {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

export function formLearningRule(
  raw: LearningRuleDraft,
  options: { rule_id: string; created_at: string },
): LearningRule {
  const draft = learningRuleDraftSchema.parse(raw);
  return {
    ...draft,
    rule_id: options.rule_id,
    authored_by: "player",
    grade: "hypothesis",
    retrieval_step: 0,
    next_due_at: addDays(options.created_at, RETRIEVAL_INTERVAL_DAYS[0]),
    created_at: options.created_at,
    last_evaluated_at: options.created_at,
  };
}

export function preregisterLearningTransfer(
  rule: LearningRule,
  fens: string[],
  options: { transfer_id: string; started_at: string },
): LearningTransfer {
  if (rule.grade === "refuted" || rule.grade === "retired") {
    throw new Error(`cannot test a ${rule.grade} learning rule`);
  }
  if (fens.length !== TRANSFER_POSITION_COUNT) {
    throw new Error(`a transfer test requires exactly ${TRANSFER_POSITION_COUNT} unseen positions`);
  }
  if (!rule.refutation_condition.trim()) {
    throw new Error("a transfer test requires a stored refutation condition");
  }
  return {
    transfer_id: options.transfer_id,
    rule_id: rule.rule_id,
    fens: [...fens],
    rule_snapshot: {
      trigger: rule.trigger,
      mechanism_class: rule.mechanism_class,
      action_rule: rule.action_rule,
      predicted_outcome: rule.predicted_outcome,
    },
    refutation_condition: rule.refutation_condition,
    minimum_successes: TRANSFER_MINIMUM_SUCCESSES,
    retrieval_step: rule.retrieval_step,
    scheduled_for: rule.next_due_at ?? options.started_at,
    started_at: options.started_at,
  };
}

/**
 * THE GRADE IS DERIVED FROM THE RESULTS, NOT ACCUMULATED ONTO THE RULE.
 *
 * This used to take one result and step the rule forward from wherever it stood: `retrieval_step`
 * incremented, `next_due_at` recomputed, `grade` possibly closed. That made the rule's schedule an
 * accumulator whose correctness depended on every result having been folded in exactly once --
 * across two unrelated writes, in two stores, neither of which has a transaction.
 *
 * An injected failure between those writes showed what that costs. `finishLearningTransfer` writes
 * the result, then writes the graded rule. Lose the second and the record holds two days of
 * successful transfer with the rule still marked `hypothesis` -- and the retry branch, which exists
 * so a lost response can be reported again, handed back the rule AS STORED. The recovery path was
 * what made the loss permanent: the result row exists, so the retry short-circuits forever, and no
 * later call would ever grade that sitting.
 *
 * A fold over the whole result set has no such state. Run it once or five times, before the crash
 * or after it, and the same record produces the same rule. It is the same reason `recall.coverage`
 * is not stored beside `recalled_rules`: derived beats duplicated, and here it also beats losable.
 *
 * `retired` is the one thing not derivable this way -- it is an act of the player's, not a reading
 * of the evidence -- so it is checked before the fold and never rebuilt by it.
 */
export function gradeLearningRule(
  rule: LearningRule,
  results: LearningTransferResult[],
): LearningRule {
  if (rule.grade === "retired") return rule;

  /*
   * Ordered by completion, because the fold reproduces the sequence the sittings happened in and
   * `refuted` is terminal within it. Ties break on the transfer id so the ordering is total: two
   * results stamped the same instant must not grade differently depending on row order.
   */
  const ordered = [...results].sort(
    (a, b) =>
      a.completed_at.localeCompare(b.completed_at) || a.transfer_id.localeCompare(b.transfer_id),
  );

  // The rule as authored. Every schedule field below it is a function of the results, so the fold
  // starts from what `formLearningRule` wrote and never from what a previous grading left behind.
  let folded: LearningRule = {
    ...rule,
    grade: "hypothesis",
    retrieval_step: 0,
    next_due_at: addDays(rule.created_at, RETRIEVAL_INTERVAL_DAYS[0]),
    last_evaluated_at: rule.created_at,
  };
  const priors: LearningTransferResult[] = [];
  for (const result of ordered) {
    folded = applyTransferResult(folded, priors, result);
    priors.push(result);
  }
  return folded;
}

function applyTransferResult(
  rule: LearningRule,
  priorResults: LearningTransferResult[],
  result: LearningTransferResult,
): LearningRule {
  if (result.rule_id !== rule.rule_id) throw new Error("transfer result belongs to another rule");
  if (rule.grade === "retired" || rule.grade === "refuted") return rule;

  const nextStep = Math.min(rule.retrieval_step + 1, RETRIEVAL_INTERVAL_DAYS.length);
  const nextInterval = RETRIEVAL_INTERVAL_DAYS[nextStep];

  /*
   * REFUTING IS AS HARD AS REPLICATING, and the asymmetry it replaces was the most damaging thing
   * in this file.
   *
   * One failed test used to set `grade: "refuted"` and `next_due_at: null` -- permanent, from a
   * single sitting of three positions -- while REPLICATING required success on two separate days.
   * So the product needed two days of evidence to say a rule worked and one bad afternoon to say
   * it did not, on a sample every single-case standard consulted calls too small either way.
   *
   * That asymmetry turned every weakness of the recall measure into a permanent verdict about a
   * person. `shared/recall-score.ts` is word overlap and marks a correct paraphrase wrong; a
   * review then found a rule whose text the measure cannot see AT ALL ("f7 f2"), scoring 0/3 on
   * perfect recall and zero centipawns lost, refuted forever, with a message blaming the retrieval
   * schedule. A measure with known false negatives must not be able to close a question.
   *
   * Two failed days now, mirroring the two successful ones. A rule that fails once stays in the
   * queue and comes back at the next interval, which is also what the retrieval schedule is FOR.
   */
  const failedDays = new Set(
    [...priorResults.filter((r) => !r.observed), ...(result.observed ? [] : [result])].map((r) =>
      r.completed_at.slice(0, 10),
    ),
  );
  if (!result.observed && failedDays.size >= 2) {
    return {
      ...rule,
      grade: "refuted",
      retrieval_step: nextStep,
      next_due_at: null,
      last_evaluated_at: result.completed_at,
    };
  }

  const successDays = new Set(
    [...priorResults.filter((r) => r.observed), ...(result.observed ? [result] : [])].map((r) =>
      r.completed_at.slice(0, 10),
    ),
  );
  return {
    ...rule,
    grade: successDays.size >= 2 ? "replicated" : rule.grade,
    retrieval_step: nextStep,
    next_due_at: nextInterval === undefined ? null : addDays(result.completed_at, nextInterval),
    last_evaluated_at: result.completed_at,
  };
}

export function retireLearningRule(rule: LearningRule, retiredAt: string): LearningRule {
  return { ...rule, grade: "retired", next_due_at: null, last_evaluated_at: retiredAt };
}
