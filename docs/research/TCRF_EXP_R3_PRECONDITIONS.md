# EXP-R3 preconditions — what must exist before marginal contribution is a meaningful question

**Status: A GATE LIST, NOT A PLAN.** EXP-R3 is where
[`TELOS_CONDITIONED_RESOURCE_FIELD_SPEC.md`](./TELOS_CONDITIONED_RESOURCE_FIELD_SPEC.md) §6 and §7
would be tested: the characteristic function `ν_τ(C|S)`, Shapley interaction, graph-restricted
coalitions, and a telos-conditioned partial order. None of that is computed in EXP-R2 and none of it
is computed here.

This document exists because §7 of the execution task asks one question and it deserves a direct
answer:

> Do the future mathematical objects have identifiable inputs?

**Answer: two of them do not, and one of those is not on EXP-R2's path at all.** A clean EXP-R2 pass
therefore does not unlock EXP-R3. It unlocks the work of building the missing observables.

---

## 1. What EXP-R3 would need, and whether EXP-R2 supplies it

| # | R3 object | input it requires | does R2 produce it? |
| --- | --- | --- | --- |
| **P-1** | any value claim about a relation | evidence that relations are represented at all | **yes, if H1 passes.** This is the point of R2 |
| **P-2** | any value claim that matters | evidence that representation carries information about action | **yes, if H2 passes** |
| **P-3** | `A_C`, the affordances a subset enables | a complete prerequisite-structure map `P(a)` for every admissible affordance | **no. R2 freezes `P(a)` per template by human review, for 32 templates.** That is a lookup table, not a function |
| **P-4** | `Q_τ(S,a)`, expected progress toward a telos | an opponent-response model `π_opp` | **no, and R2 cannot.** Nothing in a session observes what the participant expected the opponent to do. §7.3 freezes the three questions, so the instrument cannot be extended within R2 |
| **P-5** | `ν_τ(C|S)` | P-3 and P-4 together | **no** |
| **P-6** | `Δ_ij`, the pairwise interaction term | `ν` evaluated on four subsets per pair | **no**, follows P-5 |
| **P-7** | a Shapley Interaction Index | `ν` averaged over admissible contexts, plus a decision about which contexts are admissible | **no**, follows P-5 |
| **P-8** | a Myerson-style graph-restricted game | a validated feasibility graph — which coalitions can functionally interact | **partly.** `research/tcrf/relations.ts` produces a deterministic connectivity structure. Whether it is the RIGHT restriction is untested |
| **P-9** | a partial order `≻_(S,τ)` | P-5 plus a rule for declaring incomparability | **no**. A partial order over unvalued elements is empty |
| **P-10** | a telos hierarchy to condition on | a four-level DAG with parent links and success conditions | **no.** R2 asks one open question and codes one binary. See audit A-9 |
| **P-11** | a motif vocabulary wide enough to test coalitions | more than one higher-order detector | **no.** `battery` is the only one. See audit A-13 |

---

## 2. The three blocking preconditions, in order of difficulty

### P-4 — the opponent-response observable does not exist and is not scheduled

This is the hardest and it is invisible in the specification, because `π_opp` appears as a
conditioning symbol rather than as a measurement. Every quantity on the cooperative-game side of
TCRF is conditioned on it, so it gates P-5 through P-9 in one step.

R2 cannot supply it: §7.3 freezes three questions and none of them asks what the participant
expected. An R2.5 instrument would be needed — for example, eliciting the expected reply
post-commit, which is a fourth question and therefore a change to the frozen protocol, and which
H6's reactivity result would govern.

**Until P-4 exists, `ν_τ` is not estimable and Shapley interaction is not defined over anything.**

### P-3 — the prerequisite-structure map is a lookup table, not a function

§6.2 defines `ν_τ(C|S) = max_{a ∈ A_C} Q_τ(S,a)`, where `A_C` is the set of affordances whose
prerequisite structure is contained in `C`. That requires knowing `P(a)` for arbitrary affordances in
arbitrary positions.

R2 produces `P(a)` for 32 templates, by two humans, frozen before recruitment. That is exactly what
§4.5 asks for and it is the right thing for R2 — it is a stimulus property, not a model. But it does
not generalise: there is no procedure in this implementation that, given an unseen position and an
affordance, returns its prerequisite structure.

**What R2 does contribute:** if H1 and H2 pass, the 32 frozen `P(a)` entries plus the coded responses
become the first labelled set anyone could fit such a procedure against. That is a real head start
and it is not the same as having the function.

### P-10 and P-11 — the vocabulary is one question and one motif wide

The telos hierarchy and the motif vocabulary are both under-specified for R3 in the same way: the
specification keeps them open (§3.3: "a motif class enters the canonical vocabulary only after a
versioned detector and an empirical test exist"; §5: four telos levels), and R2 implements one motif
detector and one telos question. Both are correct decisions for R2 and both are gaps for R3.

---

## 3. What EXP-R2 must establish for any of this to be worth starting

Copied from the preregistration's §13 verdict matrix, with the R3 consequence attached:

| EXP-R2 verdict | R3 status |
| --- | --- |
| `STOP` (H1 fails) | **R3 never happens.** There is no relational representation to assign value to |
| `RESEARCH_ONLY` (H1 passes, H2 fails) | **R3 is not justified.** A representation that carries no information about action does not need a value function; it needs an explanation |
| `CONDITIONAL_RESEARCH` (H1+H2 pass, H4 not established) | R3 may proceed **within the supported contexts only**, and no universal ontology claim may be made |
| `UNLOCK_EXP_R3` (H1+H2+H4 pass) | R3 is justified **and still blocked on P-3 and P-4** |

Plus three conditions that are not in the verdict matrix and should gate R3 independently:

- **`STOP-R2-C` did not fire.** A result that lives in one motif family cannot support a value
  function over coalitions in general. Given audit A-2, this is the most likely blocker.
- **`STOP-R2-REACTIVITY` did not fire**, or if it did, R3's instrument accounts for it. If probes are
  interventions, an R3 design that probes repeatedly is measuring its own instrument.
- **C3 did not favour the object-only baseline.** If piece and material features explain the action
  as well as relational features do, then the simpler construct won and R3's subject does not exist.

---

## 4. The rule that carries over

§6.2 of the specification defines `ν` over **affordances enabled by a subset of the resource field**
rather than over boards with pieces deleted, and says why: the shortcut `remove piece → engine delta
→ piece value` is invalid. That rule survives this audit intact and is the one thing R3 must not
quietly abandon when P-3 and P-4 turn out to be expensive.

A piece-deletion counterfactual is cheap, produces a number, and measures the wrong thing: the
position after deletion is not a position the game can reach, and its evaluation is not the
contribution of the piece to anything the player was doing.
