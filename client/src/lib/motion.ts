/**
 * Reduced motion, for the scrolls the stylesheet cannot reach.
 *
 * `@media (prefers-reduced-motion: reduce) { scroll-behavior: auto }` looks like it covers this
 * and does not: the CSSOM spec gives the `behavior` option of `scrollIntoView` precedence over
 * the `scroll-behavior` property, so a hard-coded `behavior: "smooth"` in a call stays smooth no
 * matter what the user asked the operating system for. The setting has to be read here.
 *
 * Defaults to "the user did not ask for reduced motion" when `matchMedia` is missing, which is
 * the jsdom case: tests then exercise the same branch a normal browser takes.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** `scrollIntoView`, honouring the setting. Same arguments, minus the choice of `behavior`. */
export function scrollIntoViewRespectingMotion(
  element: Element,
  options: Omit<ScrollIntoViewOptions, "behavior"> = {},
): void {
  // Optional call: jsdom does not implement scrollIntoView, and the commit-blocked tests drive
  // this exact path. Guarding here rather than at each call site keeps the callers to one line.
  element.scrollIntoView?.({
    ...options,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}
