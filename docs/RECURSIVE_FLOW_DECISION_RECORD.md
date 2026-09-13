# Decision Lab — Recursive Flow Decision Record

**Status:** Canonical product-decision record for the recursive-flow direction  
**Date:** 2026-09-13  
**Scope:** Product architecture, user journey, state semantics, and design implications  
**Not a claim of user validation:** This document records the reasoning and decisions that led to the current product direction. It does not convert hypotheses into field evidence.

---

## 1. Why this document exists

Decision Lab accumulated several strong capabilities before the user journey had one sufficiently explicit spine.

During product review, this created a recurring problem: individual screens, evidence states, research rules, learning ideas, and future gamification concepts could each be improved in isolation, but the product risked becoming a collection of intelligent subsystems rather than one coherent experience.

This document preserves the decision chain that led from a visual/UX concern to a product-architecture decision:

> **Before optimizing individual states, Decision Lab needs one recursive loop that explains the entire product.**

The purpose of this record is to prevent future work from reopening settled questions without new evidence, and to make clear which ideas were accepted, rejected, deferred, or left as explicit hypotheses.

---

## 2. Evidence discipline for this record

Three evidence classes are used below.

### REPO
Facts directly supported by the current repository, tests, research artifacts, or implemented behavior.

### RESEARCH
Findings from the dedicated behavioral-learning / gamification research conducted on 2026-09-13.

### SESSION HYPOTHESIS
Product reasoning developed during design discussion. These may be strong hypotheses, but they are not treated as user evidence.

A decision may be valid as a product decision even when its mechanism remains unvalidated. Where that is the case, the distinction is stated explicitly.

---

## 3. Starting condition

The existing product already had an unusually strong epistemic architecture.

The repository explicitly separates:

```text
position analysis
from
pre-engine decision evidence
```

and treats the core product rule as:

> **The player decides before the machine speaks.**

The repository also explicitly avoids claiming that current findings establish Elo improvement, general chess improvement, causal cognitive mechanism, or universal player-specific structure.

That discipline is a retained constraint. Any new product flow must preserve it.

At the same time, the product experience had become fragmented across surfaces such as Record, Play, Blitz, Reveal, pattern/evidence states, and learning-oriented ideas.

The design problem initially appeared visual.

It was not only visual.

# PART I — THE DECISION CHAIN

## 4. Decision 01 — The initial symptom was monotony, not obvious visual failure

### Observation — SESSION HYPOTHESIS

The application felt clean, serious, simple, and coherent, but also increasingly monotonic compared with contemporary products.

The concern was not merely that it lacked color, gradients, or decoration.

Different product states often received similar visual treatment:

- pale background;
- restrained panels;
- similar hierarchy;
- similar button grammar;
- similar emotional temperature.

### Competing hypotheses

**H1 — Simplicity is the problem.**  
The product is too minimal and needs more visual complexity.

**H2 — Uniformity is the problem.**  
The product is appropriately simple, but semantically different states are represented too similarly.

### Decision

Reject H1 as the primary explanation.

Adopt H2 as the working design hypothesis:

> **The problem is not insufficient complexity. The problem is insufficient semantic contrast between states.**

### Consequence

The design target became:

> **Minimal surface, maximum semantic contrast.**

This implies that identity, typography, interaction laws, and component semantics may remain stable while composition, emphasis, motion, density, and visual temperature may change when the meaning of the state changes.

---

## 5. Decision 02 — Separate what must remain invariant from what must visibly change

### Observation — SESSION HYPOTHESIS

A product can preserve coherence without forcing every state to look alike.

### Decision

Adopt a three-layer distinction:

### Layer A — Constitution

These should usually remain stable:

- grid;
- typography family;
- spacing logic;
- accessibility behavior;
- button semantics;
- focus treatment;
- board behavior;
- global navigation rules.

### Layer B — Semantic grammar

The representation of a meaning should remain stable across the product.

Examples:

- evidence should look like evidence;
- uncertainty should not look like confirmation;
- finding should not look like input;
- action should not look like observation.

### Layer C — Scene / state

These may change materially because the user's psychological and product state has changed.

Examples:

- deciding;
- committing;
- revealing;
- uncertainty;
- practising;
- returning.

### Governing principle

> **What keeps the same meaning should remain visually consistent. What changes meaning should be allowed to change perceptually.**

---

## 6. Decision 03 — Visual experiments showed that richness does not require more UI

### Observation — SESSION HYPOTHESIS

Several visual concepts were explored.

The strongest concept did not win because it added the most elements. It won because different states became perceptually distinct while a consistent product identity remained.

The important design inference was:

> **Richness is not the same as more interface.**

Visual richness can come from:

- composition;
- scale;
- typography;
- selective color;
- motion;
- spatial hierarchy;
- changing emphasis;
- controlled emotional temperature.

### Rejected interpretation

Do not conclude that Decision Lab requires a cinematic, luxury, RPG, or highly theatrical skin.

### Decision

Retain the principle of state differentiation.

Defer any full visual redesign until the product states themselves are stable.

---

## 7. Decision 04 — Game metaphors became interesting only when tied to product meaning

### Observation — SESSION HYPOTHESIS

The discussion expanded from component libraries into:

- maps;
- journeys;
- avatars;
- fog of war;
- recurring-pattern visualization;
- skill terrain;
- narrative progression.

### Important distinction

A game metaphor is weak if it merely makes the product more entertaining.

A game metaphor becomes potentially valuable if it represents a real change in the system's epistemic or learning state.

For example:

```text
fog
→ insufficient evidence

signal
→ early evidence

landmark
→ recurring pattern with stronger support

closed path
→ hypothesis refuted

training ground
→ practice
```

### Decision

Do not treat game metaphors as decoration.

Any future map, journey, avatar, or narrative layer must represent real product state without implying unsupported improvement.

### Deferred ideas

- avatar;
- RPG identity;
- dynamic map;
- fog of war;
- narrative campaign;
- skill tree.

These remain extension hypotheses, not product requirements.

---

## 8. Decision 05 — Anti-silo / provenance became a product principle

### Observation — SESSION HYPOTHESIS

An insight is harder to trust and act on when it appears as an isolated conclusion.

The product should preserve the chain that justifies why information is being shown now.

### Decision

Adopt the following progressive-depth model:

### Surface

What matters now?

### Why now?

Why did this become worth showing at this point?

### Evidence trail

Which prior decisions or contexts support it?

### Canonical chain

```text
decision evidence
→ recurrence / context
→ claim-state change
→ surfaced interpretation
→ next act
```

### Product principle

> **No important reveal should be detached from the reason it became legitimate to reveal it.**

This principle is retained regardless of whether the future UI is minimal, graphical, narrative, or game-like.

---

## 9. Decision 06 — A major risk was identified: prospective evidence may impose a user tax

### Observation — REPO + SESSION HYPOTHESIS

Decision Lab's differentiated evidence depends on capturing some information before engine feedback can contaminate it.

That creates a structural risk:

```text
player effort
→ better evidence for the system
```

instead of:

```text
player effort
→ better value for the player
```

The repository itself contains evidence that measurement burden is not trivial: high-frequency confidence prompts and unused burden were previously reduced or removed.

### Working risk

The measurement instrument can start behaving as though its needs are the user's purpose.

This was framed as an Instrument–Telos risk.

### Decision

Retain a strong design constraint:

> **The player should not become an employee of the research instrument.**

Every recurring user cost should either create immediate user value, credible future option value, or be eliminated.

---

## 10. Decision 07 — Optional reflection and sampling were separated conceptually

### Observation — SESSION HYPOTHESIS

If the user alone chooses when to reflect, evidence is strongly selected by the user's own uncertainty, difficulty, or desire for help.

If the system alone forces reflection, user burden and loss of flow may become unacceptable.

### Candidate architecture

Support distinct event streams:

```text
normal play
self-initiated reflection
system-invited reflection
explicit skip
unanswered / abandonment
```

### Decision

Do not silently pool these event types.

Self-initiated reflection may provide strong evidence about demand and perceived usefulness, while system-sampled reflection may support different inference.

Skip itself may contain information about burden and timing, but must not be overinterpreted.

---

## 11. Decision 08 — Reward/game-economy ideas were generated, then deliberately challenged

### Candidate concepts — SESSION HYPOTHESIS

Possible rewards for reflection included:

- extra time;
- hint;
- question / coaching prompt;
- retry;
- rewind;
- saveable resource;
- informational payoff;
- progression representation.

A possible game economy emerged:

```text
reflection
→ resource
→ optional assistance
→ later evidence
```

Behavioral-learning frameworks were considered, including:

- Social Cognitive Theory / Bandura;
- self-efficacy;
- self-regulation;
- operant learning;
- Self-Determination Theory;
- scaffolding and fading;
- metacognition;
- transfer.

### Critical correction

These theories provide useful distinctions, but do not themselves justify a game economy.

A reward must be evaluated by its actual effect, not labelled reinforcement merely because it is presented after a behavior.

---

## 12. Decision 09 — Deep Research rejected the rich game economy for now

### Research verdict — RESEARCH

The dedicated behavioral-learning economy research concluded:

> **ONLY PROTOTYPE**

The research found no current justification for substantial product, design, or engineering investment in:

- currency;
- extra time;
- rewind;
- hints economy;
- saveable resources;
- map;
- avatar;
- narrative.

The research identified one narrow candidate worth testing:

```text
random optional invitation
→ short reflection
→ lock prospective evidence
→ short informational receipt
```

### Why

The current product already reduces burden through partial sampling and clock handling.

There is still no direct field evidence that reflection burden is the dominant commercial bottleneck rather than:

- unclear value;
- reveal payoff;
- product orientation;
- continuation pull;
- other journey problems.

### Important result

The research therefore prevented a premature architecture expansion.

### Decision

Do not build a game economy now.

Do not build map/avatar/narrative now.

Preserve them only as extension hypotheses.

### Investment rule retained

> **Build only the cheapest layer whose marginal value survives falsification.**

---

## 13. Decision 10 — The team was still optimizing branches before the trunk

### Observation — SESSION SYNTHESIS

At this point the discussion had accumulated sophisticated questions about:

- reward design;
- sampling;
- maps;
- narrative;
- visual language;
- provenance;
- behavior theory;
- state differentiation.

But a more basic issue became visible:

> We were trying to perfect the flow before defining the product spine that all those ideas were supposed to improve.

The problem was not lack of product ideas.

The problem was insufficiently explicit recursion.

### Decision

Stop optimizing branches.

Define the canonical recursive product loop first.

# PART II — THE CURRENT CANONICAL DIRECTION

## 14. Decision 11 — Decision Lab should be one recursive learning loop

### Canonical product thesis

Decision Lab should not primarily feel like a collection of screens or modules.

It should feel like one recurring loop in which:

1. the player encounters a real decision;
2. some pre-feedback thinking may be preserved;
3. the player acts;
4. new evidence becomes available;
5. the system updates what can legitimately be inferred;
6. the player receives or chooses a meaningful next act;
7. the player returns to real chess;
8. later decisions alter the interpretation of earlier ones.

### Candidate canonical spine

```text
PLAY
→ CAPTURE
→ ACT
→ REVEAL
→ UPDATE
→ NEXT ACT
→ PLAY
```

The exact labels may change if implementation reveals a better minimal model.

The structural requirement should not.

### Definition of recursion

Recursion does not mean repeating the same questionnaire.

It means:

> **The output of one cycle changes the interpretation, state, or possibilities of future cycles.**

---

## 15. Decision 12 — Reveal is not the endpoint

### Prior risk

A product organized around analysis can accidentally treat Reveal as the payoff and stopping point.

### Decision

Reveal must answer three separate questions:

```text
What did we observe?
What does this change?
What becomes useful now?
```

Possible legitimate answers include:

- nothing new yet;
- weak signal;
- signal repeated;
- context changed interpretation;
- hypothesis weakened;
- hypothesis refuted;
- practice now justified;
- no action justified;
- return to normal play.

### Consequence

Every meaningful terminal state should reconnect to future real decision-making.

---

## 16. Decision 13 — Event state, claim state, and journey state must remain separate

### Event state

What happened in this decision?

Examples:

- prompt shown;
- prompt skipped;
- confidence recorded;
- move committed;
- hint used;
- move evaluated.

### Claim state

What does accumulated evidence justify saying?

Examples:

- insufficient evidence;
- candidate signal;
- recurring pattern;
- context-dependent pattern;
- hypothesis refuted;
- assisted success;
- unassisted success;
- transfer observed.

### Journey state

What is useful for the player to do next?

Examples:

- keep playing;
- inspect;
- practise;
- retry;
- test later;
- do nothing now.

### Decision

Do not encode these as one status.

A bad move is not automatically a player pattern.

A recurring pattern is not mastery.

Assisted performance is not independent performance.

Practice success is not transfer.

---

## 17. Decision 14 — Patterns are longitudinal hypotheses, not personality labels

### Decision

Any recurring pattern should be modelled as an object whose state can change across loops.

Candidate states may include concepts such as:

```text
UNKNOWN
SIGNAL
CANDIDATE
REPLICATED
CONTEXT_CHECKED
PRACTISED
SUPPORTED_SUCCESS
UNASSISTED_SUCCESS
WATCHED_IN_PLAY
REFUTED
RETIRED
```

These labels are not mandatory.

### Rule

Keep a distinction only if collapsing it changes at least one reality-facing decision:

- what the system may claim;
- what the player sees;
- what action follows;
- what evidence is needed;
- how future evidence is interpreted.

### Product principle

> **Separate constructs only when collapsing them changes reality-facing decisions.**

---

## 18. Decision 15 — Negative states must remain legitimate product states

### Decision

The following are valid outcomes:

- no pattern found;
- insufficient evidence;
- pattern did not recur;
- hypothesis weakened;
- hypothesis refuted;
- no useful intervention exists;
- player skipped;
- evidence unavailable.

Do not convert these into fake progress.

### Requirement

A negative state should still answer:

> What has become possible, unnecessary, or better understood because of this result?

For example, refuting a pattern can prevent wasted practice.

---

## 19. Decision 16 — The next action must serve the player's journey, not evidence hunger

### Decision

The system must not derive next action only from what the database lacks.

The correct question is:

> **Given what the player just experienced, what action creates legitimate player value now?**

Possible answer:

> Continue normal chess and wait for another natural occurrence.

### Consequence

A valid product loop may sometimes choose not to collect another sample immediately.

---

## 20. Decision 17 — Normal play is the environment to which the product must return

### Decision

Decision Lab should not become a parallel game that replaces chess.

The recursive architecture should repeatedly reconnect to ordinary decisions.

```text
reflection → play
reveal → play
practice → play
pattern update → play
refutation → play
```

Later unassisted behavior is more important than continued performance inside a heavily scaffolded product state.

# PART III — WHAT IS CURRENTLY DEFERRED

## 21. Explicitly deferred layers

The following are not rejected permanently.

They are rejected as prerequisites for the product spine.

### DEFER

- avatar;
- RPG character;
- dynamic map;
- fog of war;
- narrative world;
- XP;
- levels;
- currency;
- saveable resources;
- extra-time economy;
- hint economy;
- rewind economy;
- large skill tree;
- elaborate motion system;
- component-library migration;
- full visual redesign.

### Why

They may eventually enhance a coherent loop.

They cannot substitute for one.

---

## 22. Extension-point rule

Any future extension must answer all five questions:

1. Which transition in the recursive spine does it attach to?
2. What current state does it consume?
3. What new state does it create?
4. What evidence lineage does it alter?
5. What user evidence justifies the additional complexity?

If these questions cannot be answered, the extension should not enter the core product.

# PART IV — DECISION LEDGER

## 23. Compact decision history

| # | Observation | Competing explanation / idea | Decision | Status |
|---|---|---|---|---|
| 01 | Product feels monotonic | Simplicity vs uniformity | Keep simplicity; reduce semantic flatness | RETAIN |
| 02 | Different states look too similar | More decoration vs state grammar | Differentiate meaning, not merely styling | RETAIN |
| 03 | Visual concepts feel richer | More UI vs better composition | Richness can come from state-dependent composition | RETAIN |
| 04 | Map/avatar/story are compelling | Core mechanic vs representation layer | Treat as representation hypotheses only | DEFER |
| 05 | Insights risk appearing as isolated cards | Show conclusion vs preserve chain | Add Why now? + provenance depth | RETAIN |
| 06 | Prospective evidence costs attention | Measurement need vs player value | Never optimize only for instrument needs | RETAIN |
| 07 | User-selected reflection biases data | User-only vs system-only prompting | Preserve multiple event streams | RETAIN |
| 08 | Rewards may offset reflection burden | Game economy may improve exchange | Research before build | TESTED |
| 09 | Rich reward system lacked sufficient evidence | Build economy vs narrow prototype | ONLY PROTOTYPE; kill rich economy for now | DEFER/KILL-NOW |
| 10 | Too many branches were being optimized | Continue polishing vs define trunk | Stop; define recursive spine first | RETAIN |
| 11 | Product surfaces feel modular | Modules vs one recursive loop | Product becomes recursive loop | CANONICAL |
| 12 | Reveal tends to act like endpoint | Result screen vs recursive transition | Reveal must produce Update + Next Act | CANONICAL |
| 13 | Events, claims, and journey can alias | One state model vs three layers | Separate event / claim / journey state | CANONICAL |
| 14 | Patterns may become labels | Trait vs changing hypothesis | Pattern = longitudinal hypothesis | CANONICAL |
| 15 | Null/refutation can feel like failure | Fake progress vs honest negative states | Preserve negative states with consequence | CANONICAL |
| 16 | System may ask for more data | Database need vs user journey | Next action must create player value | CANONICAL |
| 17 | Product may become parallel game | Product world vs return to chess | All roads return to real play | CANONICAL |

# PART V — CURRENT PRODUCT PRINCIPLES

## 24. Canonical principles

### P1 — Player before instrument

The product exists to improve the value of work the player already wants to do, not to make the player serve the research system.

### P2 — Decision before machine

Pre-feedback evidence must remain distinct from anything exposed afterwards.

### P3 — Reveal is a transition

Reveal does not terminate the journey.

### P4 — Claims remain bounded

More evidence about the player is not the same as player improvement.

### P5 — Patterns remain falsifiable

A candidate pattern must be able to strengthen, narrow, contextualize, weaken, or die.

### P6 — Assistance leaves lineage

Supported performance and independent performance remain distinguishable.

### P7 — Negative evidence has product value

Refutation may save effort even when it produces no dramatic finding.

### P8 — Next action serves the player

The next action is not automatically the action that produces the most data.

### P9 — Return to real play

The strongest recursive loop reconnects learning to future chess decisions.

### P10 — Visual difference follows semantic difference

Do not make states different merely for novelty. Do not make meaningfully different states perceptually identical.

### P11 — Complexity must earn itself

Map, avatar, rewards, narrative, and other rich layers enter only if they beat a cheaper alternative on meaningful user behavior.

### P12 — Spine before polish

First make the recursive loop coherent. Then make it effortless. Then make it expressive. Then add richer layers only if evidence justifies them.

# PART VI — GATES FOR FUTURE WORK

## 25. Design gate

Before a full visual redesign:

> Can the current product states be mapped cleanly onto the recursive spine?

If not, do not redesign the surfaces yet.

---

## 26. Gamification gate

Before building map/avatar/reward/narrative systems:

> What specific bottleneck does this layer solve, and does it outperform the cheapest non-game alternative?

If this has not been demonstrated, defer it.

---

## 27. Pattern-visualization gate

Before building a dynamic map or graph:

> Has a simple pattern representation failed to provide sufficient comprehension, action clarity, or return value?

If not, the spatial layer has not earned its cost.

---

## 28. Reflection/reward gate

Before adding functional rewards:

> Is prospective-reflection burden actually limiting useful evidence or return after simpler timing, shorter prompts, and immediate informational value have been tested?

If not, do not add an economy.

---

## 29. Learning gate

Before showing progress language:

Ask what changed in reality.

```text
more evidence collected
≠ player improved

hypothesis strengthened
≠ mastery

success with help
≠ independent ability

practice success
≠ transfer
```

The UI must describe the state actually supported.

# PART VII — CURRENT CANONICAL PRODUCT QUESTION

## 30. The question every future feature must answer

> **How does this help a real chess decision enter the loop, become useful evidence, change what can legitimately be understood, produce a worthwhile next act, and return the player to better-informed future play?**

If a feature cannot answer this question, it should not automatically become part of the core journey.

# PART VIII — CURRENT TARGET EXPERIENCE

## 31. Cold user

A cold observer should eventually be able to understand Decision Lab as:

> I make real chess decisions. Sometimes I preserve what I thought before seeing the answer. The system compares what I believed with what later became knowable. Across decisions it learns what may actually recur. It helps me decide what is worth doing about that. Then I return to chess, where future decisions provide new evidence.

---

## 32. Returning user

A returning player should be able to answer quickly:

> What matters now?

> Why does it matter now?

> What can I meaningfully do next?

The accumulated record should not become a dashboard graveyard.

# PART IX — FALSIFICATION CHECK

## 33. The recursive product direction is not considered coherent unless all of these can be true

- The player can simply play chess.
- Reflection can be skipped without breaking the product.
- Reveal can honestly say “nothing yet.”
- A hypothesis can die.
- Assisted performance remains distinct from independent performance.
- Context can change the interpretation of a pattern.
- A returning user can understand what matters next.
- Major product surfaces reconnect to the same journey.
- The next action creates player value rather than merely system evidence.
- Rich future layers can attach without changing the fundamental evidence model.

Failure on any of these points should be treated as a product-architecture issue before it is treated as a visual-design issue.

# PART X — CURRENT DECISION

## 34. Canonical decision as of 2026-09-13

Decision Lab should first be reorganized around one recursive product spine.

The current working formulation is:

```text
PLAY
→ CAPTURE
→ ACT
→ REVEAL
→ UPDATE
→ NEXT ACT
→ PLAY
```

with separate event, claim, and journey states; preserved pre/post-feedback evidence boundaries; explicit negative states; traceable provenance; and a natural return to real chess.

Full gamification, map, avatar, narrative, and resource-economy work remains deferred until the spine is implemented and user evidence demonstrates a bottleneck those layers solve better than cheaper alternatives.

---

## 35. Governing rule

> **Do not optimize every state before the spine exists.**
>
> **First make the recursive loop coherent. Then make it effortless. Then make it expressive. Then, only if evidence justifies it, make it richer.**
