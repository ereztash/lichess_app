/**
 * WHICH FORWARD TESTS MAY DECIDE A CLAIM, AND WHICH MAY ONLY SPEAK ABOUT IT.
 *
 * `validation-protocol.ts` says which protocol a claim about a given bucket requires: a position
 * drill for a claim about a board, a timed holdout for a claim about a clock. Writing that down
 * did not change what the product does -- `beginDrill` builds a static drill for a
 * `fast-under-45s` claim and `finishDrill` grades it, terminally, and both positions in that
 * argument were held by people who had thought about it (`docs/blitz/ADR-003`).
 *
 * THIS IS THE RESOLUTION THAT THROWS NEITHER AWAY. The drill still runs and its result is still
 * recorded and still moves the grade -- so nothing the player did is discarded, and the capability
 * is not withdrawn. What changes is that the grade now NAMES THE PROTOCOL THAT PRODUCED IT, and a
 * result from a protocol the claim does not require may never LOCK the claim: a timed holdout can
 * still speak afterwards, in either direction.
 *
 * SO THE ASYMMETRY IS THE POINT. The old rule let a clockless drill do the one thing that cannot be
 * undone -- `refuted` is terminal and `beginDrill` refuses a refuted claim forever. A protocol that
 * removes the condition the claim is about must not be able to close the question, and that is
 * true of closing it in EITHER direction: a player who calibrates fine with no clock running has
 * not shown that they calibrate fine under one, and a player who slips with no clock running has
 * not shown that the clock is why.
 *
 * IT IS THE SAME PRINCIPLE THE EVIDENCE WALL ALREADY RUNS ON. `evidence-policy.ts` returns strata
 * keyed by protocol and refuses to flatten them; `measurement-protocol.ts` records what the world
 * was like while a decision was made. Evidence has carried its protocol here for some time. This
 * extends that to the one place it had not reached, which is the place it matters most, because
 * grading is where a measurement becomes a verdict.
 */
import { protocolFor, PROTOCOL_KINDS, type ProtocolKind } from "./validation-protocol.js";

/**
 * A forward test that never recorded which protocol it ran under.
 *
 * NOT A PROTOCOL, which is why it is a separate key rather than a third member of the union --
 * the same argument `measurement-protocol.ts` makes for `LEGACY_PROTOCOL` and `evidence-policy.ts`
 * makes for `LEGACY_CONTEXT`.
 */
export const LEGACY_VALIDATION = "legacy" as const;

/** What a stored forward test says about the protocol it ran under. */
export type ValidationKey = ProtocolKind | typeof LEGACY_VALIDATION;

/**
 * The stored vocabulary, COMPOSED from the protocol list rather than restated beside it.
 *
 * A second hand-written copy of these strings is how a schema and its type drift apart: the enum
 * column would go on accepting a protocol the code had stopped emitting, or refuse one it had
 * started to. Adding a protocol to `PROTOCOL_KINDS` widens this automatically.
 */
export const VALIDATION_KEYS = [...PROTOCOL_KINDS, LEGACY_VALIDATION] as const;

/**
 * The protocol a claim about this bucket requires, read from the claim's own id.
 *
 * DERIVED FROM THE ID AND NOWHERE ELSE, for the reason `claimIdFor` gives: the id is a function of
 * the bucket the claim is ACTUALLY about, so a caller cannot re-derive the bucket and get a
 * different answer than the one the claim was stored under.
 */
export function requiredProtocolFor(claimId: string): ProtocolKind | null {
  return protocolFor(claimId.startsWith("claim-") ? claimId.slice("claim-".length) : claimId);
}

/**
 * Whether a forward test under this protocol may CLOSE the question.
 *
 * A LEGACY RESULT STILL DECIDES, and that is deliberate rather than an oversight. Every drill
 * reported before this file existed was graded under the old rule, terminally, and the player was
 * told the outcome. `evaluateClaim` is a fold over the stored results, so a legacy result that
 * stopped being authoritative would not merely change the rule going forward -- it would silently
 * re-grade claims that were already decided, on the next read, with nothing recording that it had
 * happened. Rewriting a verdict somebody has already seen is a worse failure than carrying an old
 * one that is now named as old.
 *
 * A CLAIM WHOSE BUCKET NOBODY HAS CLASSIFIED IS GRADED BY THE OLD RULE, and the first version of
 * this function got that backwards. It read `protocolFor`'s null as "nothing may decide this",
 * which sounds like the same caution `protocolFor` itself exercises and is not: `protocolFor`
 * refuses to NAME a protocol, and this function decides whether a question may ever be CLOSED.
 * An unclassified bucket that nothing can settle is not cautious, it is a claim that flips between
 * `replicated` and `refuted` with every drill, forever, because refutation has stopped being
 * terminal without anything else becoming authoritative.
 *
 * Found by a test, not by reading: `tests/shared/claim.test.ts` asserts a refuted claim stays
 * refuted through a later contradicting drill, and it went red on a fixture whose claim id is not
 * one of the six buckets.
 *
 * SO THE NARROWING IS ONLY WHERE THERE IS AN IDENTIFIED CONTRADICTION. ADR-003 is about a protocol
 * that demonstrably removes the condition the claim is about. Where the requirement is unknown,
 * nothing has been shown to be wrong, and the grading rule stands exactly as it did -- which is
 * also the reversible choice, because classifying that bucket later is what turns this strict.
 */
export function decidesClaim(under: ValidationKey, claimId: string): boolean {
  if (under === LEGACY_VALIDATION) return true;
  const required = requiredProtocolFor(claimId);
  if (required === null) return true;
  return under === required;
}
