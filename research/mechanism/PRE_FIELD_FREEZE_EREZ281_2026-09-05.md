# Erez281 — pre-field state freeze

**Freeze id:** `EREZ281_PRE_FIELD_2026-09-05T2313+0300`  
**Freeze wall clock:** 2026-09-05 23:13 Asia/Jerusalem  
**Player:** Lichess `Erez281`  
**Purpose:** establish one immutable comparator before any new prospective mechanism validation or intervention field block.

## 1. Observation boundary

The latest game already represented by the repository is `llINzBR3`, created at 2026-09-05T11:42:44.187Z (14:42:44 Israel), rated 3+0 blitz. The recorded rating before the game was 1647 with `ratingDiff=-6`, so the latest **observed-in-repo** post-game blitz rating is 1641.

This is **not** a claim that 1641 is the live Lichess rating at 23:13. The repository has an observation gap between the latest represented game and the freeze wall clock.

Any game later discovered inside that gap is `QUARANTINE_GAP`: it may be analysed descriptively, but it is neither clean historical baseline nor prospective field evidence.

## 2. Corpus lanes frozen separately

| lane | content | permission |
| --- | --- | --- |
| `CLEAN_HISTORICAL` | 2,209 admissible games frozen from the 2026-09-01 account export | historical research comparator |
| `EXTRA_OBSERVATIONAL` | 12 admissible games after that manifest fetch | descriptive only; do not pool blindly with clean baseline |
| `FUTURE_FIELD` | only games created after this freeze wall clock and admitted under the frozen field protocol | prospective evidence |
| `QUARANTINE_GAP` | any later-discovered game between 14:42:44 and 23:13 Israel on 2026-09-05 | excluded from prospective field and from clean baseline |

The extra lane is intentionally separate because the current Neta finding records 10 admissible games after exposure to the OwnExposure sentence. Exposure status is therefore load-bearing.

The repository currently represents 2,221 admissible games across the first two lanes, but that arithmetic does **not** license treating them as one homogeneous baseline.

## 3. Frozen data identity

| artifact | blob SHA |
| --- | --- |
| `data/frozen_window_manifest.json` | `039c0e8419f803287913eb676c351b5467ae5f8a` |
| `data/decisions_erez281.parquet` | `aa1789fb7bb3b6af5f2fadf8bebf7988f09ade40` |
| `data/scored_erez281_sf171_d12_mpv3.jsonl.zst` | `c42cbfe4262973deeb5a6f0f0079b459c181bebe` |
| `data/post_freeze_admissible.ndjson` | `1d2fde600e2306da5ad5f5131c1dce541598de53` |
| `data/decisions_post_freeze.parquet` | `ae5aea81a9bb58517f58b252e2b7414d82d5d26b` |
| `data/scored_post_freeze.jsonl.zst` | `528f67a699c9c36cfc62a444ce2ecd14752ee29a` |
| `data/decisions_population_2026-06.parquet` | `5fcab2b4eb42b790d1358d77dbcde59c099dd99b` |
| `data/scored_population_sf171_d12_mpv3.jsonl.zst` | `6d4c402207dbf4609068a1b5c7c78f79e8e99483` |

Machine-readable freeze: `PRE_FIELD_FREEZE_EREZ281_2026-09-05.json`.

## 4. Research state at freeze

### R* — broad cross-context pattern

`material_balance >= -2 AND own_overloaded_piece_count >= 1`

Target: tactical error class.

This is a supported cross-context risk region, but population comparison shows it is largely level-typical rather than primarily personal.

### R** — personal residual

`material_balance in [0,3) AND own_overloaded_piece_count >= 1`

Target: `hung_material`.

On the exact frozen VALIDATE blitz frame:

- n = 1,199 R** decisions;
- population-residual within-game excess = **+6.144 pp**;
- z = **4.52**.

### Mechanism localization — post-hoc, not independent validation

The strongest permitted behavioral localization is:

> The personal R** excess is concentrated when an under-defended piece remains a live liability across more than one of the owner's own decision cycles and the next move still does not close it.

Key localization:

- `PERSISTENT`: n=305, hung-material 24.92%, population-model residual **+10.41 pp**, z≈4.26;
- `PERSISTENT + UNRESOLVED AGAIN`: n=238, owner hung-material 29.41% vs population 19.68%;
- excess unresolved penalty relative to population: **+5.81 pp**.

Durable source: `RSTARSTAR_MECHANISM_LOCALIZATION.md`.

This finding does **not** permit the labels “tunnel vision”, “didn't see it”, attention failure, calculation-depth failure, rushing, motivation, or valuation state.

## 5. Current authority/status

- Historical observation/mechanism localization: supported to the limits above.
- Cognitive cause: unresolved; requires FIELD or a controlled instrument.
- Intervention effectiveness: unresolved; requires FIELD.
- Current mission state: `FIELD_REQUIRED_FOR_LEVEL_6`.

The existing Neta finding permits C1–C4. Intervention and outcome claims remain insufficient reality.

## 6. Field protocol frozen at this point

True instruction already deposited:

> Before committing a move, when any own piece has more attackers than defenders, look at the position after the intended move: no own piece may have more attackers than defenders unless the move wins something bigger or gives check; otherwise choose again.

Current frozen frame:

- 128 rated blitz games;
- instruction vs matched sham;
- alternating blocks of ten;
- exposure logged before each block;
- unchanged scorer/feature pipeline;
- `analysis/field_eval.py`;
- 5,000 game-level bootstrap replicates;
- stop at 430 instruction-arm trigger opportunities or 60 days.

Once the first prospective field exposure occurs, the trigger predicate, class definition, engine regime, judge and block schedule may not be changed in response to outcomes.

### One pre-field operational blocker

The repository contains the requirement for a **matched sham**, but this freeze does not identify a concrete sham sentence. A concrete sham instantiation must be deposited and frozen **before the first prospective block** if it does not already exist elsewhere. Filling that blank before exposure is protocol completion; changing it after exposure would be contamination.

## 7. Freeze rule

From this point forward, any changed threshold, detector semantic, region, target, intervention wording or analysis rule is a **new version**. It must not overwrite this comparator.

The next game that may count as prospective field evidence must be created after the freeze wall clock and must have its arm/exposure state assigned according to the frozen protocol.
