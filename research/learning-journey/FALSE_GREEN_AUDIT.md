# False-green audit

An attempt to falsify what the green Verify verdict on `7ee419f` / `27488cc` means. Not a UX pass
and not a test-count exercise: the question is which material claims could be false while Verify
still passed, and the answer is written by mutation wherever mutation was possible.

**Eleven false greens were found.** Nine are repaired with a mechanism, two are repaired by
narrowing what the verdict claims. Three of the nine were found by running a probe that a reasonable
person would have written, and that passed every gate in the tree.

---

## 1. Repaired false green

### FG-1 · The loop's central new claim was true of a module and false of the product

**The claim.** "A graded claim is no longer the end of the loop: the pointer names the rule work
that is waiting." It is the headline of the commit and a section of PR #102.

**What was actually shipped.** `loopPosition`'s `rules` branch had nine passing tests.
`useLoopPosition`, the only thing that builds its input, never passed `rules`. `ruleLoad` was
exported and called by nothing. A player who graded a claim, wrote a rule and had a retrieval test
come due still read *"more decisions may produce the next claim"*.

This is the class the Verify workflow names in its own comments — Layer C passing its unit tests for
months while no router imported it — reproduced inside the change that cites it.

**Repair.** Three parts, because one would not have been enough.
1. `ruleLoad` moved to `client/src/lib/rule-load.ts` and wired into `useLoopPosition`. It could not
   be wired where it was: importing it from `journey-readings.ts` dragged `@shared/learning-journey`
   and the learning-record zod schemas back into the entry chunk, 4.1 kB, which the bundle budget
   refused. The new module takes a structural type of the two fields a due-count reads and imports
   nothing. Initial-download ceiling 769 → 770, attributed in `check_bundle_budget.ts`.
2. `GATE-JOURNEY-REACHABLE` refuses any member of the journey family with no product caller.
3. `a-due-count-the-pointer-can-read.test.ts` — six tests over a function that had none.

**Demonstrated.** Unwiring `ruleLoad` reproduces the shipped state and the gate goes red naming it.

### FG-2 · Deleting the whole ledger from the page kept everything green

**Mutation.** Remove `<JourneyLedger claim={claimView.data} />` from `Record.tsx`.
**Result before repair.** 2,613 tests passed, 38 gates passed.

`record-page.test.tsx` did assert the layer existed — but it asserted `.journey-layer`, the *section
wrapper*, which the mutation left in place. A wrong proxy: it measured the container and not the
content.

**Repair.** `GATE-JOURNEY-REACHABLE` covers the components too. **Demonstrated:** the same mutation
now goes red naming `JourneyLedger`.

### FG-3 · `ruleReadings` could return nothing forever

**Mutation.** `ruleReadings` returns `[]` unconditionally.
**Result before repair.** Everything green. The pure `ruleJourney` is well tested; the adapter that
feeds it from the record was tested by nothing.

**Repair, and its limit.** Reachability is now gated. **That is not the same as correctness**, and
the matrix marks this `PARTIALLY_COVERED` rather than closed: no test asserts that a stored learning
rule produces the stage a player would see. Named as open below.

### FG-4 · The goal gate was a token scan, and a probe walked past it

**Probe.** A component taking the sentence as a prop called `statement`, printing a hardcoded Hebrew
lead, with a count in the same element — the exact defect `GATE-GOAL-NOT-A-DENOMINATOR` exists for.
It contains none of the tokens the scan keys on (`GOAL_LEAD`, `PlayerGoal`, `goal.statement`).
**Result.** Passed every gate.

**Repair.** `GATE-GOAL-CONTAINED`: `readGoal` may be called only from `player-goal.ts` and
`GoalNote.tsx`. A second renderer cannot obtain the text. The adjacency scan stays as the
within-file check. **Demonstrated:** the probe, rewritten to actually obtain the goal, goes red.

**Residual hole, stated:** a caller inside `GoalNote` passing the sentence to a child in another
file. Narrower than what is closed, and not closed.

### FG-5 · The construct gate was a literal, and the same probe walked past it

**Probe.** `const { n } = reading.count`. `GATE-CONSTRUCT-NAMED` keys on the literal `count.n`.
**Result.** Passed every gate.

**Repair.** `GATE-CONSTRUCT-CONTAINED`: a journey stage's count is read only by the ledger.
**Demonstrated:** red on the probe, with `CountReadElsewhere.tsx` — the probe itself — as its
control.

### FG-6 · Both new gates shared their controls' wrong assumption

The named class *"could both gate and control share the same wrong assumption?"* — and they did. The
control fixtures were written in the same vocabulary as the scans, so a control going red proved the
scan matched **its own token**, not that it measured the property.

**Repair.** The controls are now the probes that escaped. `GATE-JOURNEY-REACHABLE`'s control goes
further: its fixture reaches five of six members and withholds exactly the one that shipped
unreached, and the gate raises a **harness error** rather than passing if the scan reports all six or
none. **Demonstrated:** disabling the reachability predicate produces
`HARNESS ERROR: … should leave exactly ruleLoad unreached, got [all seven]`.

### FG-7 · A calibration run reaches COMPLETE with nothing delivered, and the trace cannot tell

The adjacent transport assumption to the defect repaired in `27488cc`. That one was *paths instead
of documents*. This one is: **nothing records whether the documents arrived.**

**Probe.** Every `context_ref` unresolvable. The manifest correctly says `NOT DELIVERED` three
times, the peer is honest about it — and the run still reaches `COMPLETE`, with no record in the
trace. An auditor reading `RND_TRACE.json` cannot tell a peer that read five documents from one that
read none.

**Repair.** `LAST_DELIVERY` is recorded into the provenance sidecar as `context_delivery`
(requested, delivered, manifest). **Demonstrated:** falsifying the recorded count goes red in
`check_live_adapters.py`.

### FG-8 · "`npm run verify` is green" was quoted as if it were CI's verdict

It is not. `npm run verify` omitted `check:control` and `bundle:budget:control` — both of which CI
runs — and without `DATABASE_URL` **28 database tests SKIP**. "3,262 tests pass" silently contained
none of them. That is the workflow's own documented class: *"five database tests skipped silently on
every run for months."*

**Repair.** `verify` now runs both controls, inverted, and ends with `verify:scope`, which prints
what the verdict does and does not cover. **Demonstrated:** making the typecheck control fixture
compile turns the inverted step red.

### FG-9 · A declared research branch vanished without being recorded

`DR_PLAN_0` committed E5 to RU/JP/US/FR. `EXTERNAL_EVIDENCE.md` delivered RU and US. Japan and
France were not marked Δ0, not stopped, not blocked — they were simply absent, and nothing anywhere
would have noticed.

**Repair, and it is not a gate.** The frozen plan is untouched. Both branches were then run, bounded
to the only reading that could still change a decision: does either implement a materially different
learning *loop*, as opposed to a different surface? Both returned no, both are recorded with their
sources and their thinness, and the amendment states plainly that plan and execution disagreed until
now. See §5.

### FG-10 · The FIELD protocol's decision rule read a variable it never collected

Q7 asks what a participant **expects** will happen next time. The rule read "**no intention to
return**". Expectation and intention are different variables, and intention was collected nowhere,
so **M2 was not identifiable from anything the protocol gathered**.

**Repair.** A behavioural observation replaces the self-report: after the questions the facilitator
stands down and **C1** records whether the participant begins another decision, unprompted, within
two minutes. The rule reads C1. Q7 is kept and demoted to a legibility item, and a table now lists
every variable the rule reads and where it comes from — which is what made the mismatch visible.

### FG-11 · Two artifacts disagreed about whether the product may prescribe

`DECISION.md` accepts candidate 3p, procedural prescription, as the product's voice.
`FIELD_TEST_PROTOCOL.md` described M3 as *"the user wants a product that prescribes, which the
evidence forbids"*, and told a facilitator to score M3 *"if they describe a coach"*.

A participant describing a product that says what it will do next and what that will then show would
have been scored as wanting something forbidden — when they had read the shipped design correctly.
The field test would have mis-scored its own architecture.

**Repair, preserving the distinction rather than flattening it.** M3 is now specifically the
**efficacy** register, and "a coach" is explicitly not M3 by itself.

---

## 2. Documented boundary — correct as it is, and now said out loud

**`resource` is not `authority` (PPSA).** The kernel's five-value list is headed "Resolution
authority" and the R&D schema carries it on a field named `resolution_authority`. The calibration
schema's fields are `available_resources` / `allowed_resources` and mix invocable peers with
authorities. They are different vocabularies, and `RESEARCH` is absent from the resource enum
because research is work the loop **does**, through `external_research_needed` → `RND_RESEARCH`,
rather than a body it defers to. `CAL-LICHESS-LEARNING-JOURNEY-001` recorded a "schema gap" that is
not one. **The schema is unchanged**; `docs/RESOURCE_IS_NOT_AUTHORITY.md` states the distinction and
its falsifier. The task and trace are not edited — they are the record of what was believed.

One thing is genuinely open and is not patched: a run cannot **stop at** RESEARCH the way it stops at
OWNER or FIELD. Whether that matters needs an instance, and none exists.

**What Verify cannot mean, at all.** No arrangement of gates makes a green verdict evidence that a
cold user understands the journey, that the architecture is the right one, that the mechanism
research is sound, or that anything here improves play. Those are FIELD, OWNER and RESEARCH, and
they are listed in the matrix as `CORRECTLY_OUTSIDE_VERIFY` so that "Verify is green" cannot be used
to carry them.

---

## 3. Handoff

**RESEARCH.** Whether the Japan and France evidence is thin enough to matter is a judgement this
audit made and recorded (`SOURCE_LEDGER.md` S9, S10): both rest on vendor pages and community
artefacts. The conclusion they support is a *refusal to build*, which is robust to weak evidence in
a way a decision to build would not be.

**OWNER/FIELD.** The repaired protocol is unrun. C1 is a new observation and its two-minute window is
a judgement, not a validated threshold.

**REPO, open and named.** No test asserts that a stored learning rule renders as the stage a player
would see (FG-3's limit). The reachability gate proves a caller exists and nothing more. A component
test over a populated record would close it; it is not written, and the matrix says so rather than
letting the gate imply it.

---

## 4. What this audit did not do

It did not re-audit the gates that predate this work. The eleven findings are all inside the
learning-journey change and its runtime, plus the two boundary findings about what Verify means.
Whether the other thirty-odd gates measure what they claim is the same question asked of older code,
and it is not answered here.

---

## 5. Japan and France: why they are Δ0 rather than ceremonial research

The E5 conclusion is a **refusal**: no coaching-style selector, because the loop is invariant and
only the surface varies, and no product rule may be derived from country. For the missing branches to
change a decision they would have to show a materially different *loop*, not a third and fourth
*surface*.

- **Japan** (Shogi Wars / Kishin Learning): videos and learning content with a review quiz, to which
  a review game was added. Identify → practise → review. Same loop.
- **France** (Lichess studies, the "Dojo"): community-authored studies, theory in books and video,
  pedagogy supplied by the community rather than the platform. Same loop; the surface is that there
  is no imposed surface.

Neither challenges loop invariance. Neither moves the coaching-surface conclusion, the architecture,
or the FIELD protocol. Recorded as Δ0 with sources and stated thinness, and not pursued further.
