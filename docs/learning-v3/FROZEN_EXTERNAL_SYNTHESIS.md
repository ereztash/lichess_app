# Frozen external synthesis — E1 through E5

**Status:** FROZEN. Written before any file under `docs/learning/`, `docs/learning-v2/`,
`docs/VERIFIED_LEARNING.md` or any learning implementation was read in this cycle.

**Why this file exists at all, and why it is first.** The failure mode it forbids is not laziness,
it is a specific and comfortable one:

```text
repo idea
↓
search literature until it agrees
```

A repository that has already built a learning loop can find external support for almost any part of
it, because the literature is large and the search terms come from the thing being justified. The
only defence is order: state the external position, freeze it, and only then look. Everything the
repository turns out to agree with is then a finding rather than a construction.

**This ordering is mechanically checkable, not merely asserted.** This file and
`FALSIFICATION_REGISTER.md` are committed in a commit that touches nothing else, and
`FREEZE.json` records their SHA-256. The audit commits come after. `git log --follow` on this file
against `git log` on `EXTERNAL_REPO_CROSSWALK.md` is the check, and `scripts/learning-v3/verify_freeze.py`
is the command.

**What may and may not happen to this file.** It may be **contradicted** by repository evidence,
**narrowed**, **operationalized**, or **found insufficient** — and the crosswalk exists to do exactly
that. It may **not** be edited to agree with what the repository turns out to contain. If a
conclusion below is wrong, the record of it being wrong is worth more than a corrected copy of it,
which is `RNL-10` (*failed history is provenance*) applied to a prior instead of to an experiment.

---

## Provenance and integration method

The multilingual integrative research covered English, Chinese, French, Spanish, Russian, Japanese,
and Hebrew material, but was integrated by **independent evidence families**, not by treating
languages as seven votes.

Relevant evidence families included:

* feedback meta-analysis;
* implementation intentions;
* just-in-time / actionable feedback;
* retrieval and transfer;
* prospective memory and focal cues;
* metacognition / self-regulation;
* expertise and cognitive load;
* chess expertise / decision transfer.

**What this provenance does not establish.** The synthesis was produced outside this repository and
arrives here as text. This repository holds no primary sources for it, no extraction sheet, and no
independent re-derivation of any effect size. Under the repository's own evidence ladder it is
therefore **E1 at best — an external claim carried on the authority of its author**, and the reason
it outranks a repo intuition is not its strength but its *independence*: it was fixed before the
repository was consulted. Nothing downstream may cite E1–E5 as measurement.

---

## External conclusion E1

Information describing the past error is not sufficient to define an intervention.

The minimum plausible behavioral unit is:

```text
recognizable future cue
+
specific response
```

or:

```text
WHEN X → DO Y
```

## External conclusion E2

`X` must be recognizable by the player **before the future decision**, without engine output and
without being told "there is a tactic here."

If the learner cannot spontaneously distinguish X from nearby non-X situations, `WHEN → DO` is not
sufficient. The minimal packet may then need:

```text
X versus X'
↓
boundary discrimination
↓
WHEN X → DO Y
```

## External conclusion E3

The player's visible information can be much smaller than the information required by the system to
derive it. Formally:

```text
InformationNeededToInfer  ≫  InformationNeededToAct
```

Do not expose statistical machinery merely because it was required to produce the recommendation.

## External conclusion E4

There are currently three conceptually distinct layers:

### Behavioral core

```text
WHEN → DO
```

### Trust / relevance layer

```text
WHY THIS APPLIES TO YOU
```

Example: one short personal evidence sentence.

This layer is plausible and may improve credibility/relevance, but has **not been established as
causally necessary** for behavioral change.

### Evidence / instrumentation layer

Examples:

* cp loss;
* engine version;
* search depth;
* sample size;
* confidence interval;
* source games;
* protocol;
* statistical decomposition.

These should be available by disclosure but are not presumed necessary for action.

## External conclusion E5

The primary outcome cannot be:

* insight viewed;
* dwell time;
* "useful" rating;
* puzzle solved;
* immediate training accuracy;
* rule recalled;
* button clicked.

The decisive endpoint is a future, naturally occurring relevant decision:

```text
P(Action | Cue, intervention)
```

and it must also be checked under trigger-negative conditions.

An intervention that increases Y under both X and non-X is criterion shift / overgeneralization, not
successful learning.

---

## The candidate this synthesis produces, and its protection status

```text
Recognizable Cue → Concrete Action
```

User-facing shorthand: **When X happens → do Y.**

**This candidate is NOT protected.** The mission that froze this synthesis states it explicitly, and
this file restates it so that no later document can cite "the frozen prior" as a reason to keep
`WHEN → DO`. The question is *when it is sufficient, when it is not, and what the smallest additional
information is* — three answers, of which "it is sufficient" is only one.

---

## Reading order enforced by this file

```text
external synthesis  ← this file
↓
freeze              ← FREEZE.json, and the commit that carries only these two files
↓
repo audit          ← BASELINE.md, Phase 1
↓
crosswalk           ← EXTERNAL_REPO_CROSSWALK.md
↓
falsification       ← FALSIFICATION_REGISTER.md, executed
↓
product decision    ← FINAL_REPORT.md
```

`FALSIFICATION_REGISTER.md` is written **in this same commit** rather than at the falsification step,
because a falsifier written after the evidence is a description of the evidence. It is frozen here
and executed there.
