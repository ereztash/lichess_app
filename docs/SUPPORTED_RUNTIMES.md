# Supported runtimes, and the accessibility target

The authority for two questions that had none: **which browsers and runtimes this build supports**,
and **what accessibility conformance the interface commits to**.

Both were already true in practice and neither had ever been written down. The tree carried the
*consequences* of a baseline for months — a tap-target floor, a `forced-colors` block, a
`prefers-reduced-motion` block, layout measured at fixed viewports — with nothing stating the
baseline they are consequences of, so a reviewer could not tell whether a new surface was compliant
or merely unmentioned.

**Nothing here is a new commitment.** Every line below names what already enforces it. Where a
statement has no enforcement, it says so.

---

## 1. Runtimes

| what | baseline | what enforces it |
| --- | --- | --- |
| **browser engine** | Chromium, the version Playwright pins | `tests/layout/browser.ts` launches it and **throws when it is absent** rather than skipping; `@playwright/test ^1.62.1` in `package.json` pins which one |
| **Node, in CI** | **22** | `.github/workflows/verify-build.yml` sets `node-version: 22` |
| **Node, on the deployed runtime** | **24.x** | the Vercel project's `nodeVersion`. **These two differ**, and the difference was found while writing this file rather than by a check. CI proves the build and the tests work on 22; the serverless entry runs on 24. Nothing here holds them together, and `Q36` (dependency upgrades) is the capability gap that would |
| **database** | MySQL 8 | the `mysql:8` service in `verify-build.yml`. The store was first exercised locally against MariaDB 10.11, and the two together are the evidence that it depends on neither |
| **module format** | ES modules, `tsc --noEmit` clean under the repo's `tsconfig.json` | `npm run check`, blocking in CI |

### What this does **not** establish

**That any other browser works.** No Firefox or WebKit run exists anywhere in this repository.
`tests/layout/*` measure boxes in one engine, and a box that is right in Chromium can be wrong
elsewhere — which is the whole reason those tests exist rather than jsdom. A second engine is not
claimed and would need its own run to be.

**That CI and the deployed runtime run the same Node.** They do not: 22 and 24.x. Every test result
in this repository is evidence about 22, and every request a player makes is served by 24.x. That is
a real gap between what is proved and what is served, it is recorded here rather than closed, and
closing it means pinning one to the other in a place a command reads.

**That any minimum version is enforced at runtime.** There is no `browserslist`, so nothing
transpiles or polyfills to a stated floor and nothing refuses an old browser. The floor is
*whatever the pinned Chromium accepts*, which is a real answer and a narrow one.

---

## 2. Accessibility target

**WCAG 2.2, Level AA.**

That target was being used before it was stated: `docs/FINDINGS.md:240` holds a control against
*"WCAG 2.2 AA (2.5.8)"*, and `docs/PRODUCTION_READINESS_LEDGER.md:842` records an assessment
reporting a *"Level AA"* failure. Two documents assessing against a standard that no document
adopted is exactly the shape `RNL-05` is about, so this file adopts it.

| criterion | what enforces it |
| --- | --- |
| **2.5.8 target size (minimum)**, 24×24 with the repository's own stricter 44 px floor | `tests/client/ux-contract.test.ts`, and the layout tests that measure real boxes in a real browser |
| **1.4.3 contrast (minimum)** | cited in `docs/MEASUREMENTS.md`; measured per surface rather than by a standing gate |
| **forced colours** | `@media (forced-colors: active)` in `client/src/index.css`, added after a Chromium run found all 64 board squares rendering identically under it |
| **reduced motion** | `@media (prefers-reduced-motion)` in `client/src/index.css` and `client/src/lib/motion.ts` |
| **reflow at 200 % zoom** | the layout suite measures at fixed viewports rather than by simulating zoom |

### What this does **not** establish

**That the product conforms to WCAG 2.2 AA.** It states the target and names what is enforced
against parts of it. No full audit has been run, several success criteria have no check at all, and
a target with partial enforcement is a target, not a conformance claim. The honest reading is:
*this is the bar; here is the part of it a command holds.*

**That the enforced parts cover the important ones.** The criteria with standing enforcement are
the ones a layout test can measure. Criteria about language, structure and meaning — `3.1.2`,
`1.3.1` — are assessed by reading, and `PRODUCTION_READINESS_LEDGER.md:842` records one such finding
that a machine did not catch.

---

## 3. Authority and lineage

This file is the current authority for `Q30` (*which browsers and runtimes are supported?*) and
`Q35` (*what accessibility conformance target must the UI meet?*) in `scripts/authority-scan.ts`,
which checks on every gate run that it still exists.

**It supersedes nothing**, because nothing answered these questions before. Both were found by the
completeness attack in `docs/consolidation-research/AUTHORITY_MAP_V2_ATTACK.md`: `Q30` in round one
and `Q35` in round two, which found four more questions after round one had finished — which is why
the question count there is published as a lower bound rather than as a measurement.

**Reversal condition.** A second browser engine in the layout suite, a `browserslist`, or a full
WCAG audit each make part of this file wrong in the good direction, and each should replace the row
it makes wrong rather than being added beside it.
