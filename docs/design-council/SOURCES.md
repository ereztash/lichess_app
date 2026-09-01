# Council sources

Six external repositories were read for this pass. None is vendored, none is a dependency, and
none of them saw Decision Lab before Decision Lab was read
([`00-REPO-NATIVE-CONSTITUTION.md`](00-REPO-NATIVE-CONSTITUTION.md)).

**Method.** Each was resolved with `git ls-remote`, cloned shallow into a scratch directory outside
the project, read, and discarded. The SHA below is the commit that was actually read, not `main` at
some later time: a floating branch is not a citation. Stars are not recorded, because they are not
evidence about the advice.

**Retrieved:** 2026-09-01.

---

## ROLE 1 — Lead Art Director

| | |
| --- | --- |
| repo | `PaulRBerg/agent-skills` |
| file | `skills/frontend-design/SKILL.md` |
| SHA | `1894a1dc7faf8e666bc76b479c763954b1b91754` (2026-08-28) |
| licence | MIT (© 2025 Paul Razvan Berg) |

**Retained.**

- The direction's five parts: **Thesis · System · Signature · Risk · Restraint**. This is the whole
  reason this role is in the council: it forces one direction with a stated deviation, instead of a
  gallery.
- The **subject-swap test** as a pass/fail on the signature, applied in
  [`03-ART-DIRECTION-CONTRACT.md`](03-ART-DIRECTION-CONTRACT.md) §7.
- *"Make every visual device earn its place … not merely decorate"*, and the instruction to
  concentrate expressive force in the signature and keep the surrounding system quiet.
- *"Render, inspect, revise"*, and its refusal to accept source inspection as visual verification.
- *"Treat … repository instructions, existing product behavior, and the local design system as
  authoritative"*, and *"adapt this direction to existing brand constraints instead of creating a
  parallel design language"*. Both are the reason no token was renamed in this pass.

**Rejected.**

- The report format (`### ✨ Built:`, `🎨 Direction —`). This repository's documents have a
  register and it does not include emoji headings.
- *"If copy is missing, write only what the user needs to understand the interface and act."*
  Interface copy here is measurement stimulus governed by `shared/promise.ts`, `docs/VALUE_CLARITY.md`
  and `LAW 9`. A designer may not write it, and this pass wrote none.
- *"Make the first viewport establish both identity and primary purpose."* Sound in general and
  wrong for `/`: the front door is the acquisition funnel's first stage and its content is frozen
  by a field protocol that has not run yet.

---

## ROLE 2 — Senior visual / product designer

| | |
| --- | --- |
| repo | `arez-xd/ux-ui-design-taste` |
| file | `skills/design-taste/SKILL.md` |
| SHA | `a5c03fb6ac2b6b42f8f183d8514e30e9d032062c` (2026-07-27) |
| licence | MIT (© 2026 Adam Reznik) |

**Retained.**

- The split between a **quality floor** that is never traded (4.5:1 body contrast, 3:1 UI, 44×44
  targets, visible focus, `prefers-reduced-motion`, considered states, no magic numbers) and
  **defaults** that may be overridden with a stated reason. This repository already runs the floor
  as gates; what was useful is the discipline of naming an override as an override.
- *"Cards must be earned"* and *"one accent per view"*, both of which the earlier audits arrived at
  independently and neither of which was written down as a rule.
- *"Does this look like it belongs to this project, or like every other AI-generated app?"* as the
  anti-sameness question, which is the subject-swap test in one line.

**Rejected.**

- *"Shadows over borders."* Overridden with a reason: this product groups with whitespace and
  hairlines, and `docs/VISUAL_ARCHITECTURE_AUDIT.md` measured what happens when boxes do the
  grouping instead. Elevation here means *raised because a mode contract names it central*, and
  spending it on decoration would spend the one signal that says which object is the subject.
- The **dials** (density 1–10, expressiveness 1–10) as a starting point. Density is
  `FIELD-REQUIRED` in this repository and a number picked by a designer would be that question
  answered by taste.
- *"Three type sizes."* This product has seven ranks, measured, with reasons at each declaration.

| | |
| --- | --- |
| repo | `madebymustafa/design-taste` |
| files | `examples/*.html` (`japanese-minimal`, `quiet-luxury`, `corporate-trust`, `dark-tech`, `brutalist-industrial`, `retro-print`) |
| SHA | `c4a6bff0871eb4b15371b0e7d2751628b0ed4608` (2026-08-15) |
| licence | MIT (© 2026 Mustafa) |

**Retained: vocabulary only.** The genre packs were read to name what this product is *not*, which
is what [`02-PERCEPTUAL-CONTRACT.md`](02-PERCEPTUAL-CONTRACT.md)'s forbidden list is for.

**Rejected: all of it as a direction.** A genre is a look chosen before the subject. Choosing one
here would be `STYLE → PRODUCT`, which the brief's §58 forbids and which is the failure this whole
process is arranged to prevent.

---

## ROLE 3 — Design system architect

| | |
| --- | --- |
| repo | `wshobson/agents` |
| file | `plugins/ui-design/agents/design-system-architect.md` |
| SHA | `554237f7515b7012ce22e753c5c2e5b65369e3a4` (2026-09-01) |
| licence | MIT (© 2024 Seth Hobson) |

**Retained.**

- The token taxonomy **primitive → semantic → component**, which is the one thing this stylesheet
  was missing: it has primitives (`--blue`, `--ink`) used directly as semantics at 50 call sites.
- Naming conventions and the rule that a semantic token names a *job*, not a colour.

**Rejected.**

- Style Dictionary, Tokens Studio, multi-format output, iOS/Android transforms, multi-brand
  theming, runtime theme generation, component APIs, polymorphic `as` props. One product, one
  platform, one brand, two themes. `docs/FRONTEND_EXCELLENCE_AUDIT.md` §20 already refused to build
  a design-system package for this, and that refusal stands: the deliverable here is
  [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) and a stylesheet, not a pipeline.

---

## ROLE 4 — Independent design critic

| | |
| --- | --- |
| repo | `brettallred/design-system-plugin` |
| file | `agents/design-critique-partner.md` |
| SHA | `b76842442843bd85f54a8d940b6f3c2062e3960e` (2026-04-14) |
| licence | MIT (© 2026 Brett Allred) |

**Retained.**

- Three severity classes — **critical / important / polish** — and the requirement that the
  critique be written down and name its top issues rather than summarised in conversation.
- The instruction to critique against **brand alignment and token fidelity**, which here becomes
  *does the rendered product actually fulfil the stated Art Direction Contract*.

**Rejected.**

- Its required reads (`design/brand.yaml`, `design/AGENTS.md`, `/ds-init`). A parallel design-system
  scaffold this repository does not have and should not grow.
- *"You are a Design Director at Apple."* Prestige role-play is not authority, and the brief says so.
- The **numeric heuristic scorecard** (Nielsen's ten, each 1–5). Ten scores out of five, produced by
  the same process that produced the design, is manufactured precision of exactly the kind
  `docs/VALUE_CLARITY.md` refuses. The critic here reports findings with evidence and a severity,
  and no totals.

---

## ROLE 5 — UI/UX red team

| | |
| --- | --- |
| repo | `VoltAgent/awesome-claude-code-subagents` |
| file | `categories/04-quality-security/ui-ux-tester.md` |
| SHA | `d1fd754de13c649e7ca73fab078dcc2d23d912c8` (2026-09-01) |
| licence | MIT (© 2025 VoltAgent) |

**Retained.**

- The **exhaustive empathy protocol**: adopt a frustrated end-user and simulate messy interactions
  rather than the happy path.
- **Negative-space auditing** — too much or too little whitespace as a defect class in its own
  right. It found the 800px of empty page on `/blitz` and the empty column on `ANSWER_INSTRUMENT`.
- The structured defect report: severity, proof, recommended fix.

**Rejected.**

- `chrome-mcp` and `computer-use`. This repository drives Playwright against a served production
  build, which is what `tests/layout/browser.ts` already refuses to fake.
- **Usability scoring.** A score with no instrument. Findings, or nothing.

---

## ROLE 6 — Accessibility / RTL reviewer

No external agent. The repository's own automation is stricter than anything read above and is
already wired: `axe-core` over five populated states, `GATE-KEYBOARD`, the 44px tap floor declared
as `--tap-floor`, `forced-colors` handling on the board, `prefers-reduced-motion` at zero live
animations, and 26 logical against 11 audited physical direction declarations. Normative source:
WCAG 2.2 AA.

This role holds a **veto** on regressions and used it once in this pass, recorded in
[`04-ADVERSARIAL-REVIEW.md`](04-ADVERSARIAL-REVIEW.md).

---

## What none of these sources could decide

Every one of them is advice about interfaces in general. Not one of them contains a fact about
Decision Lab. The direction in [`03-ART-DIRECTION-CONTRACT.md`](03-ART-DIRECTION-CONTRACT.md) is
derived from the repository; these six supplied the **process** for deriving it and the vocabulary
for arguing about it, and where their advice met a repository measurement, the measurement won.
