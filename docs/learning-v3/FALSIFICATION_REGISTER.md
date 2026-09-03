# Falsification register for E1–E5

**Status:** FROZEN, in the same commit as `FROZEN_EXTERNAL_SYNTHESIS.md`, before any learning file
was read.

**Why it is frozen here rather than written at the falsification step.** A falsifier written after
the evidence is a description of the evidence. The register's whole value is that the condition under
which each external conclusion would be abandoned was fixed while the answer was still unknown. This
is the repository's own preregistration idiom (`research/b3_population_expertise/results/PREREGISTRATION_FREEZE.json`)
applied to a borrowed prior.

**What a falsifier is here.** Not "a doubt". A falsifier is a stated observation, a stated
measurement that would produce it, and a stated consequence if it appears. A conclusion with no
falsifier in this table is not thereby safe; it is **unfalsifiable in this repository**, and the
register says so rather than omitting the row.

---

## 1. Register

| ID | Attacks | Refuting observation | Measurement that would produce it | Consequence if observed |
| --- | --- | --- | --- | --- |
| `F-E1-a` | E1 | Past-error explanation alone changes natural future decisions **as much as** `WHEN → DO`. | Control vs Treatment A in `INTERVENTION_EXPERIMENT.md`, primary endpoint ΔP(Y\|X) on uncued natural opportunities. | The proposed minimal unit is **not minimal**. `WHEN → DO` is an authoring convenience, not a mechanism. Packet reduces to the explanation. |
| `F-E1-b` | E1 | `WHEN → DO` changes nothing anywhere: ΔP(Y\|X) ≈ 0 under every treatment, while the control also ≈ 0. | Same experiment; both arms flat. | E1 is not refuted but is **inert in this domain**. The barrier is elsewhere in `R4`'s chain and the packet is the wrong object. Report as domain limit, not as support. |
| `F-E1-c` | E1 | The unit cannot be *expressed* for any validated rule class — no cue survives Gate A / Gate B with a stateable X and a stateable Y. | Gate A `ACTION_SET_AUDIT.md` + Gate B `EXCHANGEABILITY_AUDIT.md`. | E1 is untestable here. `WHEN → DO` is not refuted; it is **not instantiable**, which blocks the product regardless. |
| `F-E2-a` | E2 | Players recognize the relevant condition reliably, but `WHEN → DO` still does not alter action. | Study D State 2 (detected X, chose non-Y) at a rate that dominates State 1. | The bottleneck is **downstream of recognition**. E2's emphasis on cue recognizability is misplaced for this population; boundary discrimination will not help. |
| `F-E2-b` | E2 | The intervention only works when a prompt announces the relevant situation. | Study D cued vs uncued contrast; Level 2 passes, Level 3 fails. | No uncued transfer has been demonstrated. Any claim above Level 2 is withdrawn. E2's "recognizable without being told" is exactly what was **not** achieved. |
| `F-E2-c` | E2 | Asking whether X is present *itself* changes the move (cue reactivity). | Study D State 4: reactivity arm where the detection probe precedes the decision vs where it follows commit. | The measurement instrument is an intervention. Every prior "recognition" number is contaminated and E2 cannot be evaluated with that instrument. |
| `F-E3-a` | E3 | Removing the instrumentation layer **lowers** natural transfer, not merely trust. | Disclosure-suppressed vs disclosure-available arm, endpoint ΔP(Y\|X). | `InformationNeededToAct` is larger than claimed. The evidence layer is part of the behavioral core, and E3's inequality is wrong in the direction that matters. |
| `F-E3-b` | E3 | The minimal packet cannot be stated without engine-derived quantities appearing inside the cue. | `GATE-CUE-PLAYER-OBSERVABLE` on the actual validated cue definitions. | E3 is violated by construction: the system cannot compress to a player-observable instruction. The cue, not the UI, is the blocker. |
| `F-E4-a` | E4 | `WHY YOU` materially improves natural transfer over `WHEN → DO`. | Treatment A vs Treatment B, endpoint ΔP(Y\|X), not ratings. | The behavioral core was **incomplete**. `WHY YOU` is a learning mechanism, not a trust layer, and E4's three-layer split is wrong. |
| `F-E4-b` | E4 | `WHY YOU` changes confidence / usefulness / uptake ratings but not future action. | Same comparison; Level 0–1 outcomes move, Level 3 does not. | E4 is **supported**: `WHY YOU` is a trust layer. It may ship, but may never be described as helping the player learn. |
| `F-E4-c` | E4 | `WHY YOU` *lowers* natural transfer (e.g. by licensing the player to defer to the system). | Treatment B below Treatment A on ΔP(Y\|X). | The trust layer is an active harm to the behavioral core. It is removed, not made optional. |
| `F-E5-a` | E5 | Y rises in T+ and T− alike. | Mandatory ΔP(Y\|¬X) monitor beside ΔP(Y\|X). | The intervention taught **unconditional responding**. Not learning. Outcome D (conditional discrimination) becomes the barrier. |
| `F-E5-b` | E5 | A lower-level endpoint (drill accuracy, rule recall) predicts the natural endpoint well enough that measuring the natural one adds nothing. | Correlation of Level 1–2 outcomes with Level 3 outcomes across packets, with the natural endpoint measured anyway. | E5's insistence on the natural endpoint is **economically** wrong though logically right. Record as a cost finding; do not drop the natural endpoint on one correlation. |
| `F-E5-c` | E5 | Natural opportunities are so rare that P(Y\|X) cannot be estimated at any feasible N. | Opportunity-rate derivation in `NATURAL_RETEST_SPEC.md` against the actual game corpus. | E5's endpoint is unmeasurable in this product. Stop condition `INSUFFICIENT_OPPORTUNITIES`; the loop cannot be closed as specified. |

---

## 2. Falsifiers of the mission's own candidate

The candidate `Recognizable Cue → Concrete Action` is not protected. These attack the candidate
rather than the synthesis behind it.

| ID | Refuting observation | Consequence |
| --- | --- | --- |
| `F-C-a` | The smallest packet that changes behavior is **larger** than `WHEN → DO` for every barrier state found. | The candidate is a floor nobody reaches. Report the actual minimum, not the candidate. |
| `F-C-b` | The smallest packet is **smaller** — e.g. the cue alone, with no prescribed action, suffices. | `DO Y` is redundant. The product should orient attention, not prescribe. |
| `F-C-c` | Different barrier states need different minima and no single packet type dominates. | There is no "minimum information" answer, only a per-barrier one. The mission question is malformed as asked, and the honest answer says so. |

---

## 3. What this register cannot falsify inside this repository

Stated so that a later document cannot present silence as support.

* **Every row whose measurement is "the experiment" requires human participants.** No row in
  section 1 that names ΔP(Y\|X) can be executed by any command in this repository today. Gates A and
  B are pre-human gates precisely because of this: they decide whether the human study is
  *admissible*, and they cannot substitute for it.
* **`F-E1-a` and `F-E4-a/b/c` need a control arm that ships a deliberately weaker product** to some
  players. That is a real ethical and product cost, and it is the price of the claim. A report that
  skips it may not use the word "learning".
* **Only `F-E1-c`, `F-E3-b` and `F-E5-c` are executable now** — by Gate A, by the cue-observability
  gate, and by counting opportunities in the existing corpus respectively. If any of those three
  fires, the human study never becomes admissible, and the register will have done its work without
  a single participant.

---

## 4. Disposition

Each row is marked in `FINAL_REPORT.md` as exactly one of:

```text
EXECUTED — REFUTED        the observation appeared; the conclusion is abandoned
EXECUTED — NOT REFUTED    the measurement ran and did not produce the observation
NOT EXECUTABLE            named blocker, with the gate or resource that would unblock it
```

`NOT EXECUTABLE` is not a pass. A conclusion carried forward on `NOT EXECUTABLE` rows only is carried
forward as an **assumption**, and every downstream document that depends on it must say so in the
sentence that depends on it.
