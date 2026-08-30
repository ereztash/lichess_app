/**
 * Types for the one function this suite borrows from `dom-accessibility-api`.
 *
 * WHY THIS FILE EXISTS. The package ships `dist/index.d.ts` but its `package.json` "exports" map
 * does not point at it, so under `moduleResolution: "bundler"` TypeScript finds the runtime entry
 * and no types. The declaration below is the package's own signature for the function, narrowed
 * to what is used here.
 *
 * WHY NOT `@ts-expect-error`. That would suppress whatever the import produces, including a
 * genuine change to the function's shape. This says what is expected, so a change breaks it.
 *
 * This is the accessible-name algorithm as Testing Library implements it -- the same code behind
 * `getByRole({ name })`. `tests/client/a-board-nobody-could-hear.test.tsx` uses it to MEASURE the
 * claim the board's labelling rests on, rather than reasoning about the spec.
 */
declare module "dom-accessibility-api" {
  export function computeAccessibleName(element: Element): string;
}
