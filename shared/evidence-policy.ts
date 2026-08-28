/**
 * WHICH OBSERVATIONS EACH ANALYSIS MAY READ. One table, one authority, one version.
 *
 * THE HOLE THIS CLOSES. `currentClaim` called `listAtoms()` and handed every scoreable row to the
 * detector. Anchor answers, drill decisions, transfer checks, positions from games already played
 * and rows written before anything recorded why they existed all competed to become the next
 * finding about the player. So the product could take a player through a drill built to fix a
 * weakness, read the decisions that drill produced, and announce the next weakness from them --
 * evidence generated while trying to CHANGE the player, reused as evidence describing how the
 * player behaved. That is not a bug in a filter. There was no filter.
 *
 * WHY A MODULE AND NOT A CONDITION AT EACH CALL SITE. A per-consumer `if` is a rule enforced by
 * whoever remembers it, and the consumers are spread across a 1,600-line service, a dashboard
 * reader and a drill runner. One of them forgetting is invisible: the numbers still render, the
 * screens still agree, and the only symptom is a finding built on the wrong decisions months
 * later. The table below is the specification, the consumers ask it, and a test asserts that
 * deleting any single cell makes a positive control fail.
 *
 * DELIBERATELY CONSERVATIVE, AND THE COST IS REAL. Under this policy discovery reads free-play
 * decisions and nothing else -- not the front door's handoff, not the shared bank, not a drill,
 * not an imported game, and not a row that never recorded its context. On a record written before
 * the context existed that means the claim search goes quiet until new decisions accumulate. That
 * is the intended outcome and not an oversight: a source does not become eligible because
 * excluding it leaves too little data. If a later experiment justifies promoting one, the
 * promotion is a version bump here, with the argument written down beside it.
 */
import type { DecisionAtom } from "./decision-atom.js";
import type { DecisionPurpose } from "./confidence-asked.js";

/**
 * The version of this policy, carried by anything whose meaning depends on it.
 *
 * A claim formed under one policy was formed over a different population than the same bucket
 * would produce under another, so "the endgame gap" is not one quantity across a change here.
 * Anything that stores a finding stores this number beside it, and a comparison across two
 * versions has to say it is making one.
 */
export const EVIDENCE_POLICY_VERSION = 2;

/**
 * The analyses that read observations. One entry per consumer, not per screen: two screens
 * rendering the same population are one consumer, and a screen that needs a different population
 * is a new consumer that has to be added here before it can read anything.
 */
export type EvidenceConsumer =
  /** What the record says the player did. Descriptive, never a claim. */
  | "descriptive-history"
  /** The detector's search for a contrast that could become a hypothesis. */
  | "discovery"
  /** The shared bank -- the only reading comparable between players. */
  | "anchor-reference"
  /** Evidence that may move a ClaimGrade. */
  | "claim-validation"
  /** The learning layer: rules, transfer, spacing. */
  | "learning"
  /** The forward check on a rule the player wrote. */
  | "transfer";

/**
 * A row that never recorded why it existed.
 *
 * NOT A PURPOSE, which is why it is a separate key rather than a seventh member of the union. A
 * legacy decision is not a decision whose purpose was "legacy" -- nobody recorded one, and the
 * era it comes from contains bank answers, drills and transfer checks alongside ordinary moves.
 * Treating it as any single purpose would be assigning a fact that was never recorded.
 */
export const LEGACY_CONTEXT = "legacy" as const;
export type EvidenceContextKey = DecisionPurpose | typeof LEGACY_CONTEXT;

/**
 * What one consumer may do with observations from one context.
 *
 * Four outcomes rather than a boolean, because the table has four kinds of cell and flattening
 * them loses the distinctions that matter. "Refused" and "admitted only against the object it
 * belongs to" are not the same permission, and neither is "readable, but never pooled with the
 * main population".
 */
export type Admission =
  /** Read as part of this consumer's ordinary population. */
  | { readonly kind: "admitted"; readonly because: string }
  /** Not readable by this consumer at all. */
  | { readonly kind: "refused"; readonly because: string }
  /**
   * Readable ONLY against the specific protocol object it belongs to. A drill's decisions may
   * decide that drill's own verdict and nothing else; a transfer's may decide that transfer.
   */
  | { readonly kind: "scoped"; readonly to: "matching-test" | "matching-transfer"; readonly because: string }
  /**
   * Readable, but under its own heading and never pooled with the main population. This is the
   * measurement wall the record page already draws between confidence-bearing decisions and
   * imported accuracy, stated as policy rather than as layout.
   */
  | { readonly kind: "separate"; readonly section: string; readonly because: string };

const admitted = (because: string): Admission => ({ kind: "admitted", because });
const refused = (because: string): Admission => ({ kind: "refused", because });
const scoped = (to: "matching-test" | "matching-transfer", because: string): Admission => ({
  kind: "scoped",
  to,
  because,
});
const separate = (section: string, because: string): Admission => ({
  kind: "separate",
  section,
  because,
});

/*
 * Reasons that hold for several cells, named once.
 *
 * Repeating the sentence five times was duplication in the source before it was weight in the
 * bundle: five copies of one rule are five things to keep in step, and the next person to sharpen
 * the wording would have sharpened one of them.
 */
const OWN_EXERCISES = "The learning layer reads what happened inside its own exercises.";
const NAMED_IN_ADVANCE = "A transfer is graded on the positions it named in advance.";
const NOT_A_BANK_POSITION = "Not a bank position, so there is nothing here to compare between players.";

/**
 * THE TABLE. Every cell carries the reason it holds, because a refusal a reader cannot explain is
 * a refusal somebody will delete the next time it is inconvenient.
 *
 * `drill` IS ONE KEY AND NOT TWO, and that is a statement about the product as it stands rather
 * than an omission. The constitution separates a Prospective Claim Test from a Learning Drill,
 * and the separation is real work that has not been done: today's drill both changes a grade AND
 * tells the player the refutation condition before collecting the evidence, which is exactly the
 * object the split exists to pull apart. Filing today's rows under `claim_test` would assert they
 * are uncontaminated validation evidence. They are not. Naming the thing that exists keeps the
 * later split honest -- it will add a key and bump the version, rather than quietly redefining
 * what the rows already stored were.
 */
export const EVIDENCE_POLICY: Readonly<
  Record<EvidenceConsumer, Readonly<Record<EvidenceContextKey, Admission>>>
> = {
  "descriptive-history": {
    play: admitted("An ordinary decision in a game being played is what the record is about."),
    first: admitted("The player made it and it is theirs to see, whatever it may not be used for."),
    import: separate("games already played", "A different loop, and not comparable to live play."),
    anchor: separate("the shared bank", "Fixed positions everyone answers; its own denominator."),
    drill: separate("drills", "Taken while being taught, which is a different state to describe."),
    transfer: separate("rule checks", "Taken while applying a rule the player wrote."),
    [LEGACY_CONTEXT]: separate(
      "before the record said why",
      "Shown because the player made these decisions, labelled because nothing says what they were.",
    ),
  },
  discovery: {
    play: admitted(
      "Free play is the only behaviour nothing in this product was trying to change at the time.",
    ),
    first: refused("Taken before the player has seen what the loop asks, and exempt from the reads."),
    import: refused("A game already over. Nothing here was recorded under this protocol."),
    anchor: refused(
      "Fixed positions everyone answers. A contrast found in them is a fact about the bank.",
    ),
    /*
     * THE CLOSURE THIS WHOLE POLICY EXISTS FOR. A drill is an intervention: it selects positions
     * because of a weakness and tells the player what is being tested before collecting the
     * evidence. Reading its output as discovery lets the attempt to fix a weakness manufacture the
     * next one, which is the loop this product must not be able to close.
     */
    drill: refused("An intervention. Its output cannot describe behaviour it was changing."),
    transfer: refused("Taken while deliberately applying a rule. That is the intervention working."),
    [LEGACY_CONTEXT]: refused(
      "Nobody recorded why these existed, so nothing can say they were not interventions.",
    ),
  },
  "anchor-reference": {
    play: refused(NOT_A_BANK_POSITION),
    first: refused(NOT_A_BANK_POSITION),
    import: refused(NOT_A_BANK_POSITION),
    anchor: admitted("The shared bank is what this reading is."),
    drill: refused("A drill position is chosen for this player, which is the opposite of shared."),
    transfer: refused(NOT_A_BANK_POSITION),
    [LEGACY_CONTEXT]: refused("Cannot be shown to have been answered under the bank's protocol."),
  },
  "claim-validation": {
    play: scoped(
      "matching-test",
      "Only inside a registered observation window, and only for the test that registered it.",
    ),
    first: refused("Exempt from the read fields and taken before the loop was understood."),
    import: refused("Retrospective. It cannot postdate a hypothesis it was recorded before."),
    anchor: refused("The bank is a between-player reading, not a test of one player's claim."),
    drill: scoped(
      "matching-test",
      "A drill's decisions may decide that drill's own verdict and no other claim's.",
    ),
    transfer: refused("A rule check grades a rule the player wrote, not a claim the detector made."),
    [LEGACY_CONTEXT]: refused("Nothing says it postdates any hypothesis."),
  },
  learning: {
    play: refused(OWN_EXERCISES),
    first: refused(OWN_EXERCISES),
    import: refused(OWN_EXERCISES),
    anchor: refused(OWN_EXERCISES),
    drill: admitted("A drill is the learning layer's own exercise."),
    transfer: refused("A transfer has its own consumer, so a rule's check stays its own."),
    [LEGACY_CONTEXT]: refused(OWN_EXERCISES),
  },
  transfer: {
    play: refused(NAMED_IN_ADVANCE),
    first: refused(NAMED_IN_ADVANCE),
    import: refused(NAMED_IN_ADVANCE),
    anchor: refused(NAMED_IN_ADVANCE),
    drill: refused(NAMED_IN_ADVANCE),
    transfer: scoped(
      "matching-transfer",
      "A transfer's observations may decide that transfer and no other.",
    ),
    [LEGACY_CONTEXT]: refused(NAMED_IN_ADVANCE),
  },
};

/** The context key of one decision: its recorded purpose, or `legacy` when nothing recorded one. */
export function contextKeyOf(atom: DecisionAtom): EvidenceContextKey {
  return atom.purpose ?? LEGACY_CONTEXT;
}

/** What one consumer may do with one decision. The only way to ask. */
export function admissionFor(consumer: EvidenceConsumer, atom: DecisionAtom): Admission {
  return EVIDENCE_POLICY[consumer][contextKeyOf(atom)];
}

/**
 * The decisions and their ids, filtered in lockstep.
 *
 * BOTH ARRAYS OR NEITHER. `scoreDecisions(atoms, ids)` reads the two by index -- `ids[i]` is the
 * id of `atoms[i]` -- so a filter applied to one and not the other does not fail, it silently
 * relabels every decision after the first removal. Returning the pair from one function is what
 * makes that unexpressible at the call sites.
 */
export interface EvidenceSet {
  atoms: DecisionAtom[];
  ids: string[];
}

function admit(
  consumer: EvidenceConsumer,
  atoms: readonly DecisionAtom[],
  ids: readonly string[],
  keep: (admission: Admission) => boolean,
): EvidenceSet {
  const kept: EvidenceSet = { atoms: [], ids: [] };
  atoms.forEach((atom, index) => {
    if (!keep(admissionFor(consumer, atom))) return;
    kept.atoms.push(atom);
    kept.ids.push(ids[index] ?? `decision-${index}`);
  });
  return kept;
}

/**
 * The population the detector may search.
 *
 * ONLY `admitted`. A `scoped` cell is not a weaker yes -- it means the decisions may be read
 * against one named object, and discovery has no object to match them to. A `separate` cell means
 * the observations are reportable under their own heading, which is a description rather than a
 * search. Both collapse to "not here".
 */
export function forDiscovery(atoms: readonly DecisionAtom[], ids: readonly string[]): EvidenceSet {
  return admit("discovery", atoms, ids, (admission) => admission.kind === "admitted");
}

/**
 * Why one decision was left out, for a caller that has to explain a population rather than use it.
 *
 * R1 and R2 both want this: a count that shrank should be able to say what it dropped, and a
 * refusal nobody can explain is one that gets deleted the next time it is inconvenient.
 */
export function exclusionsFor(
  consumer: EvidenceConsumer,
  atoms: readonly DecisionAtom[],
): { context: EvidenceContextKey; n: number; because: string }[] {
  const counts = new Map<EvidenceContextKey, number>();
  for (const atom of atoms) {
    const key = contextKeyOf(atom);
    if (EVIDENCE_POLICY[consumer][key].kind === "admitted") continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([context, n]) => ({
    context,
    n,
    because: EVIDENCE_POLICY[consumer][context].because,
  }));
}
