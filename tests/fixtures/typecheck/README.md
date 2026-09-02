# The typecheck, shown to fail

Positive control for `npm run check`. `tsc --noEmit` is blocking in CI and had no way to demonstrate
its own failure: a green typecheck and a typecheck that is not running look identical from outside.

`a-type-that-does-not-hold.ts` contains one error of the kind this project's types exist to catch --
a value assigned to a union that does not admit it -- and `npm run check:control` runs the same
compiler over this directory and requires a non-zero exit.

It is excluded from the repository's own `tsconfig.json`, so `npm run check` never sees it.
