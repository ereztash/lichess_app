# Telos-Conditioned Resource Field (TCRF) — formal research specification

**Status: RESEARCH CANDIDATE. Not a product truth, not a detector contract, and not permission to change the UI.** This document defines the construct that EXP-R2 will try to falsify.

The construct exists to answer one question:

> Given a chess position, what resources and relations does a player represent as decision-relevant, how are those resources valued relative to a live telos, how are board and cognitive resources allocated, and does that representation explain action beyond what the position alone already says?

The object is **not** a fixed piece-value table. The central claim is conditional:

> Resource value is a property of `resource × relation topology × state × telos × opponent response × decision budget`, not an intrinsic scalar attached to a piece or motif.

---

## 1. Epistemic ladder

The repository's existing research convention applies unchanged.

1. **Observation** — FEN, legal moves, clock, think time, move, free-text report, candidate report.
2. **Construct** — attack/defence topology, coalition, affordance, perceived resource, perceived telos.
3. **Prediction** — whether those constructs add held-out information about action or time allocation.
4. **Causal claim** — whether changing a relation, time budget, or intervention changes behaviour.
5. **Product claim** — what may be said to a player.

EXP-R2 may reach rung 3 and, for randomized topology/time manipulations, a narrow rung-4 statement about the manipulation. It cannot validate coaching language or a mastery score.

---

## 2. State and primitives

A decision state is

`S_t = (B_t, side_t, rights_t, clock_self_t, clock_opp_t, history_t)`.

`B_t` is the board configuration. `rights_t` includes castling and other rule-state required to reconstruct legal action. Clock fields are kept separate from board state because time is a **meta-resource**: it buys computation about how to allocate board resources; it is not another piece on the board.

### 2.1 State primitives are not yet resources

The objective state contains entities before any resource claim is made:

- own and opponent pieces/pawns;
- squares and legal movement channels;
- side to move and rights;
- own/opponent clock;
- history required for legality.

Calling every primitive a resource would make the construct vacuous. A primitive becomes resource-relevant only through the relations, affordances and telos below.

---

## 3. Structural field: a typed hypergraph

For a position `S`, define a structural field

`G(S) = (V, E, H)`.

### 3.1 `V` — carriers and environmental nodes

`V` contains state primitives used by detectors: pieces, pawns, relevant squares, targets and rule rights. `V_self ⊂ V` denotes entities controlled by the player; `V_opp` denotes opponent-controlled entities. A square is not called a resource merely because it is a node.

### 3.2 `E` — pairwise relations

Relations are typed and versioned. The initial admissible family is restricted to relations that can be derived reproducibly from a position, for example:

- attacks / defends;
- controls square;
- blocks / screens line;
- line-of-sight / x-ray;
- pins / is pinned by;
- legal-mobility dependency;
- protects an entry square or promotion path.

Strategic prose such as `good bishop`, `initiative`, `weak colour complex` is **not** a primitive edge. Such terms may later be hypotheses derived from lower-level structure.

### 3.3 `H` — higher-order coalitions and motifs

A coalition is a connected multi-element structure whose joint functional effect is not represented adequately by independent pairwise labels. Candidate examples include batteries, mutual-support structures, overloaded-defender structures, restriction nets, pawn chains and coordinated mating nets.

The list is deliberately open. A motif class enters the canonical vocabulary only after a versioned detector and an empirical test exist. Network-motif literature is used here as a structural analogy, not as evidence that chess must contain the same motifs.

**Structural motif ≠ functional motif.** A structural relation may exist on the board and still be irrelevant to the player's current action. The functional field is telos-conditioned.

---

## 4. Affordances: what the field makes possible

An **affordance** is an action opportunity available in the current state because a particular structural configuration makes it feasible.

For an affordance `a`:

```text
A(a) = {
  action_or_option,
  prerequisite_structure P(a),
  target_telos,
  opponent_response_set,
  horizon,
  provenance
}
```

Examples are not canonical categories, only illustrations: invade a file, remove a defender, create a fork, trade into a favourable ending, push a passed pawn, force perpetual, create luft.

This level matters because the same structural graph can support several competing actions, and the same legal move can serve different teloi.

The product must never infer `the player saw affordance a` from `the player played move m` alone. Action is evidence about representation, not identity with representation.

---

## 5. Telos is a hierarchy, not `win` repeated at every level

Chess has a terminal utility, but human decisions are made through intermediate goals. Represent `T_t` as a directed acyclic goal graph with four provisional levels:

1. **terminal** — win / draw / avoid loss;
2. **strategic** — e.g. king attack, favourable ending, suppress counterplay;
3. **operational** — e.g. open a file, remove a defender, create a passer;
4. **immediate** — the next concrete action state to create.

A telos node stores:

```text
{ id, level, statement, success_condition, horizon, parent_id,
  authored_by: player | system_hypothesis, provenance }
```

Player-authored telos and system-inferred telos are never merged. A system hypothesis cannot be shown as something the player intended.

---

## 6. Resource value is conditional marginal contribution

### 6.1 No fixed global hierarchy

There is no canonical claim of the form `connected rooks > connected knights`.

For a resource carrier, relation or coalition `r`, define its value only relative to state and telos:

`Value(r | S_t, τ, π_opp, h)`

where `π_opp` is the opponent-response model and `h` is the relevant horizon.

### 6.2 Characteristic function candidate

To make cooperative-game concepts testable without deleting pieces from the board, the candidate characteristic function is defined over **affordances enabled by a subset of the resource field**, not over impossible boards with pieces removed.

Let `C` be a subset of admissible resource elements and relations. Let `A_C` be the set of pre-registered affordances whose prerequisite structure is contained in `C`. Then a candidate value function is:

`ν_τ(C | S) = max_{a ∈ A_C} Q_τ(S, a)`

where `Q_τ` is expected progress toward telos `τ` under the stated opponent-response model.

This is a **research definition**. It cannot be implemented as truth until `P(a)` and `Q_τ` survive validation. Its purpose is to prevent the invalid shortcut `remove piece → engine delta → piece value`.

### 6.3 Synergy / redundancy

If a valid `ν` is established, Shapley interaction is a candidate method for distinguishing:

- positive interaction: the coalition enables more value than the elements separately;
- redundancy: either element substitutes for the other;
- antagonism: the combination constrains value relative to alternatives.

For a pair `i,j`, the local discrete interaction term is:

`Δ_ij(S) = ν(S∪{i,j}) - ν(S∪{i}) - ν(S∪{j}) + ν(S)`.

A full Shapley Interaction Index averages such differences over admissible contexts. It is not computed in EXP-R2; R2 tests whether relation/coalition structure is psychologically and behaviourally real enough to justify that later step.

### 6.4 Connectivity restriction

Ordinary Shapley treatment permits every coalition. Chess does not. Two elements that cannot functionally interact should not receive credit for an impossible coalition. A Myerson-style **graph-restricted game** is therefore a better candidate than unconstrained Shapley when the resource graph has been validated: only connected/feasible coalitions contribute.

This is an analogy to graph-restricted cooperative games, not a claim that Myerson value is already the correct chess metric.

---

## 7. Hierarchy means a telos-conditioned partial order

The phrase `resource hierarchy` is retained, but a total ranking is rejected.

Define `r_i ≻_(S,τ) r_j` only when evidence supports that `r_i` has greater decision-relevant marginal contribution than `r_j` across the admissible opponent-response/horizon set. If neither robustly dominates the other, they remain **incomparable**.

Thus the output is a partial order / pairwise preference field, not `1st, 2nd, 3rd` by force.

This matters because synergy can reverse apparent rankings: two individually modest resources can form the dominant coalition, while the materially largest piece may be functionally inert.

A useful operations-research analogy is a **shadow value**: the importance of a resource is the change in achievable objective value when the relevant constraint is relaxed. In discrete chess the research object is a finite marginal contribution, not a derivative.

---

## 8. The player's subjective field is a separate latent object

The player may represent a different field from the deterministic one:

`Ĝ_u(S_t), T̂_u(S_t), ν̂_u`.

None is directly observed. Evidence may come from:

- move chosen;
- candidate moves stated before commitment when that instrument is active;
- confidence;
- think time and clock state;
- **post-commit, pre-reveal** free text about what mattered and what the player was trying to make happen;
- later, only if justified, gaze or interaction traces.

The current `DecisionAtom` already preserves move, stated known/unknown, candidates, confidence, protocol, reveal timing and result. TCRF extends the research model; it does not silently reinterpret existing rows as resource reports.

---

## 9. Representation units — culture-safe by construction

The research must not force every participant into an object-centred ontology. Open-ended responses are coded first at the **level of representation**, not into a Western chess textbook list:

1. `OBJECT/CARRIER` — a piece, pawn, square or material unit;
2. `RELATION` — attack, defence, restriction, dependency, line;
3. `COALITION/MOTIF` — multi-element functional structure;
4. `AFFORDANCE` — an action opportunity the structure enables;
5. `CONSTRAINT` — what is prevented / what must be answered;
6. `TELOS` — desired future state or subgoal.

A response may contain several levels. No level is defined as inherently superior.

### 9.1 Cross-cultural guardrail

Cultural-psychology findings are used to prevent a measurement error, not to stereotype players. Different social/ecological contexts can shift analytic versus relational attention, while modern cross-cultural methodology warns that national labels and translated scales often confound culture, language and measurement method.

Therefore:

- source-language free text is retained;
- bilingual coding precedes any convenience translation used for display;
- country/language are descriptors, not causal explanations;
- the primary cross-context test is **nomological**: does topology perturbation change representation and action in the same predicted direction?;
- mean claims such as `culture X is more holistic` are forbidden in EXP-R2;
- non-invariance is a finding, not an error to be massaged away.

---

## 10. Two resource systems must not be collapsed

### 10.1 Board-resource allocation

Which structural elements / affordances are mobilised by the chosen action toward a telos.

### 10.2 Cognitive-resource allocation

Time, attention and computation used to decide how to allocate board resources.

Resource-rational analysis motivates the methodological question: given limited computation, was additional computation worth its cost? It does **not** license the claim that humans are in fact resource-rational.

The recent large-scale chess literature provides a direct candidate construct — value of computation predicts think time — but this repository has already shown that its own attempted deep reference can be unstable. Therefore EXP-R2 treats think time as an outcome of randomized structure/time conditions, not as a validated `ComputationNeed` score.

---

## 11. Candidate measures — kept separate

No composite `Resource Score` is permitted.

- **Topology sensitivity** — does a targeted relation perturbation change what the player reports?
- **Coalition sensitivity** — does changing synergy while preserving carriers change representation?
- **Telos coherence** — is the reported important structure linked to the reported intended state?
- **Allocation coherence** — does the chosen action use the structure the player reported as important? Initially human-coded and secondary.
- **Affordance sensitivity** — does a structural perturbation change the action opportunity selected?
- **Meta-allocation sensitivity** — does decision time change when the decision-relevant structure changes under a fixed clock regime?
- **Cross-context robustness** — do the relations above generalise across rating, language and training contexts?

A future marginal-contribution or interaction score is unlocked only after EXP-R2 establishes the construct and a later study validates the characteristic function.

---

## 12. Failure taxonomy — hypotheses, not user labels

If the construct survives, later research may test these failure locations:

1. `PERCEPTUAL_OMISSION` — relevant structural element not represented;
2. `RELATIONAL_MISREAD` — entities represented, relation misrepresented;
3. `COALITION_BLINDNESS` — components represented, joint function omitted;
4. `AFFORDANCE_OMISSION` — structure represented, enabled action not generated;
5. `TELOS_MISMATCH` — allocation coherent with a goal that is itself poor for the state;
6. `CONTRIBUTION_MISRANK` — represented resources valued in the wrong conditional order;
7. `ALLOCATION_MISMATCH` — stated high-value structure not mobilised by action;
8. `OPPONENT_RESPONSE_MISREAD` — value depends on an opponent response model that fails;
9. `METAREASONING_MISMATCH` — cognitive budget spent where additional computation has low value;
10. `CONVERSION_FAILURE` — resource advantage created but not converted;
11. `EXECUTION_CONTAMINATION` — physical/UI action does not faithfully express the decision.

Current `threat_scan`, `candidate_generation`, `calculation`, `evaluation`, `time_allocation` remain useful mechanism hypotheses. They are lower-level explanations for some failures above, not the TCRF state model itself.

---

## 13. What would falsify or materially weaken TCRF

TCRF is not protected from failure. It is weakened if any of the following survive well-powered, held-out tests:

- relation/coalition perturbations do not change player representation beyond object identity;
- free-text representation cannot be coded reliably without seeing outcomes or condition labels;
- representation adds no information about action beyond position/template/rating;
- apparent coalition effects reduce entirely to material or engine-evaluation changes;
- the effect exists only when the UI explicitly names the relation, meaning the instrument created the construct it claims to measure;
- cross-language/context effects are explainable by translation/coding artefacts;
- a total ranking is required to make the construct predictive;
- engine-defined `importance` is the only thing that makes the model work.

Any of these may produce `STOP` rather than a revised score.

---

## 14. Research sequence

```text
EXP-R2  Structural/subjective construct validity
   ↓ only if passed
EXP-R3  Validate contribution function + partial hierarchy
   ↓
EXP-R4  Matched intervention test: diagnosis → intervention fit
   ↓
EXP-R5  Natural-game transfer + retention
   ↓
PRODUCT CLAIM
```

No later stage is implied by an earlier pass.

---

## 15. External theory families used as constraints

These sources motivate the structure; none is treated as direct evidence for a product claim.

- McGregor & Howes (2002), attack/defence semantics in expert chess memory: https://pubmed.ncbi.nlm.nih.gov/12219888/
- Reingold/Bilalić line of chess eye-movement work; experts detect relevant information earlier: https://pmc.ncbi.nlm.nih.gov/articles/PMC4142462/
- Cisek (2007), affordance competition / simultaneous specification and selection of actions: https://pubmed.ncbi.nlm.nih.gov/17428779/
- Lieder & Griffiths, resource-rational analysis: https://pubmed.ncbi.nlm.nih.gov/30714890/
- Griffiths, Lieder & Goodman, rational use of cognitive resources: https://pubmed.ncbi.nlm.nih.gov/25898807/
- Large-scale chess evidence connecting think time to value of computation: https://pubmed.ncbi.nlm.nih.gov/41137861/
- Gigerenzer & Gaissmaier, ecological rationality / heuristic-environment fit: https://www.annualreviews.org/content/journals/10.1146/annurev-psych-120709-145346
- Shapley interaction as a higher-order coalition interaction measure: https://link.springer.com/article/10.1007/s10994-026-07062-6
- Myerson/graph-restricted cooperative-game framing: https://link.springer.com/article/10.1007/s10957-018-1348-8
- Network motifs and higher-order hypermotifs as structure/function analogies: https://www.nature.com/articles/nrg2102 and https://www.nature.com/articles/s41540-026-00701-7
- Cross-cultural cognition methodology and limits of WEIRD generalisation: https://pubmed.ncbi.nlm.nih.gov/36510095/
- Relational mobility as one socioecological predictor of analytic/holistic attention across the U.S., Spain, Israel, Nigeria, Morocco and Japan: https://pubmed.ncbi.nlm.nih.gov/30614727/
- Cross-cultural measurement validity / construct adaptation: https://pubmed.ncbi.nlm.nih.gov/18924560/

---

## 16. Canonical one-sentence claim

> **TCRF models a chess decision as the allocation of a limited cognitive budget over a telos-conditioned field of structurally connected action resources, while keeping the player's subjective representation separate from the objectively derived board structure.**
