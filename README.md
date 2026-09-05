# Decision Lab

**Decision Lab studies the player through their decisions — not only the positions they played.**

The application records what a player decided **before the engine speaks**, preserves that evidence across games, and uses it to test whether apparently different mistakes belong to a recurring decision pattern.

The repository now also contains a research pipeline that can compare a player's pattern with same-rating population behavior, isolate a possible personal residual, and turn it into one prospectively testable operation.

> The product does **not** currently claim to improve chess, Elo, or future performance.

---

## Why this exists

A chess engine can answer:

> What did the position require?

A normal game review can answer:

> How much did this move cost?

But neither can reconstruct what existed **before the answer was known**:

- what the player considered;
- what they did not consider;
- how confident they were;
- which alternative they believed in;
- whether the same decision structure appears in materially different positions.

Decision Lab preserves that missing layer.

```text
POSITION ANALYSIS

position
→ engine evaluation
→ mistake


DECISION LAB

decision before engine
→ recorded evidence
→ history across games
→ recurring structure
→ population comparison
→ possible personal residual
→ one future test
```

The distinction matters because:

> a pattern that predicts your mistakes is not necessarily a pattern specific to you.

The population comparison is what separates the two.

---

## How the system learns

```text
DECIDE BEFORE ENGINE
        ↓
CAPTURE DECISION EVIDENCE
        ↓
ACCUMULATE ACROSS GAMES
        ↓
TEST RECURRING STRUCTURES
        ↓
COMPARE WITH EXPECTED PLAYER-LEVEL BEHAVIOR
        ↓
ISOLATE ANY PERSONAL RESIDUAL
        ↓
DERIVE ONE TESTABLE OPERATION
        ↓
TEST IT ON FUTURE GAMES
```

The repository deliberately keeps these stages separate.

A correlation is not a mechanism.  
A predictive region is not automatically personal.  
A personal residual is not automatically causal.  
A plausible intervention is not an effective intervention until tested prospectively.

---

## Current evidence

The table below describes what the repository has established **so far**, not what every future user will automatically receive.

| Question | Current state |
| --- | --- |
| Can the product record decisions before engine feedback? | **Yes** |
| Is the measurement path guarded against known contamination and representation failures? | **Extensively tested in-repo** |
| Can recurring decision structure be found across different chess contexts? | **Demonstrated on the owner's historical record** |
| Does one such structure predict later unseen games? | **Yes, on frozen holdouts** |
| Was the broad pattern shown to be unique to the owner? | **No — mostly level-typical** |
| Did a narrower player-specific residual remain after population correction? | **Yes, in one held-out personal analysis** |
| Has the proposed intervention been shown to reduce the error? | **No — FIELD REQUIRED** |
| Has this mechanism pipeline been prospectively replicated across many players? | **No** |
| Does the repository establish Elo improvement? | **No** |

---

## Strongest current research finding

The current mechanism mission found a broad recurring region:

**R\*** — when one of the player's pieces has more attackers than defenders, while the player is not already materially behind, tactical errors occur substantially more often.

The region:

- was discovered on an earlier frozen window;
- survived a separate validation period;
- survived a later TEST period opened once;
- kept the same direction across opening families, colors, phases, clock states and game states;
- survived a re-score using the Stockfish engine shipped by the product.

But the population comparison changed the interpretation.

Players at a similar rating show much of the same pattern.

So R\* is **predictive**, but mostly **level-typical**, not a personal fingerprint.

A narrower search against the same-rating population baseline then found:

**R\*\*** — when the owner is level or slightly ahead and has an under-defended piece, material is lost more often than the population model predicts.

That residual is currently the strongest candidate for a player-specific pattern.

It is still **not a demonstrated cognitive cause**.

Full research chain:

- [`research/mechanism/MISSION_LEDGER.md`](research/mechanism/MISSION_LEDGER.md)
- [`research/mechanism/NETA_FINDING.json`](research/mechanism/NETA_FINDING.json)

---

## The next unresolved question

The repository has reached a boundary that more historical analysis cannot close:

> Does changing the player's decision process reduce the error in future games?

One operation has been frozen for prospective testing:

> Before committing a move when one of your pieces is attacked more times than it is defended, visualize the position after the intended move. Do not leave one of your pieces under-defended unless the move gives check or wins something larger.

This is currently an **intervention hypothesis**, not a recommendation whose effectiveness has been established.

The frozen field protocol compares that instruction with a matched sham condition over new rated blitz games.

Until that field test exists:

```text
OBSERVATION       supported
PREDICTION        supported on held-out historical games
PERSONAL RESIDUAL supported, narrowly
INTERVENTION      not yet established
OUTCOME           not established
```

Current research status:

**`FIELD_REQUIRED_FOR_LEVEL_6`**

---

## What Decision Lab does not claim

This repository does **not** currently establish that:

- Decision Lab improves chess performance;
- using it increases Elo;
- R\*\* is the underlying cognitive cause of the owner's mistakes;
- the proposed operation reduces tactical errors;
- every player has a stable personal decision mechanism;
- the mechanism-discovery pipeline already runs automatically as part of the consumer product;
- one player's result generalizes to other players.

These are deliberately separate claims.

Missing evidence is not converted into a softer-sounding conclusion.

---

## Product measurement principle

The core product rule is:

> **The player decides before the machine speaks.**

Confidence, alternatives and other decision evidence only have meaning if they were recorded before engine feedback could change them.

The repository therefore treats measurement contamination as a product defect, not merely a research concern.

The live product and the research layer are related but not interchangeable:

```text
LIVE PRODUCT
records decision evidence
        ↓
longitudinal record

RESEARCH LAYER
tests what structures that record may support
        ↓
bounded claim
        ↓
future experiment
```

Research findings do not silently become product behavior.

---

## Evidence discipline

The repository uses an unusually strict evidence model for a chess application.

Examples include:

- frozen derivation / validation / test windows;
- destructive and shuffled-label controls;
- deliberate positive controls for repository gates;
- population baselines;
- engine-artifact checks;
- within-game contrasts;
- bootstrap stability;
- explicit reversal conditions;
- preserved failed designs rather than rewritten history.

A green test that has never been demonstrated red under the defect it claims to detect is not treated as sufficient evidence of discrimination.

The current build carries **35 repository gates**, each paired with a deliberate positive control.

For the full assurance history and measurements, use the documents below rather than this README.

---

## Repository map

### Product and measurement

| Document | Purpose |
| --- | --- |
| [`docs/MEASUREMENTS.md`](docs/MEASUREMENTS.md) | Measurement results, corpora and methods |
| [`docs/MASTER_PRODUCT_DEBT.md`](docs/MASTER_PRODUCT_DEBT.md) | Current product-debt register |
| [`docs/FINDINGS.md`](docs/FINDINGS.md) | Product findings and retained failures |
| [`docs/INERTIAL_UX_LAWS.md`](docs/INERTIAL_UX_LAWS.md) | Interaction-state laws |
| [`VERCEL_DEPLOYMENT.md`](VERCEL_DEPLOYMENT.md) | Deployment and runtime notes |

### Mechanism research

| Document | Purpose |
| --- | --- |
| [`research/mechanism/README.md`](research/mechanism/README.md) | Map of the mechanism-research package |
| [`research/mechanism/MISSION_LEDGER.md`](research/mechanism/MISSION_LEDGER.md) | Full discovery chain, failed designs and final report |
| [`research/mechanism/NETA_FINDING.json`](research/mechanism/NETA_FINDING.json) | Current evidence-bounded finding |
| [`research/mechanism/FIELD_PROTOCOL_TEMPLATE.md`](research/mechanism/FIELD_PROTOCOL_TEMPLATE.md) | Prospective field-test protocol |

### Research history

The repository also contains earlier research programs that were allowed to fail.

They are retained because a well-measured negative result changes what the system is allowed to build.

Examples include:

- population expertise × decision dynamics;
- measurement validity studies;
- system-invariant / OwnExposure work;
- discovery and attribution experiments;
- learning and transfer research.

Their conclusions should be read from their own reports, not reconstructed from commit history.

---

## Run locally

Requires **Node.js 24.x**.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Full repository verification:

```bash
npm run verify
```

Which runs:

```text
typecheck
→ production build
→ test suite
→ repository gates
→ deliberate gate controls
→ bundle budget
```

Individual commands:

```bash
npm run check
npm test
npm run gates
npm run gates:controls
npm run bundle:budget
```

---

## Technology

The current application is built with:

- React 19
- TypeScript
- Vite
- Stockfish 18 Lite WASM
- chess.js
- TanStack Query
- tRPC
- Drizzle
- Recharts
- Vitest
- Playwright

The project is licensed under **GPL-3.0-or-later**.

---

## Current boundary

The repository has moved beyond:

> “Can we measure something different from ordinary game review?”

It now has evidence that a recurring structure can be discovered, challenged against population behavior, narrowed to a possible personal residual, and converted into a prospective test.

The important unresolved question is now harder:

> **Can that knowledge reliably change future behavior?**

That question belongs to new games, not another pass over the old ones.
