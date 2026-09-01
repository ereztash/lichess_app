# Final report

## BASE

```
BASE_SHA  b9a228c979d7b2ff9e3c75875e18dc100bbf00ca
HEAD_SHA  0cbb46a  (six commits; the branch tip may carry one more that records this run)
BRANCH    claude/decision-lab-visual-identity-s1t3ng
```

---

## 1. The product thesis, established before any external designer read anything

Reconstructed from the repository in
[`00-REPO-NATIVE-CONSTITUTION.md`](00-REPO-NATIVE-CONSTITUTION.md), and **falsified four ways
before it was accepted**:

```
POSITION → HUMAN DECISION → COMMITMENT
══════════ EVIDENCE BOUNDARY ══════════
MACHINE REVEAL → OBSERVATION → WHAT THIS CAN AND CANNOT SUPPORT
```

It survives. It is not an interpretation laid over the repository: it is the repository's own
stated rule, enforced three independent ways — a state machine in which the engine may run at
exactly one stage, a type that makes a commitment event carrying an evaluation unbuildable, and a
dynamic import that keeps the engine out of the initial module graph so it cannot appear in the
network tab before a decision is recorded — and tested by **ablation** at the Reveal.

**One correction the falsification forced.** The brief calls the sequence *"the product's deepest
visual identity"*. That is a claim about a person's perception and the repository cannot support
it. What it supports is narrower and enough: the boundary is the product's deepest **structural**
fact. Whether making it perceptible changes what a player understands is `FIELD-REQUIRED`, and
`VALUE_CLARITY_FIELD_PROTOCOL` Arm B is already the instrument.

**And "before the machine speaks" was not invented by this pass.** It is the front door's `h1`,
measured in Chromium: *"מה קרה בהחלטה, לפני שהמנוע דיבר"*.

---

## 2. The design council

| role | source | SHA | licence | retained | rejected |
| --- | --- | --- | --- | --- | --- |
| Lead Art Director | `PaulRBerg/agent-skills` `skills/frontend-design/SKILL.md` | `1894a1d` | MIT | Thesis · System · Signature · Risk; the subject-swap test; "every device earns its place"; render-inspect-revise | the emoji report format; writing interface copy; "the first viewport establishes identity" on an acquisition surface |
| Senior visual designer | `arez-xd/ux-ui-design-taste` | `a5c03fb` | MIT | the quality floor / defaults split; "cards must be earned"; "one accent per view" | shadows-over-borders (overridden with a reason); the density dials; "three type sizes" |
| Genre vocabulary | `madebymustafa/design-taste` | `c4a6bff` | MIT | vocabulary for the forbidden list only | every genre as a direction |
| Design system architect | `wshobson/agents` `plugins/ui-design/agents/design-system-architect.md` | `554237f` | MIT | primitive → semantic → component | Style Dictionary, multi-brand, multi-platform, a token pipeline |
| Independent critic | `brettallred/design-system-plugin` `agents/design-critique-partner.md` | `b768424` | MIT | severity classes; a written critique that names its top issues; "does the render fulfil the contract" | its `design/` scaffold; "Design Director at Apple"; the ten-heuristic 1–5 scorecard |
| UI/UX red team | `VoltAgent/awesome-claude-code-subagents` `ui-ux-tester.md` | `d1fd754` | MIT | the frustrated-user protocol; negative-space auditing; structured defect reports | chrome-mcp / computer-use; usability scoring |
| Accessibility / RTL | the repository's own automation | — | — | axe over five populated states, `GATE-KEYBOARD`, `--tap-floor`, forced colours, reduced motion, logical properties | — |

Full record, with what each said and what was refused:
[`SOURCES.md`](SOURCES.md).

---

## 3. Art direction

**THESIS.** The page is the notebook the player writes in. The machine's evidence arrives on a
plane of its own, only after the entry is closed, and it is never something you can press.

**SIGNATURE.** *Two hands on one page.* Everything the player recorded is on the page — its ink,
its surfaces, the board's own wood for a mark on the board. Everything the engine returned arrives
on **one recessed cool plane** that holds nothing the player made, and on it the engine's readings
are in the engine's own colour. Where the engine has not spoken, the plane is not on the page.

**SYSTEM.** A semantic layer over the primitives that already existed; a monotonic surface ladder;
two radii and two shapes; a measure; two icon ranks; three action roles; one focus indicator that
works on every ground. Full reference: [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md).

**RISK.** The primary action is the page's own ink, filled, not a reserved hue — because the hue
the product had reserved was the engine's. Its measured cost is a heavier primary control (9,989 →
11,085 squint mass on `REVEAL`) and a component that is, on its own, the canonical neutral product
button of the last decade.

**RESTRAINT.** No success colour. No positive counterpart to `--warn`. No visual difference between
a Reveal that found something and one that did not. No celebration at the boundary. No new font, no
new dependency, no motion. No change to measurement wording, question order, control position,
sampling, thresholds, eligibility, scoring or schema. No design-system package. `EXPLORE` is not
flattened.

Frozen, after one round of critique and one revision:
[`03-ART-DIRECTION-CONTRACT.md`](03-ART-DIRECTION-CONTRACT.md).

---

## 4. Product-specific evidence, and what each one forbade

| source | what it forbade this pass from doing |
| --- | --- |
| **Value Clarity**, five lenses, `REPO-CLEAR / FIELD REQUIRED` | tuning anything to make the product *wanted*. *"A product that is fully understood and still unwanted is a valid result, and it is the result this build exists to be able to observe."* Nothing here is copy, and no surface was made more persuasive |
| **Field protocol**, three arms | annotating the boundary. Arm B asks a cold player what they got, with no branch named; a label reading "this is the part an engine could not give you" is that interview question pre-answered. The interface makes the distinction perceptible and does not explain it |
| **Acquisition evidence** §4 | drawing a Reveal as an achievement. `unique_value_delivered`, `user_understood` and `insight_found` do not exist as fields on purpose, and a rendered state is the same kind of object as a ledger row |
| **R-B2**, the time result | a clock as a metaphor. 4,459 eligible decisions, held-out spread 8.27pp against a 4.35pp null, raw seconds 0.00pp — **and most of it collapses within `phase × standing`**. Elapsed time is context and metadata, never the mechanism, and the product may not look like a think-time coach |
| **Engine parity** | any treatment that makes an evaluation look like a fact of the position. Two engines disagreed on **13.61%** of decisions and the shipped one flatters the player by 4.4 points; the number is only readable beside the instrument that produced it. The evaluation reading now carries `Stockfish 18 · local · depth 14` where it can be read |
| **D25**, `CONSTRUCT-UNDERIDENTIFIED` | giving a hypothesis the weight of a finding. One declared grade→weight ladder now exists, and `tested` left the engine's hue because a grade is a property of the player's record |

---

## 5. Before / after

All measured in Chromium on the production build at 1440×900 unless stated.

### Identity

| | before | after |
| --- | --- | --- |
| jobs carried by one hue | **9** (engine's arrow, player's selected square, primary action, selection, focus, progress, links, evidence authority, brand) | **1** (the engine) |
| the engine's colour on `DECIDE` / `ANSWER_INSTRUMENT` | present | **0 px** |
| the machine's plane | did not exist | 3 surfaces, absent wherever the engine has not spoken |
| `/blitz` | no header, no brand, no way back; heaviest painted object **352** | the product's shell, its lockup, its way home |
| `/blitz` reachable on a first visit | **no path at all** | one secondary route on the front door |

### Hierarchy

| on `REVEAL` | before | after |
| --- | ---: | ---: |
| `.reveal-one-thing`, the contract's central object | 1,757 | **8,131** |
| `.evaluation-track`, the machine's largest object | 9,100 | **5,698** |
| the machine's biggest object as a multiple of the central one | **5.2×** | **0.70×** |
| `.primary-control` | 9,989 | 11,085 |

The squint-mass probe reads `background-color` only. It cannot see the engine's SVG arrow, and the
table is therefore a statement about painted grounds. Named here rather than left to be discovered.

### Density

| | before | after |
| --- | ---: | ---: |
| text runs, `DECIDE` / `REVEAL` / `EXPLORE` / `REFLECT` | 87 / 111 / 239 / 135 | 87 / 111 / 239 / 135 |
| `REFLECT` document height | 3,260 px | **3,433 px (+5.3%)** |

**Nothing was hidden and nothing moved behind a disclosure.** `REFLECT` grew because prose with a
measure takes more lines. The design system said "density: unchanged"; that was true of the counts
and false of the page, and it now says so.

### Typography

| | before | after |
| --- | --- | --- |
| characters per line, worst measured | **123** (`.value-provenance`, 11px) | **77** |
| `.context-loop`, first in reading order on `DECIDE` | 116 characters on one line, 1,392px | 58, on two |
| Hebrew in the mono stack | painted by **Liberation Serif**; `בחרו מהלך על הלוח` rendered in two faces inside one string | Noto Sans Hebrew, with DM Mono still carrying the Latin |
| type ranks | seven | seven, unchanged |

### Colour

| | before | after |
| --- | --- | --- |
| `--warn` jobs | 4: a failure, an unfinished field, an unfinished commitment, **a valid storage mode** | **1**: a failure |
| saturated colour on a cold `DECIDE` | `--warn`, on the control nothing had failed on | **none** |
| `--blue` call sites | 50, across nine jobs | the engine's marks and surfaces |
| evidence grade → weight | undeclared; `tested` in the engine's hue | one ladder, value then weight, written down |
| "not measurable" and "not kept" | drawn in the failure hue | `--muted` / `--edge` |

### Surfaces

| | before | after |
| --- | --- | --- |
| the ladder | canvas 0.778 → **raise 0.818** → surface 0.898 (inverted) | canvas 0.778 → surface 0.898 → raised 0.964 |
| ΔL a raised object travels | **0.040** | **0.186** |
| corner radii | 6 (6, 8, 9, 10, 12, 14) | **2**, plus a pill and a circle |
| secondary control edges | 6 values, five of them **under 3:1** on `--surface` | 1, measured **3.84:1** on a card and **3.35:1** on the page |

### Board integration

| | before | after |
| --- | --- | --- |
| the player's selected square | the **engine's** hue | the board's own wood, bounded |
| legal-move dots | one colour for both grounds: 5.22:1 on light, **1.06:1 on dark** | two grounds; `--chosen` on light, piece cream on dark |
| every ring on the board | a hue alone; `--chosen` measures **1.00:1** on a light square in the dark theme | a hue plus a 2px bounding ring in the value the square is not |
| the engine's arrow | **1.08:1** against a light square in the dark theme | a two-tone outline; visible on both grounds in both themes |

### Human / machine boundary

Given ten screenshots and nothing else — no contract, no stylesheet, no brief — an independent
critic wrote:

> *"Everything is warm cream/brown except two elements — the 'פרטי הניתוח' disclosure bar and the
> eval-bar rail on REVEAL/EXPLORE, both cold blue-gray. They match each other and nothing else."*

They filed it under **inconsistencies**, which is the correct reading of an unexplained difference,
and which is exactly why the remaining question is a field question and not this document's.

### Motion

Unchanged. Zero live animations under `prefers-reduced-motion`, before and after.

### Hebrew / RTL

| | before | after |
| --- | --- | --- |
| the 7-point confidence scale | `dir="ltr"` on `/play`, RTL on `/blitz` — **the same instrument running in opposite directions** | one direction, the document's |
| Hebrew in mono classes | Liberation Serif fallback | the product's own face |
| brand lockup vs header controls at 390px | **20px of overlap** | 130px of clearance |
| logical properties | 26 logical / 11 audited physical | **0 physical outside the board**; direction derived from `shared/interface-language.ts` |
| the commitment panel on a Hebrew page | `x=24..354` at 1440×900 — the far left, where a Hebrew reader arrives last | track 1, the reading start, with the DOM order moved to match |

### Accessibility

| | before | after |
| --- | --- | --- |
| axe, `/`, `/play`, `/blitz`, `REVEAL`, `REFLECT` | 0 violations | **0 violations** |
| the loop strip under `forced-colors` | all four ticks white on white; **the current step had no indicator** | `GrayText` / `Highlight` |
| `<summary>` focus ring | the browser's 1px default, which this stylesheet calls "nearly invisible on this palette" | the product's ring |
| focus on a dark board square | a single ink ring at 2.34:1 | ring plus halo, **5.56:1** |
| control boundaries | five of six under 3:1 | one edge, 3.35–4.99:1 in both themes |
| horizontal overflow at 4 viewports and a 32px root | none | none |
| screen reader | **not run** | **not run** |

### Craftsmanship

Six radii → two. Five icon sizes → two. Six control edges → one. Eleven action looks → three roles.
Nine hue jobs → one. Four `--warn` jobs → one. And an evaluation number that was rotated inside a
16px track, clipped on both sides, is now a horizontal reading with its instrument beside it.

---

## 6. Falsification — what was done to prove this wrong

| attempt | expected | result |
| --- | --- | --- |
| **Pre-implementation critique**, on the direction before a line changed | that the direction was sound | **four blockers**, all true. The frozen contract is not the proposed one |
| **Blind critique**, ten screenshots, no context | that the identity would not read | it named the product correctly, and found the signature unprompted — and produced 17 defects, three of which were fixed and the rest recorded |
| **Red team**, driving the built app at four viewports to prove the redesign harmed the product | a P0 | **no P0**, and 21 findings including one this pass had itself caused (`RT-6`: the not-ready control became the quietest thing in its own panel) |
| **Informed critique**, contract against render | that the render fulfils the contract | **four blockers**, all true, including one where the gate contradicted itself |
| **Positive controls** | that the new gate is a gate | `GATE-TWO-HANDS` reddens twice on a fixture in the shape the shipped stylesheet was in. All 28 controls red |
| **Revert / restore** on the pre-commit assertion | that the new `--warn` rule can fail | reverting `.required-mark` to `--warn` → RED; restoring → GREEN |
| **Base rebuild** for the performance delta | that the numbers are comparable | `BASE_SHA` was checked out, rebuilt and measured with the same probe |

**Two things the pass got wrong and had to correct.** It blamed the measure's unit for a layout
shift and changed it twice before frame-sampling showed the cause was content arriving. And it
removed the alarm colour from the pre-commit control and replaced it with too little, which a red
team measured before anyone could feel it.

---

## 7. Measurement integrity

**`CURRENT_PROTOCOL_VERSION` 3 → 4.** Eleven classes that paint on `DECIDE` or `ANSWER_INSTRUMENT`
and are part of the instrument changed appearance — the submit in both states, the summary, the
required marks, the selected read chip, the confidence row's edge **and its direction**, the open
step's index, the commitment field's ground, the context ribbon's measure, the storage notice, the
board's own marks, and the focus ring. That is exactly the list `measurement-protocol.ts`'s own
2 → 3 note says would force a bump.

The one that settles it alone: before this change the only saturated colour on a cold `DECIDE` was
the failure hue, on a control nothing had failed on. A decision taken in front of that screen and
one taken in front of a screen with no evaluative colour are two measurements, and nothing in the
row tells them apart. Decision time is measured **to the commit**.

**What did not change:** commitment requirements, confidence collection and sampling, the candidate
list, the counterfactual probe and its rate, reveal timing, engine timing, thresholds, eligibility,
scoring, the schema, the interpretation policy, every word of measurement wording, the order the
questions are asked in, and the position of every control. `LAW 9`'s three friction points are
untouched. `deriveInteractionMode`, `MODE_CONTRACT`, `makingEvidence`, `engineMayRun` and
`next-action.ts` were not edited.

**One acquisition-surface change, disclosed rather than covered.** The front door gained a third,
secondary route: a short game. `/blitz` had no door on a first visit at all. It carries no
`data-primary-action`, so `LAW 2` and `GATE-ONE-PRIMARY-ACTION` still see one act on that screen.
It is a change to a measured funnel and it is named here.

---

## 8. Performance

Lab, in Chromium against a static server, three runs each. **Not field Core Web Vitals.**

| | `BASE_SHA` | after |
| --- | ---: | ---: |
| entry JS, raw | 686,057 B | 686,554 B (+497) |
| CSS, raw | 84,939 B | 89,159 B (+4,220) |
| initial download, raw | 753.9 kB | **757.5 kB / 761 kB budget** |
| `/` lab LCP / FCP | 188–304 ms | 192–316 ms |
| `/play` lab LCP / FCP | 316–356 ms | 312–416 ms |
| `/` CLS | 0.0000–0.0002 | 0.0001 |
| `/play` CLS | **0.0023** | **0.0143** |

**The CLS on `/play` is a regression this pass caused, and it is reported rather than rounded
away.** Frame-sampled: the context ribbon renders with one child at 236 ms and with three at 292 ms
— `.context-loop-basis` and `.context-why` arrive with the record's reading — and it is a wrapping
row, so it gets *shorter* as it fills. The board moves 23 px. Giving that band a measure is what
made a text change able to alter a line count; before it, a 1,392 px band was one line whatever it
said. `.context-loop` itself is now reserved and stable in every frame; the band's remaining
transient would cost 23 permanent pixels above a board whose last rank is already near the fold,
and that was not paid. 0.0143 is within the repository's own budget and 7× under the 0.1 that
counts as good, and it is worse than it was.

One font is now preloaded (12 kB, the 400-weight Hebrew subset). It does not appear in the bundle
budget, which counts the entry chunk and its stylesheet; it is named here so the cost is on the
record.

---

## 9. Remaining uncertainty

### OWNER-REQUIRED

1. **Is the palette liked?** Hues moved this time — `--raise`, `--edge`, `--surface-machine` — so
   unlike the previous pass there *is* a before and after to compare.
2. **Is the primary action in the page's own ink right**, or is a near-black filled button too
   much like every other product's?
3. **Is the machine's plane the right amount of difference** — too subtle at 1.09:1, or already
   too much?
4. **The chart palette is 1.6° of hue from the machine's** (`#0077aa` against `#1e5b72`), on the
   same scroll, on the player's own data. Its ΔE validation is not overturned by a hue angle, and
   re-picking it is its own measured pass. This is the strongest open objection to the signature.
5. **Should the front door carry the brand?** Unchanged from `VISUAL_ARCHITECTURE_AUDIT` §10.1.
6. **The three "selected" idioms** that remain, and the front door's `--chip` collision between a
   disabled primary, a selected chip and the input well.

### FIELD-REQUIRED

1. **Does the human/machine boundary become understandable?** A blind critic found it perceptible
   and read it as an inconsistency. Perceptible is not understood. Arm B.
2. **Is there too much on these screens?** This pass measured the *measure*, not the quantity.
3. **Does silence feel legitimate?**
4. **Which of the three routes does a cold arrival take?** The ledger already records it.
5. **Do the internal state labels (`DECIDE`, `REVEAL`) help or intrude?**
6. **Screen readers.** None was run, and no claim is made. Round two made this matter more: the
   phone is now the one place the DOM order and the visual order differ, and the argument that both
   carry the same meaning is reasoned rather than heard.
7. **Does the decision panel read as an instrument rather than as a form?** Round two changed the
   surface it was asked to change. Whether the reading changed is not something the person who made
   the change can answer.

---

## 10. Definition of done

```
REPO-SOLVABLE P0/P1:    0
BROWSER-SOLVABLE P0/P1: 0
OWNER-REQUIRED:         6
FIELD-REQUIRED:         7

TECHNICAL FRONTEND DOD:   PASS
ART DIRECTION SYSTEM DOD: PASS
EPISTEMIC VISUAL DOD:     PASS
INDEPENDENT CRITIC DOD:   PASS
RED TEAM DOD:             PASS

OWNER VISUAL ACCEPTANCE:  PENDING
FIELD VALIDATION:         PENDING
```

**What each row rests on.**

- **Technical:** `npm run verify`, run to completion on the tip — typecheck, build, **2,911 tests
  passed / 26 skipped across 262 files**, **28 gates green**, **28 positive controls red**, bundle
  within budget (initial download 758.3 kB against a 761 kB ceiling). axe: 0 violations on five populated states. No
  horizontal overflow at four viewports or a 32px root. Zero live animations under reduced motion.
- **Art direction system:** one thesis, one signature, one system, a stated risk, a stated
  restraint; the subject-swap test passes **by one row, and the table says so**.
- **Epistemic:** visual authority does not exceed evidence — silence keeps its rank on the one
  raised surface; "not measurable" and "not kept" left the failure hue; the grade ladder is
  declared; no success colour exists; no Reveal branch is drawn as better than another.
- **Critic:** four blockers from the pre-implementation pass and four from the informed pass, all
  resolved or disclosed. No unresolved P0/P1.
- **Red team:** no P0 found; every P1 fixed, or recorded with the constraint that prevents it
  (`RT-2`'s seven columns against a 44px tap floor in a 291px panel; `RT-4`/`RT-5`'s stacked-width
  layout, which is a second pass).

**The two PENDING rows are not formalities and cannot be moved from here.** `docs/VISUAL_ARCHITECTURE_AUDIT.md`
§11 withdrew a previous pass's PASS for exactly this: the owner gate *"was not failed — it was
absent"*, and four green rows plus one that cannot be self-assessed added up to a pass. It is named
here, and it is open.

---

## 11. The one question for the owner

Open the built app at `ARRIVE`, `DECIDE` and `REVEAL` **before reading any of these documents** —
reading them first contaminates the answer, which is the whole value of it.

> **Would you be comfortable and proud for this version to represent Decision Lab publicly?**

And optionally:

> **Does any screen still immediately feel ugly, generic, visually wrong, or unnecessarily busy?**

If the answer is yes to the second, that reaction is **new evidence** and the next investigation is
derived from it. It is not something to argue with.

---

## 12. Stop condition

Further visual research-driven development is done, and that is narrower than "the work is done".
Every remaining item in [`04-ADVERSARIAL-REVIEW.md`](04-ADVERSARIAL-REVIEW.md) is `OWNER`, `FIELD`,
`PRODUCT` (copy and derivation, not art direction), or a layout pass with a named constraint. No
further design repository, palette or reference would shorten either list.

What remains is one person looking, and some players using it.

---

## 13. The owner looked — round two

§11 asked one question and said that an "it still feels wrong" answer would be **new evidence** and
would not be argued with. It was answered, from a screenshot of `DECIDE`, in three parts. Recorded
here in the order they arrived.

### 13.1 What was said, and what it was not allowed to mean

> *"אני חושב שזה צריך להראות קצת יותר משקף אסטרטגיה."*

Four readings fit that sentence and they lead to four different products: more strategic
**information** on the screen; a **surface** that reads like an instrument rather than a form; more
visual **weight** on the board; or a claim that the product **is** a strategy tool, which it is not
and may not say. Two of the four would have changed what a player is looking at while a decision is
being measured, which is a protocol change dressed as taste. The reading was not guessed. The owner
was asked and chose:

> **"המשטח, לא התוכן"** — the surface, not the content. No new information, no measurement change.

That answer is the whole licence for §13.3, and the reason it stops where it does.

### 13.2 Direction, and the side the writing surface is on

> *"RTL דורש גם להצמיד לימין מסכי כתיבה… אם זה באנגלית זה צריך להיות מצד שמאל, אנחנו צריכים לאפשר
> מעבר בין השפות."*

Two things, one of which is a defect and one of which is a request.

**The defect.** `.workbench` declared `[rail] [board] [task]`. Track 1 is the right edge of a
right-to-left page, so the panel a player writes into rendered at `x=24..354` — the far left, the
place a Hebrew reader reaches last — with the board holding the reading start. Nothing in this
pass's own measurements caught it, because every measurement it made was of contrast, size, order
and displacement, and none of them asks *which end of the line does this language start at*. The
fix is the track order and, with it, the DOM order in `Home.tsx`, so the tab sequence is the
sequence the eye takes.

**The request**, scoped by the owner to **"חוק פריסה בלבד, עכשיו"** — the layout rule only, now:

- `shared/interface-language.ts` is the single source of the pair. `App.tsx` writes it onto the
  document; `client/index.html` ships the same pair statically so the first paint is not the wrong
  way round; `tests/client/one-direction-one-language.test.ts` holds the three in agreement.
- Every physical side in `client/src/index.css` became logical. Fourteen declarations. Two remain,
  both on the board, because a1 is bottom-left for White in every language.
- **No translation.** 931 Hebrew strings across 115 files, and on the two measured screens the copy
  *is* the stimulus, so translating is a protocol change and not a formatting one. The module's own
  comment says this at the declaration rather than in a document nobody opens.

### 13.3 The surface, not the content

Two changes, both of the surface, and the count is the point: this is the whole of what
"המשטח, לא התוכן" buys.

**The first is the step mark.** `.step-index` was a filled circle with a numeral in it, which is
the most recognisable form component in existence; four of them down the side of a panel say
*fill this in*. The panel's contract is that it is **recording**. It is now a mono ordinal in
the same face as every other reading in the product, with a rule struck under it once its step is
answered — three states, ground and weight and a rule, never colour alone, which is section 4.5's
standing requirement. `.commitment-step[data-state="open"]` gave up its border in the same move,
because `--raise` now travels 0.186 in luminance from the page rather than 0.040 and the border was
standing in for a ground that could not be seen.

**The second is the register.** The four steps are direct children of a flex column with a 12px gap,
so they rendered as four detached labels floating on the panel's ground — measured at 1440×900,
three collapsed rows across 216px of panel with nothing joining them. They are ruled now: one
hairline between consecutive rows, 6px either side of it, and the open step lifted out of the
register rather than ruled into it. A register's rows are closer than a panel's regions, and the
rule is what says these four are one reading rather than four things you fill in.

Nothing else. Same numerals, same places, same sizes, same words, same order, same questions, and
the required marks stay on the collapsed rows for the reason the component already gives: what is
required has to be knowable before the click.

### 13.4 What it cost the measurement

Three of the four changes are on the list `CURRENT_PROTOCOL_VERSION`'s own bump rule names — the
step mark, the open step's ground and the register are all "the step heads" — and the fourth, the
track order, contradicts a sentence the 3 → 4 note wrote (*"the position of every control"* stayed
identical; it did not). A fifth change paints only under `forced-colors: active` and is listed with
them. The version stays at **4**, and the reasoning is written at the constant so
it can be checked rather than trusted: version 4 has never stamped a row — it is written in one
place, by whichever build is running, and it exists only on an unmerged branch. Splitting it would
produce two versions, one permanently empty, and ask every later analysis to pool them back. The
rule is about a stimulus that changed *under measurement*. Nothing was measured under either half
of 4. **That argument expires the moment a build stamping 4 reaches a player**, and the note says
so.

### 13.5 One thing the round paid for on the way

`Home.tsx` is under a ratchet that may only ever go down
(`tests/client/the-file-that-only-ever-grew.test.ts`), and the comment explaining the workbench's
new reading order pushed it two lines over. The rule the ratchet states is *move something out,
do not raise the ceiling*, so the tool rail became `client/src/components/ControlRail.tsx`: seven
props, no state, nothing closing over the fifty-three pieces of state that make every other split
of that file a redesign. The file came out nine lines below where it started rather than two above.
The ceiling was left where it is — its headroom is documented as deliberate, unlike the state
ceiling, which is a hard ratchet.

### 13.6 What this round did not settle

`OWNER VISUAL ACCEPTANCE` is **still PENDING**. The owner has now seen `DECIDE` and named three
things about it; that is not the same as having looked at the built app across its states and
answered §11's question.

The `FIELD-REQUIRED` list grew rather than shrank: this round added the very question it acted on.
Whether the panel now reads as an instrument to somebody who did not build it is not answerable by
the person who changed it, and one screenshot with one answer does not close it.
