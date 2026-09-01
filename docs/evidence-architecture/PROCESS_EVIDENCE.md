# Process evidence

# Status: `NOT UNLOCKED`. Execution 2 does not run.

**The gate is `D25`, and `D25` is `CONSTRUCT-UNDERIDENTIFIED`, not `PROCESS-EVIDENCE-REQUIRED`.**
The programme's rule is explicit — Execution 2 runs only on `PROCESS-EVIDENCE-REQUIRED`, and on
`CONSTRUCT-UNDERIDENTIFIED` it does not run until a revised construct exists.

This file exists to record **why** the obvious next move is the wrong one, because "the final move
was not enough, so measure the process" is exactly the inference this execution's evidence forbids.

---

## Why process evidence is not the answer to this failure

The construct failed **in the response definition**, not in the observation channel.

Correct conditional discrimination and response bias differ in a **disposition to act when the
trigger is absent**. When the response predicate is satisfied by 99.5% of legal moves on
trigger-negative items, acting-when-absent and not-acting-when-absent produce **the same
observation** — and a richer record of *how* the move was reached does not tell you which
disposition produced a move that both dispositions produce.

Measured, not argued: `C/D` stays at exactly **.500** under move, both cells, time, a timed
condition, a delayed condition, a generic cue and the candidate set
([`IDENTIFIABILITY_SIMULATION.md`](IDENTIFIABILITY_SIMULATION.md)).

**The one apparent exception proves the rule.** A think-aloud in which the player *says* "the rule
applies here" would separate them — but that is a **verbal report of the diagnosis**, not a process
trace, and it is a *prompt*, which #49 correctly classifies as an intervention rather than a neutral
instrument.

## What would unlock Execution 2

**One thing, and it is upstream:**

> A rule class with a non-degenerate noise cell under a **single fixed response predicate**, on
> which the final-move contrast is measured and **still** fails to separate a decision-relevant pair.

That is `PROCESS-EVIDENCE-REQUIRED`. **This execution never reached it**, because the final-move
contrast was never validly measured on any class.

## What was researched anyway, and kept for that day

Compactly, because researching a locked phase in depth is manufacturing work.

**Separated as the programme requires:**

| | gold-standard research signal | production-feasible signal |
| --- | --- | --- |
| Spanish | systematic observational methodology; **LINCE PLUS** computes inter-observer agreement *inside* the coding workflow, exports to THEME/GSEQ | none — video coding is not a browser event |
| Japanese | **verbal protocol analysis** across skill levels (RIKEN shogi project); 感想戦 as a naturally occurring retrospective protocol | none, though 感想戦 shows a post-game protocol need not be artificial |
| French | **autoconfrontation** — the subject commenting on video of their own activity; the instrument *didactique professionnelle* uses to reconstruct the *modèle opératif* | none |
| Russian | reflective-activity methods; the orienting basis of action as a manipulable object | none; and the chess application search returned an explicit null |
| open-source | jsPsych (MIT) for trial structure; PM4Py (GPL-3.0) over ordered event logs; mousetrap (GPL-3.0); WebGazer (BSD) | **`candidate_moves_considered` in touch order is already a production event log** |

**The one production-feasible process signal that already exists** is the candidate array, and
[`INCREMENTAL_EVIDENCE_VALUE.md`](INCREMENTAL_EVIDENCE_VALUE.md) prices it: **+.010 on A/B and noise
on everything else.** It is worth keeping and it is not a substitute for a valid contrast.

## The product implication, recorded explicitly as required

**If a later execution establishes that only laboratory evidence can separate the required states,
the product cannot measure the construct.** That is not a reason to approximate it in the app. It is
a reason to narrow the product claim to what the app *can* observe:

> what the player decided, how long it took, what they had on the board before committing, and what
> it cost — with no claim about which capability controlled it.
