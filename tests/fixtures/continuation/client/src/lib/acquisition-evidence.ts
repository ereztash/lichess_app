/**
 * The positive control for GATE-CONTINUATION-IS-A-MOVE: the definition as it would decay.
 *
 * Two of the three decay modes at once, because a control that carries one defect proves the
 * scanner sees that one. `positionWasActionable` is accepted and then ignored, which is the shape
 * a clause takes when somebody "keeps the signature stable" while removing what it did.
 */
export function continuationStarted(input: {
  movePlaced: boolean;
  positionWasActionable: boolean;
  revealsPresented: number;
  alreadyRecorded: boolean;
}): boolean {
  return input.movePlaced && input.revealsPresented > 0 && !input.alreadyRecorded;
}
