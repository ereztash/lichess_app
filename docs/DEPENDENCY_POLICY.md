# Dependency policy

Authority for "how is a dependency upgraded, and what proves an upgrade safe?"
(`scripts/authority-scan.ts`, Q36). Mechanised by `.github/dependabot.yml`, `npm audit` in
`verify-build.yml`, `overrides` in `package.json`, and
`tests/docs/a-dependency-exception-that-expires.test.ts`.

## 1. What is shipped and what is not

`npm audit --omit=dev --audit-level=high` blocks `verify`. It asks about the tree the build ships,
not the workbench: a vulnerability in vitest reaches nobody, one in express reaches every request.
It can go red on a day nothing here changed. That is the check working.

## 2. How an upgrade arrives

Dependabot opens the PR, weekly, grouped: workbench patch/minor together, shipped patch/minor
together, every major alone. Nothing merges on its own.

What proves an upgrade safe is the `verify` job on that PR, and only that: lock installed exactly
(`npm ci`), audit of the shipped tree, typecheck and its control, schema loaded from the generated
migrations, build, the suite with a real database and a real browser, every gate and every gate's
red control, the bundle budget and its control. A green `verify` is the safety claim; there is no
other.

A major of a shipped dependency is additionally read: its changelog for behaviour this repository
depends on, named in the PR before merge.

## 3. When the fix is outside the range

When an advisory names a version the declaring package's range cannot reach (`qs` needed 6.16.0;
`express` pinned `~6.15.1`), the fix is an `overrides` entry in `package.json`, and it is written
with the advisory it answers. An override is removed when the declaring package's range reaches the
fix. An override with no advisory behind it is a fork and is not allowed.

## 4. Exceptions

An advisory that cannot be fixed (no release, or a release that breaks something this repository
needs) is recorded in `docs/dependency-exceptions.json` with the advisory id, the package, the
reason, and an **expiry date**. The test fails the day one expires. There is no exception without
an expiry, and none is renewed by editing the date without re-reading the advisory. The file is
empty at the time of writing, and the test holds it to its shape.

## 5. Actions

Every GitHub Action is pinned to a commit SHA with the version in a trailing comment. A tag can be
moved; a SHA cannot. Dependabot proposes the bump and updates both.

## 6. Conveyed components

`stockfish` is excluded from automatic proposals. Its version is bound to a licence notice the
product serves (`GATE-NOTICE`), so a bump is a licence review first. It is taken by hand.

## 7. Node

`engines.node` in `package.json` is the one statement of the runtime. Vercel builds and runs on
it; both workflows read it through `node-version-file`. A change to the major is a PR of its own.
