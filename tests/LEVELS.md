# The ladder: how much reality a test runs against

246 test files, and one wave shipped five defects that every one of them was green through.

**Not one of the five was a wrong test.** Each was a test that looked at a faithful shadow of the
thing and was read as evidence about the thing. That is one shape, five times, and it is what this
file is for.

## The five, and the rung that would have caught each

| # | what shipped | why the tests were green | rung that sees it |
| --: | --- | --- | --- |
| 1 | Every blitz think time was a fraction of a millisecond, the schema wants an integer, so **no blitz game had ever been stored in a browser** | shared suites used hand-built integer fixtures; every jsdom suite mocks `performance.now()` to whole milliseconds; the browser audit asserted a *card* the screen drew from its own in-memory copy | **L5** — a real browser, reading the record back |
| 2 | The self-check reported *"a Worker can be created"* on a browser that had just refused one | a CSP-refused worker **does not throw** — it errors asynchronously with an empty message, so `try`/`catch` sees success | **L6** — the deployed policy, applied by a real browser |
| 3 | `saveClaim` wrote two of the three fields the fold changes, so on MySQL **no claim ever recorded which protocol graded it** | every test but the database ones runs against `MemoryRecordStore`, which replaces the whole row | **L4** — the real store |
| 4 | Two gates were red on the runner and green everywhere else | vitest colours its summary when `CI` is set; the matcher was written against a pipe's plain text | **L5+** — the environment that decides |
| 5 | The commit button said *"חסר: בחרו מהלך על הלוח"* while wearing a **✓** | every assertion about that button read `textContent`, which is blind to an icon | **L3**, asked the right question |

The fifth is the instructive one: it needed no higher rung at all. It needed the **existing** rung to
look at the whole screen instead of half of it. A ladder is not a promise that higher is always
better — it is a way to ask *which* rung a claim needs.

## The rungs

| L | runs against | proves | blind to |
| --- | --- | --- | --- |
| **L1** pure | one function, inputs built by hand | the algebra | whether those inputs ever occur |
| **L2** contract | several shared modules and their schemas, together | that the pieces agree about shapes and rules | what a runtime actually produces |
| **L3** render | components in jsdom | the DOM exists and its text says the right thing | layout, geometry, icons as meaning, anything a browser refuses |
| **L4** store | the real store, against MySQL | what SQL actually writes and reads back | the client, and anything above the boundary |
| **L5** browser | Chromium over the built assets | layout, policy, workers, geometry, the bundle as shipped | whatever the edge does to a response |
| **L6** deployment | the deployed origin | headers, MIME types and CSP as actually served | nothing this repository can name |

**Parent and child.** A rung's parent is the rung below it. A child can fail where its parent passes
— that is the whole content of the relation, and every defect above lived in a gap where the child
did not exist. The converse is not true and matters just as much: a parent passing tells you nothing
about the child, so *"the unit tests are green"* is not an answer to *"does it work"*.

## The level is derived, not declared

`scripts/test-level-scan.ts` reads what a file imports and what environment it asks for. Those are
facts. A declaration is a comment: it can be wrong the day it is written and stays wrong.

A file may override with `@level Ln because <reason>`. **The reason is required** — an override
without one is a number pretending to be an argument, and the scan refuses it.

> The derivation missed all eleven browser tests on its first run, because
> `tests/layout/browser.ts` owns the launch and no test file names playwright directly. A derivation
> that cannot see the repository's own idiom reports a comfortable number instead of a true one,
> which is the failure this whole file is about. It is written down rather than quietly fixed.

## Where the tests actually are

```
L1 pure          80   32.5%
L2 contract      85   34.6%
L3 render        70   28.5%
L4 store          5    2.0%
L5 browser       10    4.1%
L6 deployment     0    0.0%
```

**15 of 246 — 6.1% — run against anything the product actually meets.** The other 94% run against
hand-built inputs in a simulated environment. That is not an indictment: L1 and L2 are where a rule
is stated precisely and cheaply, and a repository with no L1 tests is worse off. It is a statement
about what the suite can and cannot be read as evidence for.

**L6 is zero.** The deployment run that found defect 2 was a throwaway script, and R-09's own row
says the scan now works there — on evidence that is not in this suite and does not re-run.

## Which rung each claim stands on

The report `npm run levels` prints this. A severity implies a floor: **P0** rows say *a record can
be lost or made wrong*, which is a claim about a real runtime, so their proof has to have met one;
**P1** rows say *the record cannot be trusted to mean what it says*, which is a contract and is
provable at L2. P2 carries no floor.

```
R-02 P0  L3   <- P0 implies L4     R-20 P1  L1   <- P1 implies L2
R-19 P0  L2   <- P0 implies L4     R-09 P1  L1   <- P1 implies L2
R-03 P0  L3   <- P0 implies L4     R-01 P1  --   <- P1 implies L2
R-04 P0  L2   <- P0 implies L4
```

**All four P0 rows** — every row about losing or corrupting a record — are proven at L2 or L3. Not
one has ever been checked against a real store or a real browser. And R-19 exists *because* R-02's
L3 proof could not see that nothing was being stored at all: the row above it in this table is the
reason the row below it had to be written.

R-20 and R-09 are the same story from today. R-20 is a **MySQL-only** defect closed by a test that
reads the `SET` clause from source — the right test for the rule, and not a test of the store.
R-09's row is about a **deployment** and its gate is a unit test.

## The gate, and why it is a ratchet

`GATE-CLAIM-ANCHOR` holds the count of under-anchored rows and **only lets it go down**. Seven today.

A gate that failed on all seven would be red on the day it was written, and the only way to green
would be seven pieces of work nobody had planned — which is how a check gets deleted. A ratchet is
the same shape `the-file-that-only-ever-grew` uses on `Home.tsx`, and it makes the same promise:
**the number is visible, and it cannot grow.** A new P0 row proven only in jsdom fails it.

## What this does not claim

That a higher rung is better. Defect 5 needed L3 to ask a better question, not L5. That a level can
be read off a file with certainty — the derivation is a heuristic and its misses are worth writing
down, as one is above. And that closing all seven gaps is the goal: some are correct as they stand,
and each one closed should be closed because someone decided it, not to make a number go to zero.
