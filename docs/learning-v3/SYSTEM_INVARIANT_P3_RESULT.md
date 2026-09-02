# P3 — Cross-rule system-invariant transfer

Status: **COMPLETE**  
Verdict: **`P3-PASS — transferable system invariant supported`**  
Frozen protocol authority: `docs/learning-v3/SYSTEM_INVARIANT_P3_PREREG.md`  
Freeze commit: `c4aab8e983f6c0ebc62ee4dcba45be6bc443ed90`

## Goal tested

Among multiple moves that already satisfy a valid action predicate and already resolve the focal threat, test whether a **rule-agnostic relational/system representation** of the resulting position carries transferable information about which move is better.

The test was deliberately stronger than P2:

- only `RC-07`, `RC-08`, `RC-09`, where every candidate move already satisfies the action predicate;
- leave-one-rule-class-out transfer;
- the held-out rule class never appears in training;
- no `rule_class` feature;
- a local/geometric move comparator is included;
- fixed Ridge model, no tuning;
- position-cluster bootstrap;
- no new engine search.

## Run integrity

- engine searches run: **0**
- preserved move evaluations missing: **0**
- duplicate `(position_id, move)` rows: **0**
- moves analysed: **4,139**
- unique source positions represented in the move table: **711**
- pairwise primary comparisons: **4,546**
- positions contributing at least one non-tied pair: **369**
- bootstrap replicates: **5,000**
- bootstrap cluster: **position**
- seed: `20260902`
- regret-pair exclusion threshold: `0.01`

Eligible source items:

| Held-out class | Eligible items | Primary pairs | Pair positions |
|---|---:|---:|---:|
| RC-07 | 240 | 1,816 | 130 |
| RC-08 | 233 | 1,108 | 106 |
| RC-09 | 238 | 1,622 | 133 |

## Primary result

### Pooled leave-one-rule-class-out ranking

| Model | Pairwise accuracy |
|---|---:|
| M0 — position-only | **0.5000** |
| M1 — local/geometric move | **0.5779** |
| M2 — local + system relations | **0.6577** |

Incremental gains:

- `M1 − M0`: **+0.0779**, 95% position-cluster CI **[+0.0466, +0.1078]**
- `M2 − M0`: **+0.1577**, 95% position-cluster CI **[+0.1287, +0.1856]**
- `M2 − M1`: **+0.0799**, 95% position-cluster CI **[+0.0534, +0.1049]**

The system representation therefore adds information that is not explained by the frozen local/geometric move comparator.

## Cross-class breadth

### RC-07 held out

- M1 local: **0.5804**
- M2 system: **0.6646**
- `M2 − M1`: **+0.0843**
- 95% CI: **[+0.0337, +0.1324]**

### RC-08 held out

- M1 local: **0.6300**
- M2 system: **0.7094**
- `M2 − M1`: **+0.0794**
- 95% CI: **[+0.0351, +0.1294]**

### RC-09 held out

- M1 local: **0.5395**
- M2 system: **0.6147**
- `M2 − M1`: **+0.0752**
- 95% CI: **[+0.0384, +0.1113]**

All three held-out classes are above chance under M2, and **all three** class-specific `M2 − M1` confidence intervals exclude zero on the positive side. The preregistration required only two of three.

## Frozen decision rule outcome

Every preregistered PASS condition was met:

1. pooled M2 accuracy > 0.50 — **YES** (`0.6577`)
2. pooled `M2 − M1` CI entirely > 0 — **YES** (`[0.0534, 0.1049]`)
3. pooled `M2 − M0` CI entirely > 0 — **YES** (`[0.1287, 0.1856]`)
4. M2 accuracy > 0.50 in all three held-out classes — **YES**
5. at least two class-specific `M2 − M1` CIs entirely > 0 — **YES, 3/3**

Therefore the mechanically determined verdict is:

> **`P3-PASS — transferable system invariant supported`**

## Secondary diagnostics

| Model | MAE | R² |
|---|---:|---:|
| M0 position-only | 0.22229 | 0.2770 |
| M1 local | 0.22229 | 0.2992 |
| M2 system | **0.21658** | **0.3339** |

These are secondary and did not decide the verdict.

## What now has authority

The following statement is licensed by the frozen experiment:

> **A rule-agnostic relational/system representation carries transferable information about move quality among already-valid actions.**

A stronger operational restatement, still within the observed scope:

> When several moves already implement the prescribed action successfully, properties of the resulting system — support, attack relations, redundancy, dependency, hanging/overloaded structure, pinning, and king-ring relations — improve out-of-class ranking of those moves beyond position-only and local move geometry.

This materially upgrades P2. P2 could be explained as detecting whether an apparently compliant action left the focal problem unresolved. P3 removes that explanation: every candidate is already inside the valid action set, the tested rule class is unseen during training, and the system model still adds approximately **8 percentage points** over local move descriptors.

## What this does NOT establish

P3 does not establish:

- causality;
- that humans naturally perceive these variables;
- that this exact feature set is minimal or optimal;
- homeostasis as the correct theory of chess;
- controllability as the latent invariant;
- superiority to Stockfish;
- selection among all legal moves rather than ranking inside already-valid action sets;
- that teaching system-state language changes future human play.

## Implementation incidents before the valid run

Two runner attempts failed **before any experimental result was produced**:

1. import path for `rule_classes` was missing;
2. the corpus path resolved one directory too high.

Neither incident changed the preregistered protocol, features, model family, outcome, threshold, seed, bootstrap unit, or decision rule. The final runner fixed only environment/path resolution (`PYTHONPATH` and a runner-only symlink). No result was available before those fixes.

## Research consequence

The systems direction is no longer supported only as a viability validator for broad prescriptions. It has survived a stricter transfer test.

The next unresolved claim is now narrower and more important:

> **Do the transferred system features describe a human-recognizable state/action policy that can be detected prospectively and improve a future uncued decision?**

Until that human/natural-transfer test passes, P3 belongs in the inference/recommendation layer, not as a player-facing claim about “system health”, “homeostasis”, or “controllability”.
