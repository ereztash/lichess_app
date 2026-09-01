# The perceptual contract

Five qualities the product must have and five it must not. Chosen after
[`01-BASELINE.md`](01-BASELINE.md) and before any styling, and every one of them is answerable from
the repository rather than from taste. A quality with no repo support is a preference, and a
preference belongs to the owner.

**This is not the Art Direction.** It is the test the Art Direction has to pass. The direction may
be replaced; these ten stay until the owner or a player moves them.

---

## What object Decision Lab is

Asked before any adjective, because the adjectives follow from it. Six candidates were tested
against product behaviour, not against how well they read.

| candidate | what would make it true | verdict |
| --- | --- | --- |
| **decision instrument** | the product's job is to take a measurement of a decision | **partly.** True of `DECIDE` and `ANSWER_INSTRUMENT`. Says nothing about `REFLECT`, whose whole content is what the measurements do *not* license |
| **evidence notebook** | things are written down in order, kept, and read back; earlier entries are not revised | **yes.** The record is append-only and enforced once in `shared/record-service.ts`; a refuted claim is kept forever and never retested; `README` calls the product a record before it calls it anything else; the stylesheet's own palette note says the colours were written "for a paper-and-ink lab notebook" |
| **measurement apparatus** | the product's identity is the instrument | **no, and this is the interesting rejection.** The engine is a dynamic import kept out of the initial module graph *so that it cannot appear before a decision is recorded*. The apparatus is deliberately subordinate to the record |
| **human–machine boundary** | the product's identity is the line itself | **as a signature, yes; as an object, no.** A boundary is not a thing you can hold. It is the notebook's rule about who may write when |
| **chess decision record** | the entries are chess decisions | **yes, and it is the same answer as "evidence notebook", narrowed** |
| **analysis laboratory** | the product analyses | **no.** *"It does not claim it improves chess. There is no such measurement."* A laboratory is where analysis is the product; here analysis is one column of one entry |

**Decision Lab is a chess evidence notebook with an instrument attached, and a rule about who may
write in it and when.**

The rule is the interesting half and it is the product's own: the player writes first, the machine
writes second, and the notebook keeps both without ranking them.

---

## Five desired qualities

Each has to survive the question *what in this repository would be false if the product did not
have it*.

### 1. `PRECISE`

**Repo support.** Every number on screen carries its denominator; `GATE-DENOM`'s positive control is
`rate(1,1)` rendered as "100%". `GATE-GRADE`'s is a claim shown without its grade or its n.
`GATE-NO-FAKE`'s is an invented opening evaluation. The product already refuses to say a number
loosely; the visual language has to be able to hold one.

**What it means visually.** Readings are set in the reading face, aligned, and never approximated.
A quantity and its denominator are one object.

### 2. `CALM`

**Repo support.** `MODE_CONTRACT` gives three modes `producingEvidence: true`, and all three forbid
prior evidence and engine output — a confidence stated in front of a panel describing that player's
calibration is not a measurement of what they believed. Calm is not a mood here; it is the
measurement condition.

**What it means visually.** Nothing competes for attention while evidence is being produced. No
evaluative colour, no movement, no count that changes.

### 3. `CHESS-NATIVE`

**Repo support.** `docs/VALUE_CLARITY.md` Lens 1's failure condition is a first viewport that leads
with a research construct before naming a chess problem. The board is the subject of four of the ten
modes. The dark palette keeps warm squares on the stated ground that *"a chess board that loses its
warmth stops reading as a board"*.

**What it means visually.** The board is not a widget on a page; the page shares its material. And
`ARRIVE` and `/blitz` currently render no chess at all, which is the same defect from the other end.

### 4. `EVIDENCE-CONSCIOUS`

**Repo support.** `shared/evidence-authority.ts` grades evidence; `D25` reads
`CONSTRUCT-UNDERIDENTIFIED`; the learning surface is graded `H` and was moved to opt-in because a
surface named VERIFIED shipping by default was the stronger claim shipping. `RevealPanel`'s own
comment puts the evaluation number in a collapsed disclosure because it is *"the most visually
attractive element on this screen and the least useful one"*.

**What it means visually.** Weight tracks evidence, in one declared direction, and the mapping is
written down rather than felt.

### 5. `TWO-HANDED`

The one that is not a general design adjective, and the reason the other four are not enough. It is
the perceptual form of the product's own rule.

**Repo support.** `engineMayRun` is false in every mode where the player is producing evidence; the
type system makes a commitment event carrying an evaluation unbuildable; the engine is a dynamic
import so it cannot appear in the network tab before a decision is recorded; `ONE_THING_EVIDENCE`
labels each Reveal branch by which evidence it rests on and an ablation test proves the labelling.
`--chosen` exists, in the stylesheet's own words, so that one mark cannot mean both the player's
guess and the machine's answer.

**What it means visually.** A person looking at any screen can tell what the player put there from
what the machine returned, without reading a label — and neither one is drawn as the better of the
two.

---

## Five forbidden qualities

### 1. `GENERIC SAAS`

**What would make it true.** Stacked equal cards as the default wrapper; a connect-your-account row
as the front door's only structure; a hue that means *interactive* and therefore means nothing;
elevation used as decoration. Three of those four are measured on the baseline.

**Repo support for forbidding it.** `docs/COMPETITIVE_BENCHMARK.md` is a document about what other
tools do; the product's differentiation is an information difference, and a form that says
"software" says nothing about information.

### 2. `GENERIC AI`

**What would make it true.** Gradient accents, glow, a chat surface, an assistant voice, copy that
narrates confidence the instrument does not have.

**Repo support.** `docs/VALUE_CLARITY.md`: no LLM, no coach, no self-explanation layer, no second
classifier. The product's entire posture is that it says less than it could.

### 3. `COACH-DASHBOARD`

**What would make it true.** A grid of metrics; a score; a streak; a progress bar toward a
threshold; "you improved".

**Repo support.** *"The output is one claim and one drill — not a dashboard. A page that shows
everything is a page after which nothing changes."* Lens 5 forbids numbers as motivation, progress
bars, "X left", and reward language, by name.

### 4. `APOLOGETIC`

**What would make it true.** Silence drawn as an empty state. A caveat drawn as a warning.
Uncertainty drawn thin, grey and small. A "not measurable" row that looks like a failed row.

**Repo support.** This is the brief's §18 and the repository already argues it: the empty Reveal
branch was deliberately raised to the data rank, *"a first-class answer, drawn as one, and not
drawn as a finding"*. `silence` is a counted branch in the trial ledger, not a missing value. And
the baseline found the inverse live: `--warn` on `.record-mode.session-only`, which is a valid
storage mode.

### 5. `CEREMONIAL`

**What would make it true.** Friction that looks like a form. A commitment that reads as a
confirmation dialog. A required-field asterisk grammar. A boundary drawn as a divider with a label
on it.

**Repo support.** Lens 3's failure condition, verbatim: *"the product states the rule without the
reason, so the ordering reads as ceremony."* `LAW 9` gates instrument friction on research, which
means the friction is real and has to look real. The baseline's dashed red *"missing: choose a move
on the board"* is the ceremonial reading in one control.

---

## The five that were tested and not chosen

| candidate | why not |
| --- | --- |
| `MATURE` | not falsifiable from anything in the tree. It is a compliment |
| `CRAFTED` | an output of the other five, not an input. If weight tracks evidence and the measure is right, "crafted" is what that looks like |
| `TRUSTWORTHY` | **field-required, and dangerously close to a design goal.** Trust is a thing a player has, and designing for it directly is how a product ends up looking more certain than it is |
| `HUMAN` | true of the content and unhelpful as an instruction. `TWO-HANDED` is what it actually means here |
| `DELIBERATE` | the same as `CALM` plus a claim about intent |

And on the forbidden side, `CLINICAL` and `ACADEMIC-PAPER` were **not** taken. Both are frequently
the right accusation and neither is one here: the product is a laboratory record and a register that
refuses to overclaim is the point. Forbidding them would license warming the product up in exactly
the places where its restraint is the content. `APOLOGETIC` is the real risk in that direction, and
it is on the list.

---

## How each of the ten is checked

| quality | how it is falsifiable in this repository |
| --- | --- |
| precise | every rendered rate has a denominator (existing gates) |
| calm | no evaluative colour paints in a `producingEvidence` mode — assertable over the rendered screen |
| chess-native | the board's material and the page's share a family; `ARRIVE` and `/blitz` render chess |
| evidence-conscious | one declared grade→weight mapping, and no surface exceeding its grade |
| two-handed | **no control paints in the machine's colour**, at any call site. A stylesheet assertion with a positive control |
| no generic SaaS | the action grammar has three roles and no local inventions |
| no generic AI | zero gradients, zero glows; no assistant voice |
| no coach-dashboard | Lens 5's existing tests: no digits, no unlock vocabulary, one invariant proposition |
| not apologetic | silence and "not measurable" do not use the failure hue and are not the smallest rank |
| not ceremonial | the pre-commit screen carries no failure colour |

Five of these ten are already gates. Four more become assertions in this pass. The tenth —
`chess-native` — is partly a judgement, and it is named as one.
