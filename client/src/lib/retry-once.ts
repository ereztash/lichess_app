/**
 * Run something, and on failure run the SAME thing once more.
 *
 * ITS OWN MODULE SO IT CAN BE TESTED, which the inline version could not be: it lived inside
 * `runReveal`, a callback that needs a mounted board, an engine worker and a store.
 *
 * WHY A RETRY EXISTS AT ALL. `reveal` writes the engine's verdict and then the alternative's
 * price, and the two are not atomic. Losing the second left the record holding a chosen-move
 * score and no alternative score -- which `readCounterfactuals` drops silently, so a row of the
 * probe's treatment arm left the denominator with no trace and nothing ever went back for it.
 *
 * ONCE, NOT UNTIL IT WORKS. A loop against a server that is refusing turns one failed decision
 * into a stuck screen, and the failure panel already offers the way out. One retry covers the
 * case this is for -- a dropped connection on an otherwise working deployment -- and stops.
 *
 * THE ARGUMENT IS A THUNK OVER A VALUE THE CALLER ALREADY BUILT, deliberately. The price has to
 * come out of the same search that scored the chosen move, so a retry that recomputed its payload
 * would be storing two numbers from two trees under one decision. The second attempt must send
 * the first attempt's bytes.
 *
 * The second error is the one that propagates: it is the one that describes the state the caller
 * is actually in.
 */
export async function retryOnce<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch {
    return await run();
  }
}
