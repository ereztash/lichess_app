# Adversarial pass

**Its job, in the mission's own words:** *to prove that the project built an elaborate feedback
system without evidence that it changes natural decisions.*

**It could not prove that, for one reason: no feedback system was built.** One gate, some research
scripts, a frozen dataset and eleven documents. So the attack turned inward, on the measurements,
and **two of the fifteen landed on this cycle's own claims**. Both corrections are applied to the
files they falsify rather than noted here and left.

---

## The two that landed

### A-2 — `RC-05`'s permitted set is a set of one, and the audit said "set"

> *Attack 2: is `Y` genuinely a valid action set?*

**`|B| = 1` on all 435 of `RC-05`'s trigger-positive items.** The trigger requires every queen
promotion to go to a single square and `satisfies` is `move.promotion == QUEEN`, so there is exactly
one permitted move, always.

`ACTION_SET_AUDIT.md` §3 said `RC-05` was *"the only class in the corpus whose seventy-fifth and
ninetieth percentile permitted move costs nothing at all"*. True, and misleading: with one member,
the per-action distribution **is** the per-item `regret_B` distribution. Its perfect robustness is a
restatement, not an independent property.

Distribution of `|B|` on trigger-positive items:

| class | median `\|B\|` | share `\|B\| = 1` |
| --- | --- | --- |
| RC-05 | **1** | **1.000** |
| RC-03 | 1 | .556 |
| RC-00 | 3 | .140 |
| RC-06 | **9** | .036 |

**Where the column is not trivial, it is the most informative thing in Gate A.** `RC-06` prescribes a
median of nine moves and a tenth of them lose the game; that is a real distribution over a real set,
and it is what `b_valid` structurally cannot see.

**Correction applied** to `ACTION_SET_AUDIT.md` §3. **It strengthens the barrier decision**: a
singleton action set is `WHEN X → DO Y` in its sharpest possible form — one cue, one move — and it
still is not worth teaching.

### A-8 — the twin bank is not the class

> *Attack 8: are future opportunities cherry-picked?*

`EXCHANGEABILITY_AUDIT.md` recorded that 49% of items admit no twin and then wrote that the twin-able
half *"may differ from the other in ways nothing here measures"* — a sentence that names a check and
declines to run it. Run:

| covariate | twin-able (307) | not (128) | SMD |
| --- | --- | --- | --- |
| piece count | 11.84 | 7.75 | **+1.263** |
| material balance | +0.96 | +7.03 | **−1.112** |
| `V*` | 0.813 | 0.977 | −0.606 |
| unaided human rule-consistent rate | **.485** | **.727** | −0.508 |
| Elo | 1625.8 | 1626.1 | −0.001 |

The selection is structural: a minimal twin needs a **relocatable enemy piece**, so the bank is drawn
from busier, more balanced, less-won positions — and from positions where real players followed the
rule less often. `GO_NO_GO.md` treated max |SMD| **0.573** as disqualifying for the natural sets;
this reaches **1.263**.

**It does not touch the within-pair contrast**, which is its own control and which the sham answers.
It bounds what `B-PASS` is about: the bank, not the class. **Correction applied** to
`EXCHANGEABILITY_AUDIT.md` §7.

---

## The other thirteen

| # | attack | answer |
| --- | --- | --- |
| 1 | is `X` actually recognisable without being told? | **Not established, and the gate does not claim it.** `GATE-CUE-PLAYER-OBSERVABLE` proves the cue is *computable from the board*, which is necessary and not sufficient. Whether a player notices it mid-game is `E2`, needs people, and `KNOWLEDGE_MAP.md` §D says the repository's own `mechanism_class` vocabulary fails it by construction |
| 3 | is `T−` sufficiently defined? | **Yes, for `RC-05`.** `C11` MEASURABLE; prescription size .053 on `T+` against .051 on `T−`; the response predicate never consults the trigger. This is the precondition `RC-06` fails, where the two cells score different acts and 92% of `T−` items satisfy the stated rule under every legal move |
| 4 | does `WHY YOU` sneak causal language into correlational evidence? | **No `WHY YOU` exists.** The spec requires a numerator, a denominator and `causal_language: false` as a field, and `GATE-DENOM` already forbids the alternative |
| 5 | is the natural retest truly uncued? | **Not built.** Eight of its ten arrows exist; the matcher does not, and `NATURAL_RETEST_SPEC.md` §6 says why building it for `RC-05` would be pointless |
| 6 | does the packet contaminate later measurement? | **No packet.** The mechanism that would prevent it — a `packetVisible` row on `ModeContract`, false wherever `producingEvidence` is true — is named and deliberately not added, because it would be a permission for an object that does not exist |
| 7 | does the intervention merely increase `Y` everywhere? | **Untested.** `F-E5-a`, `NOT EXECUTABLE`. The trigger-negative term is mandatory in the retest type rather than optional, so it cannot be omitted later by forgetting |
| 9 | are failures retained? | **Yes.** Eight VACANT and two SATURATED classes kept with their reasons; the failure ontology counts recurring mechanisms; and this cycle's own two defects — the lossy provenance join and the transposition duplicates — are in `COMPUTE_VALUE_EXTRACTION.md` §1 rather than quietly fixed |
| 10 | can a packet retire? | **Specified, not implemented.** `withdrawn_because` is a pointer to the authority that said so, never a copy of its state, and `evidence-decayed` is reachable. `GATE-PACKET-REVERSIBLE` is deliberately not built: a gate over an object that does not exist passes forever and teaches the next reader that the question is settled |
| 11 | does immediate drill performance masquerade as learning? | **No drill ran.** `THEORY_EVIDENCE.md` V4 is called the methodological spine of the programme and this cycle did not test it |
| 12 | does the graph convert uncertainty into a permanent player label? | **No graph.** The requirement — a finding that no longer separates must visibly decay — is `evidence-decayed` in the spec |
| 13 | does the UI reveal information the evidence has not earned? | **No UI.** But the existing mechanism is weaker than it looks: `mayPrescribe` has **one consumer** in the whole tree and it renders a restraint *sentence*. It gates nothing. Recorded in `AUTHORITY_MAP.md` §2 |
| 14 | did implementation complexity outrun evidence value? | **The strongest surviving attack.** ~1,400 lines of research Python, 4.3 MB of data and one gate, for a verdict of *not worth teaching*. Answered below |
| 15 | would removing the packet change the primary endpoint? | **No packet.** And the honest form of the question was answered: removing the *rule* changes the endpoint on 5.4% of the 42.5% of opportunities where players decline — about `4.7e-5` per position |

---

## Attack 14, answered rather than deflected

*Did the work outrun its value?*

**The gate: yes, it is worth it, and it is one gate.** It passes today and fixes nothing, which is
the objection. What it fixes is that nothing stopped the next trigger from being a centipawn number,
and the packet spec lists that as refusal 9 — one of three the system could not make. Its control
fires on the transitive case, which is the one a declaration-only check would miss.

**The Python: yes, and the ratio is stated.** 54,959 searches bought one gate verdict, one gate
control, one closed research blocker, three new datasets, four engine-free pre-screens and a cache
that has already saved 2,268 searches. `COMPUTE_VALUE_EXTRACTION.md` is the accounting.

**The 4.3 MB: yes, and it is checked.** It costs an hour of four-way CPU to reproduce and a
`git clone` to have. `GATE-RESEARCH-RECONCILED` re-hashes it on every gate run, verified by
tampering.

**The eleven documents: partly no.** `INTERVENTION_EXPERIMENT.md` and `FIELD_PROTOCOL.md` exist
because Phase 13 requires them, and both are `NOT ADMISSIBLE`. They carry the blocker and the
unblocking sequence and nothing else, which is the minimum that is not fabrication — but a reader
counting deliverables should count them as two, not as eleven.

**What genuinely outran its value: nothing shipped.** No surface, no type in `shared/`, no flag
flipped, no production behaviour changed. The complexity is in the research tree, where a wrong turn
costs a re-run rather than a player.

---

## What this pass could not attack

The whole right-hand side of the barrier chain. Recognition, action selection, conditional
discrimination, retention, time pressure and ecological transfer are all untouched, because no human
was measured — **which is not a gap in this pass but its subject**: the pre-human gates exist so that
`INSUFFICIENT_OPPORTUNITIES` can be reached without asking anybody for their time, and that is what
happened.

**P0 / P1 methodological issues found: two, both in this cycle's own claims, both corrected in the
files that made them.** Neither blocks a product claim, because no product claim is made.
