# Art Direction Experiment — owner calibration before field

This is an **aesthetic experiment, not a UX redesign**.

The technical frontend reached its pre-field boundary on `main` after #57. The remaining question
is not whether the player can act, whether the board fits, or whether the hierarchy is measurable.
It is whether the product has a visual character the owner is willing to stand behind — and which
character is worth carrying into field validation.

## The experimental variable

Exactly four conditions exist:

| query | condition | role |
| --- | --- | --- |
| `?art=0` | current product | control |
| `?art=1` | candidate 1 | treatment |
| `?art=2` | candidate 2 | treatment |
| `?art=3` | candidate 3 | treatment |

The numeric codes are deliberate. **Rate the numbered conditions before reading the named mapping
below.** The experiment should ask the owner what the product feels like, not ask whether a label
sounds attractive.

The CSS test forbids the experiment from changing layout or typography metrics. No condition may
set width, height, margin, padding, gap, grid, flex, order, font size, font family, line height,
letter spacing, position or transform. The same DOM, copy, flow, measurement protocol and
interaction contracts render in all four conditions.

Only these art-direction channels may move:

- semantic colour roles;
- page/surface material character;
- edge and shadow character;
- grain intensity;
- control/surface corner character;
- chessboard material palette.

## Research constitution for this experiment

The decision uses multiple evidence classes and does not confuse them.

- **EMP** — empirical HCI/aesthetics gives priors: visual complexity, prototypicality, structure,
  craftsmanship and colourfulness affect first impression, but do not determine a universal best
  palette.
- **CULT** — Hebrew/RTL evidence makes density and grouping important constraints, but does not
  select a preferred art direction.
- **SYS** — mature systems are calibration, never authority.
- **PRODUCT** — Decision Lab's existing interaction hierarchy and evidence boundaries are hard
  constraints.
- **OWNER** — product identity and aesthetic acceptance are legitimately decided here.
- **FIELD** — whether target players share the preference is explicitly deferred until the owner
  has reduced the space to two finalists.

## Preregistered emotional target — hypothesis, not owner approval

The current research prior describes a plausible Decision Lab identity as:

### Desired

1. calm
2. precise
3. crafted
4. chess-first
5. evidence-conscious

### Forbidden

1. generic-AI
2. casino-like
3. dashboard-chaotic
4. clinical-hostile
5. prototype-like

These ten words are **a hypothesis to test against the owner**, not the brand contract. If the
owner rejects them, the next iteration starts from the rejected words rather than from colour
preferences.

## Do not read until after the first rating

<details>
<summary>Named mapping of the three candidates</summary>

### Candidate 1 — Precision Editorial Instrument

Closest to the product's existing DNA, but quieter and more deliberate. Warm-neutral paper,
restrained deep teal, tighter corners, lower grain and a restrained shadow.

Predicted Kansei profile: very calm, very precise, mature, moderate warmth, high craftsmanship,
moderate distinctiveness.

### Candidate 2 — Contemporary Analytical Lab

Cooler, crisper and deliberately digital. Neutral blue-grey ground, sharper corners, almost no
grain, cool chessboard and lower-material surfaces.

Predicted Kansei profile: precise, modern, technical, less warm, low ornament, high visual
certainty.

### Candidate 3 — Chess Editorial

Warmest and most tactile. Parchment ground, classic chessboard family, stronger material grain,
warmer edges and rounder surfaces.

Predicted Kansei profile: chess-first, distinctive, warm, editorial, less clinical, potentially
less 'laboratory precise' than 1/2.

</details>

## Accessibility preflight — token pairs only

Calculated contrast ratios for the primary text/action pairs before browser validation:

| candidate | ink / surface | muted / surface | white / action blue | chosen / surface |
| --- | ---: | ---: | ---: | ---: |
| 1 | 15.23 | 5.96 | 8.11 | 5.49 |
| 2 | 15.62 | 5.93 | 7.12 | 5.54 |
| 3 | 15.85 | 6.45 | 7.93 | 5.12 |

This is only a **preflight**. It does not replace built-browser axe, forced-colours, focus or board
legibility checks. A candidate that fails an accessibility hard gate is ineligible regardless of
owner preference.

# Owner protocol

## Conditions

Use one device, one browser, one zoom level and the same theme for the first comparison. Start with
light theme so theme preference is not mixed into art-direction preference.

Suggested desktop viewport: approximately 1440×900. A later mobile comparison is allowed only
after the desktop first impression has been recorded.

## Blind order

Open in this order:

```text
2 → 0 → 3 → 1
```

Do not read the candidate names before the first rating.

For each condition inspect the same states:

1. `ARRIVE` — front door
2. `DECIDE` — board + commitment
3. `REVEAL` — result after one committed decision
4. `REFLECT` — `/` with a populated record

Do not spend time diagnosing CSS. The owner's job is to report perception.

## Kansei / semantic-differential rating

Score each item 1–7 for each condition.

| dimension | 1 | 7 |
| --- | --- | --- |
| Precision | vague | precise |
| Calmness | noisy | calm |
| Maturity | childish | mature |
| Humanity | clinical/hostile | human/welcoming |
| Craftsmanship | generic | deliberately crafted |
| Character | anonymous | distinctive |
| Seriousness | gamey | serious |
| Warmth | cold | warm |
| Trust | untrustworthy | trustworthy |
| Simplicity | chaotic | ordered |
| Colorfulness | dead/flat | intentionally coloured |
| Product fit | not Decision Lab | exactly Decision Lab |

Then answer one separate hard-gate question:

> **Would I be comfortable showing this publicly as my product?** 1–7

Do not average that question into the others. It is the owner gate.

## Free recall

After each condition, without looking back, write exactly three words answering:

> What did this product feel like?

This is more diagnostic than asking 'which colour did you like'.

## Forced choice

After all four:

- best overall;
- second best;
- worst overall;
- one thing the winner gains over baseline;
- one thing the winner loses versus baseline.

## Analysis rule

Do **not** manufacture a single Art Direction Score.

Inspect the vector of ratings. A condition dominates another only if it is at least as good on the
owner-critical dimensions and materially better on one or more without failing a hard gate.

If two directions remain defensible, that is success: those two move to FIELD rather than being
resolved by more desk research.

# Hard gates

A candidate is ineligible if it:

- creates a new WCAG failure;
- weakens visible focus;
- makes black/white pieces or board squares ambiguous;
- collapses selected vs correct vs engine/chosen semantics;
- changes the measurement stimulus beyond art direction;
- changes layout, information density, task order or wording;
- visually gives an unsupported claim more authority than the evidence supports.

# What the first round may establish

It may establish:

- which emotional territory the owner wants;
- which current aesthetic complaints are actually palette/material/character complaints;
- whether the current warm editorial DNA is an asset or a liability;
- which two directions deserve field validation.

It may **not** establish:

- what all players prefer;
- that a preferred direction improves usability;
- that a more trusted-looking design is more epistemically valid;
- that a culturally general aesthetic exists.

# Stop rule

The owner round is complete when either:

1. one direction is clearly preferred and passes every hard gate; or
2. two directions remain genuinely defensible.

In case 1, implement/refine only the winning territory.

In case 2, **STOP owner-side optimisation** and take the two finalists to target players.

Do not create candidates 4–12 merely because more visual possibilities exist.
