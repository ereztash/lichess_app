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
import type { RevealTiming } from "./reveal-timing.js";
import { protocolOf, type ProtocolKey } from "./measurement-protocol.js";

/**
 * The version of this policy, carried by anything whose meaning depends on it.
 *
 * A claim formed under one policy was formed over a different population than the same bucket
 * would produce under another, so "the endgame gap" is not one quantity across a change here.
 * Anything that stores a finding stores this number beside it, and a comparison across two
 * versions has to say it is making one.
 */
export const EVIDENCE_POLICY_VERSION = 3;

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
 * WHY DISCOVERY RETURNS STRATA AND NOT A SET, which is the shape change this module needed.
 *
 * THE TABLE ABOVE ASKS A QUESTION ABOUT A ROW: may this consumer read this decision? That is the
 * right question for a purpose -- a drill decision is inadmissible on its own, one at a time. It is
 * the WRONG question for a protocol or a reveal timing, because those describe an incompatibility
 * BETWEEN decisions. No single row is "pooled". A set is.
 *
 * So the axis cannot be a seventh column in the table, and asking it row by row would always answer
 * yes: every `play` decision is individually fine, and forty of them from two different regimes are
 * not one population. `reveal-timing.ts` has said this since it was written -- *"the two are not
 * poolable, and every decision records which was in force"* -- and until now nothing enforced it.
 * The recording happened. The wall did not exist.
 *
 * A STRATUM IS A SET THAT IS SAFE TO POOL, and there is deliberately no function on this module
 * that flattens strata back into one. Refusing to provide the operation is stronger than
 * documenting that it is wrong: the old shape let a caller pool by doing nothing at all, which is
 * how this defect survived a policy module written specifically to prevent it.
 */
export interface StratumKey {
  /** What the decision recorded about its conditions, or `legacy` when it recorded nothing. */
  protocol: ProtocolKey;
  /**
   * WHICH VERSION OF THAT PROTOCOL PRODUCED IT, or `legacy`.
   *
   * THE FIELD WAS ALREADY STAMPED ON EVERY ROW AND NOTHING READ IT. `measurement-protocol.ts` has
   * said since it was written that "if the confidence sampling rate moves, or the moment the
   * question appears moves, then the protocol before and after are two populations. The version is
   * what lets a later reader tell them apart" -- and this key, the one thing in the product that
   * decides what may be pooled, did not carry it. The recording happened; the wall did not exist.
   * That is the same sentence this module already writes about reveal timing, one axis up.
   *
   * `shared/blitz-strata.ts` GOT THIS RIGHT AND WAS NEVER GENERALISED. `BlitzStratumKey` carries
   * `protocolVersion` and `samplingPolicyVersion`, with the argument spelled out: "an axis that is
   * free while it is constant is the only kind that ever gets added, and the day one of them moves
   * is the day pooling across it would have been silent." The version moved to 2 in the commit that
   * added this axis, on the standard loop -- so this is that day, and until now the split would in
   * fact have been silent.
   *
   * LEGACY IS ITS OWN STRATUM, not version 1. A row that recorded no version is not evidence that
   * it ran under the first one; it is a row from before the field existed, and the whole argument
   * against backfilling `measurement_protocol` applies unchanged to its version.
   */
  protocolVersion: number | typeof LEGACY_CONTEXT;
  /**
   * Which reveal timing was in force, or `legacy`.
   *
   * NULL IS ITS OWN STRATUM AND NOT A THIRD MODE. A row that never recorded a timing is not
   * evidence that the timing was absent; it is a row from before the field existed, and pooling it
   * with either mode would assert a condition nobody wrote down.
   */
  revealTiming: RevealTiming | typeof LEGACY_CONTEXT;
  /**
   * WHICH BUILD OF THE ENGINE PASSED THE VERDICT, or `legacy` while there is no verdict yet.
   *
   * `engine_source` is not this. It names a family -- `local_sf18` or `lichess_cloud` -- and
   * `docs/ACTION_PLAN.md` B1 measured a change WITHIN the local family: 13.61% of decisions flipped
   * verdict between two engines that would both have written `local_sf18`. Two rows agreeing on the
   * source are not two rows from one instrument.
   *
   * A REVEALED ROW THAT NAMES NO BUILD NEVER REACHES THIS KEY. It is refused outright by
   * `readableInstrument` below, so `legacy` in this slot means one thing only: nothing has scored
   * this decision yet. That keeps it out of every population without inventing a build for it.
   */
  engineBuild: string | typeof LEGACY_CONTEXT;
}

/** One stratum: a set of decisions that share the conditions that make them comparable. */
export interface Stratum extends EvidenceSet {
  key: StratumKey;
}

/** A stratum key as a single string, so it can index a map and appear in a message. */
export function stratumId(key: StratumKey): string {
  /*
   * THE BUILD IS PERCENT-ENCODED AND THE OTHERS ARE NOT, which is not an inconsistency. Protocol
   * and reveal timing are closed enums and the version is a positive integer or `legacy`, so no
   * value of any of them can contain a separator. The build is free text out of a record, and two
   * regimes sharing an id would be silent pooling arriving through the identifier of the module
   * that exists to prevent it.
   *
   * THE VERSION IS JOINED TO ITS PROTOCOL WITH `@` RATHER THAN A FOURTH `/` SEGMENT, because it
   * qualifies that protocol and means nothing without it: `legacy@legacy` is one fact, not two.
   */
  return `${key.protocol}@${key.protocolVersion}/${key.revealTiming}/${encodeURIComponent(key.engineBuild)}`;
}

/**
 * Whether this row's verdict can be read at all.
 *
 * FALSE IS NOT "NOT ADMITTED HERE" -- IT IS "NOT READABLE ANYWHERE". Every other refusal in this
 * module is a statement about one consumer: a drill decision is inadmissible to discovery and
 * perfectly readable as history. This one is a property of the observation. A `cp_loss` whose
 * engine nothing recorded is a number that any of several instruments could have produced, and
 * B1's 13.61% says those instruments disagree about which decisions were mistakes. It cannot be
 * compared to another row, and it cannot be compared to a threshold either.
 *
 * AN UNREVEALED ROW IS NOT UNREADABLE. It has no verdict yet and it may get one; that is a wait,
 * not a defect, and `scoreDecisions` has counted it separately since it was written.
 */
export function readableInstrument(atom: DecisionAtom): boolean {
  return !atom.result || atom.result.engine_build !== undefined;
}

function stratumKeyOf(atom: DecisionAtom): StratumKey {
  return {
    protocol: protocolOf(atom.measurement_protocol),
    protocolVersion: atom.protocol_version ?? LEGACY_CONTEXT,
    revealTiming: atom.reveal_timing ?? LEGACY_CONTEXT,
    engineBuild: atom.result?.engine_build ?? LEGACY_CONTEXT,
  };
}

/**
 * The population the detector may search.
 *
 * ONLY `admitted`. A `scoped` cell is not a weaker yes -- it means the decisions may be read
 * against one named object, and discovery has no object to match them to. A `separate` cell means
 * the observations are reportable under their own heading, which is a description rather than a
 * search. Both collapse to "not here".
 */
export function forDiscovery(
  atoms: readonly DecisionAtom[],
  ids: readonly string[],
): Stratum[] {
  return stratify(admit("discovery", atoms, ids, (a) => a.kind === "admitted"));
}

/**
 * Group an admitted set into the populations that are safe to pool, largest first.
 *
 * SHARED BY BOTH READING CONSUMERS RATHER THAN WRITTEN TWICE, and the second consumer is the
 * reason this is a function at all. `forDescriptiveHistory` returned a flat `EvidenceSet`, so the
 * record page pooled regimes by doing nothing -- which is the precise failure this module's own
 * header describes about the shape it replaced: *"the old shape let a caller pool by doing nothing
 * at all, which is how this defect survived a policy module written specifically to prevent it."*
 * One grouping means the wall cannot hold on one surface and not on the other.
 */
function stratify(admitted: EvidenceSet): Stratum[] {
  const byId = new Map<string, Stratum>();
  admitted.atoms.forEach((atom, index) => {
    const key = stratumKeyOf(atom);
    const id = stratumId(key);
    const stratum = byId.get(id) ?? { key, atoms: [], ids: [] };
    stratum.atoms.push(atom);
    stratum.ids.push(admitted.ids[index] ?? `decision-${index}`);
    byId.set(id, stratum);
  });
  /*
   * ORDERED BY HOW MANY ROWS COULD EVER BE SCORED, not by how many rows each stratum holds, and the
   * two differ by exactly one thing: a revealed decision whose verdict names no engine.
   *
   * A caller takes the head, and such a row can never contribute to a finding however many of them
   * there are -- `scoreDecisions` refuses it, permanently. Counting it would let a pile of them win
   * the contest and hand the detector a stratum that scores to nothing: a silence produced by the
   * ordering rather than by the record, and the worst kind, because the record would contain a
   * perfectly good population that was never looked at.
   *
   * AN UNREVEALED ROW STILL COUNTS, and that is deliberate. It has no verdict yet and it may get
   * one, so it is a row this stratum is accumulating rather than a row it cannot use. Excluding it
   * would make the choice alphabetical on a record where nothing has been revealed, which is every
   * record on its first day.
   *
   * On a record with no unreadable rows -- every record written from here on -- this is the row
   * count it replaces, so nothing about the existing ordering changes.
   */
  const scoreable = (s: Stratum) =>
    s.atoms.reduce((n, a) => n + (readableInstrument(a) ? 1 : 0), 0);
  return [...byId.values()].sort(
    (a, b) => scoreable(b) - scoreable(a) || stratumId(a.key).localeCompare(stratumId(b.key)),
  );
}

/**
 * WHICH STRATUM THE DETECTOR ACTUALLY SEARCHES, and the reason this is a separate function.
 *
 * Splitting the population is an ENGINEERING fix: the old code pooled regimes and could not have
 * done otherwise, and nothing about the split expresses an opinion. Choosing among the strata is a
 * SCIENTIFIC decision, and this repository's rule is that one must not ride along inside the other.
 *
 * THE RULE IS "THE LARGEST", AND ITS ONE VIRTUE IS THAT IT IGNORES THE ANSWER. It is chosen before
 * anything is scored, from sizes alone, so it cannot select the regime that happens to contain a
 * finding. It changes today's behaviour as little as a non-pooling rule can: a record with one
 * regime is unaffected, which is every record written before reveal timing existed.
 *
 * WHAT IT IS NOT. It is not an argument that the largest regime is the right one to study. There is
 * a real case that discovery should prefer `end-of-game` -- a decision taken twenty moves into a
 * coached game was made by somebody being told, twenty times, how their last move scored, and
 * `reveal-timing.ts` says exactly that. Adopting that preference would silence the detector for
 * most players, because the coached mode is the default. That trade is a decision about what the
 * product measures, it belongs to whoever owns the product, and it is deliberately not smuggled in
 * here. When it is made, it changes this function and bumps EVIDENCE_POLICY_VERSION.
 *
 * A TIE IS BROKEN BY NAME, not by order of arrival, so the same record always yields the same
 * search rather than one that depends on the order rows were written.
 */
export function discoverySearchPopulation(strata: readonly Stratum[]): {
  chosen: Stratum | null;
  setAside: { id: string; n: number }[];
} {
  const [chosen = null, ...rest] = strata;
  return {
    chosen,
    setAside: rest.map((s) => ({ id: stratumId(s.key), n: s.atoms.length })),
  };
}

/**
 * What the record may say the player DID: free play and the front door's handoff.
 *
 * `separate` IS NOT ADMITTED HERE EITHER, and that is the whole of this consumer. A bank answer, a
 * drill decision, a transfer check and a position from a game already played are all readable --
 * under their own heading, with their own denominator. Pooling them into one calibration number
 * makes it a number about a mixture of protocols: the bank is a fixed set everyone answers, a
 * drill selected its positions BECAUSE of a weakness, and a transfer check is the player
 * deliberately applying a rule. An average over those is not a description of anybody's play.
 */
export function forDescriptiveHistory(
  atoms: readonly DecisionAtom[],
  ids: readonly string[],
): Stratum[] {
  return stratify(admit("descriptive-history", atoms, ids, (a) => a.kind === "admitted"));
}

/**
 * The shared bank, and only the shared bank.
 *
 * BY WHAT THE DECISION WAS FOR, NOT BY WHERE THE PIECES STOOD. The anchor readings used to be
 * filtered with `isAnchorFen` -- bank membership of the position -- which is a different question.
 * A drill can legitimately run on a bank position, and `decisionPurposeFor` ranks `drill` above
 * `anchor` precisely because what is being measured there is the drill. Under the FEN filter that
 * decision entered the between-player comparison, where it was never randomised to belong.
 */
export function forAnchorReference(
  atoms: readonly DecisionAtom[],
  ids: readonly string[],
): Stratum[] {
  /*
   * STRATIFIED FOR THE SAME REASON THE OTHER TWO ARE, and this is the consumer where it matters
   * most. The bank is the only reading this product claims is comparable BETWEEN players, and the
   * whole of that claim is that the item difficulty is held fixed. Two answers to the same position
   * scored by two engine builds do not hold anything fixed -- B1 measured 13.61% of verdicts
   * flipping across exactly that change -- and a comparison across it is an artefact of the bump.
   */
  return stratify(admit("anchor-reference", atoms, ids, (a) => a.kind === "admitted"));
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
