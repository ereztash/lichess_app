/**
 * ONE CANONICAL INTENT, WORDED BY THE SURFACE THAT SHOWS IT.
 *
 * WHAT THIS CONTRACT IS FOR. `proposeNextAction` decides WHAT the next meaningful product act is.
 * It must not decide how that act is worded, where the control sits, or what it looks like: a
 * returning player on the front door and a player who has just finished a blitz game are being told
 * the same thing about their record and are in two different moments of it. The architecture owns
 * the intent; the surface owns the sentence.
 *
 * SO THIS IS A SHAPE, NOT A COMPONENT. There is deliberately no `<NextActionButton>`. A single
 * global CTA would centralise the one thing that should stay local -- presentation -- while doing
 * nothing about the thing that was actually duplicated, which is policy. `docs/ARCHITECTURE_UI_
 * CURRENT_STATE.md` §3 lists four surfaces that each had their own policy and their own wording;
 * this removes the first and keeps the second.
 *
 * THE INVARIANT A GATE CAN CHECK. A presenter may say anything it likes in `label` and `because`,
 * and may decline to present an action at all. What it may NOT do is name a different act from the
 * one the canonical policy derived -- `act` is copied from `actFor`, never chosen. That is
 * `GATE-SEMANTIC-PRESERVATION`, and it is the whole difference between "the surface presents the
 * decision" and "the surface makes a decision".
 */
import type { NextAction } from "./next-action.js";
import type { PrimaryAction } from "./primary-action.js";

/**
 * What a surface offers for one canonical action.
 *
 * `act` IS NOT THE PRESENTER'S TO PICK. It is `actFor(action.kind)`, carried so the rendered
 * control can stamp `data-primary-action` and so the existing act gates can count acts without
 * re-deriving anything. A presenter that computed it would be a second mapping from state to act.
 */
export interface SurfaceOffer {
  readonly act: PrimaryAction;
  readonly label: string;
  /** Why this, now, in the player's terms. Never "because the product recommends it". */
  readonly because: string;
}

/**
 * A surface's presentation of the canonical action, or `null` for "not mine to show".
 *
 * `null` IS A LEGITIMATE ANSWER AND IS NOT A FALLBACK. `wait-analysis` has no control on any
 * surface -- the honest rendering of "the engine is still going" is a sentence and no button, and
 * P1.5 fought for that. A presenter returning `null` says this surface renders that state some
 * other way; it does not say the surface disagrees about what the state is.
 *
 * WHAT `null` MAY NEVER MEAN is "so I will offer something else instead". A surface that returns
 * `null` and then draws its own primary control has reintroduced the policy this contract removed,
 * and `GATE-NO-LOCAL-PRODUCT-POLICY` is what notices.
 */
export type SurfacePresenter = (action: NextAction) => SurfaceOffer | null;
