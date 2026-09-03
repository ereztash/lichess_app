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
L1 pure          83   30.2%
L2 contract      85   30.9%
L3 render        80   29.1%
L4 store          8    2.9%
L5 browser       18    6.5%
L6 deployment     1    0.4%
```

**27 of 275 — 9.8% — run against anything the product actually meets.** The other 90% run against
hand-built inputs in a simulated environment. That is not an indictment: L1 and L2 are where a rule
is stated precisely and cheaply, and a repository with no L1 tests is worse off. It is a statement
about what the suite can and cannot be read as evidence for.

**L6 was zero when this was written.** The deployment run that found defect 2 was a throwaway
script. It is no longer zero: `tests/deployment/` runs against the production alias on every
`deployment_status`, daily, and on dispatch, bound to the commit it expects (`docs/ROLLBACK.md`).
The table above is the count at the time of writing; `npm run levels` is the current one.

## Which rung each claim stands on

The report `npm run levels` prints this. A severity implies a floor: **P0** rows say *a record can
be lost or made wrong*, which is a claim about a real runtime, so their proof has to have met one;
**P1** rows say *the record cannot be trusted to mean what it says*, which is a contract and is
provable at L2. P2 carries no floor.

It started at **seven**. It is **zero**, and the difference between the two halves of that is worth
keeping.

**Two were this scanner's fault.** R-01's gate is `GATE-REGISTER-RECONCILED`; R-09's is
`GATE-ENGINE-FAILURE-DISTINCT`. Both run on every build. The resolver could only read `*.test.ts`
filenames, so it scored two working checks as no evidence at all — a measurement that cannot see a
working check reports a gap that is not there, which is this file's own subject pointed at itself.
Those two were fixed by teaching the resolver to follow a `GATE-*` id through `run_gates.ts`.

**Five were real, and closing them was the work.**

| row | was | is | what closed it |
| --- | --- | --- | --- |
| R-02 | L3 | **L5** | a game played in Chromium, the tab closed mid-analysis, a new page opened on the same profile, think times compared across the reload |
| R-19 | L2 | **L5** | every stored `thinkMs` read out of `localStorage` after a game played by a **real clock** |
| R-03 | L3 | **L5** | `analysis.build` read back after the **real engine** scored a real game |
| R-04 | L2 | **L5** | all four opponent fields read out of the row a real game wrote |
| R-20 | L1 | **L4** | the fold run against a **real MySQL-compatible database**, `graded_under` read back |

The four P0 rows share one new file, `what-the-record-holds-after-a-game.layout.test.ts`, and it
reads the record rather than the screen — the distinction that hid defect 1, where the page rendered
from the copy the component was holding and said *"המשחק עצמו נשמר"* while the store had refused
every game.

**Each fails for its own reason, which is what makes them four tests rather than one copied four
times.** Nulling the opponent turns only R-04 red; blanking the engine build turns only R-03 red;
restoring the unrounded clock turns all four red, correctly, because then nothing is stored at all.

R-20's L4 case is the more instructive one. The block beside it already round-tripped a claim
through MySQL and compared it with memory — and it graded the claim **by hand**, so `graded_under`
never changed, both stores returned null, and `toEqual` was satisfied by two stores agreeing about a
value neither had been asked to write. The new case grades through `evaluateClaim`, which is what the
product runs. Removing `gradedUnder` from the `SET` clause turns it red with *expected 'legacy' to be
'position-drill'*.

## The gate

`GATE-CLAIM-ANCHOR` held the count and only ever let it go down. **At zero it is a bar**, which is
the point of having reached it: the next P0 row proven only in jsdom fails immediately, with nothing
to argue about.

It began as a ratchet because a gate red on the day it is written — with seven pieces of unplanned
work between it and green — gets deleted rather than met. Same shape `the-file-that-only-ever-grew`
uses on `Home.tsx`, and it ended somewhere that one cannot.

## What this does not claim

That a higher rung is better. Defect 5 needed L3 to ask a better question, not L5. That a level can
be read off a file with certainty — the derivation is a heuristic and its misses are worth writing
down, as two are above. And that zero means finished: it means no row currently claims more than its
proof ran against, on a floor this file chose (**P0 → L4**, **P1 → L2**) and could have chosen
differently. **L6 re-runs now** (headers, MIME types, CSP, health and build identity as served);
R-09's strongest evidence — the engine running on the actual deployment — is still not among them,
because a deployed engine check would need a browser against production and that is not built.
