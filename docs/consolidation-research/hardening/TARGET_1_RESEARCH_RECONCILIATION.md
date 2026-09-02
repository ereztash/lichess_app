# TARGET 1 — research reconciliation

**Before:** 0 research artefact relations mechanically checked. Two verified drifts (`X-02`, `X-16`)
sitting in the tree, both found by hand.
**After:** 44 hash sites classified, 4 predicates, `GATE-RESEARCH-RECONCILED` green on the tree and
red on a fixture carrying four drifts.

---

## 1. The inventory, which came before the scanner

Every JSON under `research/**` and `docs/**` was walked for external claims. The result is small
enough to classify honestly rather than parse generically:

```
30 artefacts carry a sha256
44 individual hash sites
21 distinct key-path shapes
```

Reverse-resolving every claimed hash against every tracked file decided the classification
mechanically rather than by reading names: **16 sites resolve to a file in this tree; 28 do not.**

| relation kind | sites | checkable here | what it is |
| --- | ---: | --- | --- |
| `HASH_OF_TREE_FILE` | **16** | **yes** | a register naming the sha256 of a file in this repository |
| `GENERATED_VALUE` | **1** | **yes** | a committed output recording an input its generator declares |
| `EXTERNAL_ARTEFACT` | **24** | **no, and it says so** | a Lichess dump prefix, the Stockfish binary, an evidence bundle that was never committed |
| `INTERNAL_DIGEST` | **4** | n/a | a cache key or a self-digest; claims nothing about any file |

`EXTERNAL_ARTEFACT` earns its own name rather than being skipped. Twenty-four of forty-four sites
cannot be verified from inside this repository, and a scanner that silently passed over them would
leave a reader unable to tell *checked and correct* from *not checkable* — which is the distinction
`NOT-MEASURED` exists for everywhere else here.

## 2. Four predicates

| predicate | catches | why it is not the others |
| --- | --- | --- |
| `findStaleFrozenHashes` | `X-02`'s class | a **CURRENT** hash record that no longer matches the file it names. Superseded blocks are read and deliberately not asserted: a superseded block that still matched would mean the amendment never happened |
| `findGeneratedValueDrift` | `X-16`'s class | a committed artefact recording an input its generator no longer declares. Compares two literals, so it is a gate; re-running `selftest.py` takes ten minutes and would not be |
| `findOrphanedSupersessions` | the escape hatch | **without it, `SUPERSEDED` is a whitelist.** Any drift could be retired by declaring the block historical. A superseded block must hand its subjects to a `CURRENT` block that is itself checked, and the artefact must name the successor in its own text |
| `findUnregisteredClaims` | the decay | a sha256 at a key the relation table does not classify. Without it, *"the research corpus is reconciled"* becomes *"the part of it somebody last looked at is reconciled"* the first time a new register lands |

## 3. `X-02` and `X-16` — same detection class, different cause, different repair

Study v2 was explicit that these two share a **detection** class and not a cause. The scanner is
shared. The repairs are not, and neither was chosen before the cause was established.

### `X-02` — resolved by **supersession**, and the successor already existed

The freeze record's live block said `DATA_PROTOCOL.md` was `cf263394…`; the file is `6560f3d7…`.

`git log` shows why: the document and the freeze record were **last written in the same commit**,
`da15833`. Gate 2 required an edit to `DATA_PROTOCOL.md` — the diff is labelled *"Fixed at Gate 2"*
and says *"it changes no verdict"*: a reporting rule that had a judgement call inside it was made
unconditional. The hash was taken in the working tree before the edit. This is the identical
mechanism the file's own `commit_note` already documents for the freeze commit ids.

Then the decisive fact, found by comparing all three records rather than assuming:

```
                    actual        freeze.amended   seal.document_sha256
DATA_PROTOCOL.md    6560f3d7…     cf263394…  X     6560f3d7…  ok
the other four      —             ok               ok
freeze amended_at   2026-09-02T00:46:57Z
seal   written_at   2026-09-02T02:08:13Z
```

**`FINAL_HOLDOUT_SEALED.json`, written 81 minutes later, already records the post-edit hash of all
five documents.** The repository already had a current and correct record; the freeze's amended
block was a snapshot that the Gate 2 edit outran, and nothing pointed at its successor.

The repair is therefore **additive and changes no value**: two keys appended to the freeze record
naming the successor and the mechanism. The diff is four lines, and not one hash, verdict or
timestamp is modified.

**This is not a whitelist**, and `findOrphanedSupersessions` is what makes that checkable: the
successor must exist, must be a `CURRENT` relation, must cover the same five documents, and must be
named in the artefact's own text. Delete the seal and the gate goes red.

### `X-16` — resolved by **regeneration**

`selftest.json` recorded plant `one-game-only` at `delta 0.45`; `worlds.py`, last written in the
same commit `34f5742`, declares `0.22`. A generated artefact is downstream of its generator, so the
tree is the authority (`RNL-01`) and the output is regenerated rather than argued with.

`python3 research/discovery-oracle/selftest.py`, run in the tree, changed exactly:

```
one-game-only   delta   0.45 -> 0.22        (now equals the generator's declaration)
one-game-only   passes  false -> true
passed                  false -> true
plants_off_target       [one-game-only] -> []
null_leaks              0 -> 0     unchanged
seed                    20260830 -> 20260830   unchanged
```

**`passed: false → true` is a real change to a committed artefact and is stated plainly rather than
buried.** The `false` was not a preserved failure: it was produced by a nominal effect size the
generator had not declared since the same commit that recorded it. The evidence that the drift
existed is preserved in `git`, in `CONTRADICTIONS.md` `X-16`, and in the control fixture, which
carries `delta 0.45` forever.

## 4. The control

`tests/fixtures/research/` is a repository in miniature carrying four drifts, and the scanner run
over it is the same scanner run over the root.

```
npm run gates            GATE-RESEARCH-RECONCILED  PASS   29 gates: 29 pass, 0 fail, 0 not-measured
npm run gates:controls   GATE-RESEARCH-RECONCILED  FAIL   29 gates: 0 pass, 29 fail
```

The fixture's four findings, each deliberate: a live hash record that drifted (`X-02`'s shape), a
generated value disagreeing with its generator (`X-16`), an orphaned supersession, and an
unclassified hash claim.

## 5. Wiring

`GATE-RESEARCH-RECONCILED` is registered in `scripts/run_gates.ts`, so it runs under `npm run gates`,
which `npm run verify` and the CI `Gates` step already run. **It is blocking, and no new step was
added to do it.**

## 6. What the repository's own machinery said about this change

The first push of the gate failed `tests/docs/the-table-that-fell-behind.test.ts` with *"gates that
run but have no row in the README: GATE-RESEARCH-RECONCILED"*, and again on the count spelled out in
Hebrew prose. A gate added without its row is the exact drift that test exists for, and it caught
this one within a minute of the gate existing. The row and the numeral are in.

## 7. What this does not establish

- That the research corpus is now correct. It establishes that **44 hash sites are classified and
  17 of them are checked on every run**, and that a new one cannot land unclassified.
- That `EXTERNAL_ARTEFACT` claims are true. They are unverifiable from inside this repository and
  are labelled, not checked.
- That prose in the research registers agrees with anything. Prose is deliberately unscanned, for
  `register-scan.ts`'s stated reason.
- That `X-02`'s cause cannot recur. A record and its subject written in one commit can still drift;
  what changed is that the next one is caught by a command rather than by a reader.
