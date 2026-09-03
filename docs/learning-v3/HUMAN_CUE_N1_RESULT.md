# P4 — N-of-1 human cue transfer result

Status: **COMPLETE**  
Verdict: **`P4-N1-PASS`**  
Protocol authority: `docs/learning-v3/HUMAN_CUE_N1_PREREG.md`  
Freeze commit: `ed7e72b120432dec79d2160a28aeca27a443e368`

## Goal tested

Test whether one system-derived relation can be compressed into a short, board-observable cue that one human player can learn from prototypes and then use to improve choices on unseen positions without the cue being shown at decision time.

This is an N-of-1 pilot. It supports only within-participant evidence.

## Frozen cue

The preregistered extraction rule selected the system feature:

`post_own_overloaded_piece_count`

Stable standardized Ridge coefficients across the three LOCO folds were:

- `+0.07197`
- `+0.05220`
- `+0.08753`

All three signs agreed. Positive coefficient means lower is preferred because higher predicts more regret.

The literal Hebrew cue shown only after baseline submission was:

> אחרי שפתרת את האיום, הקטן את מספר הכלים שלך שעליהם יותר תוקפים ממגינים אחרי המהלך.

No second feature was added.

## Locked bank integrity

- bank SHA-256: `204c6f44bfa0817d07927babd9f67120962da53181f01bec1e7eef5e6a12f6a1`
- hidden-test SHA-256: `fabf8ea91f773c7d7a25e878e6b45701fde655cac7bacf18eb4d4511db31b2a1`
- engine searches run during P4 preparation: **0**
- teaching prototypes: **4**
- baseline: **8 TARGET + 4 CONTROL**
- unseen test: **8 TARGET + 4 CONTROL**

The raw participant response payloads are not committed to the public repository. Canonical JSON SHA-256 digests are recorded instead:

- baseline response payload: `eb77a1014a6679f503ad2a7630386ac9949a2300e587ce516c7a9653ff083a3c`
- test response payload: `015c507997cb9cdddce738de8c118c6c0382ac9a4bad9e0e5e938dd80d3f4b23`

## Primary result

| Endpoint | Baseline | Unseen test | Change |
|---|---:|---:|---:|
| TARGET accuracy | **6/8 = 75%** | **8/8 = 100%** | **+25 pp** |
| CONTROL accuracy | **3/4 = 75%** | **4/4 = 100%** | **+25 pp** |
| TARGET median decision time | **16,773.5 ms** | **16,447.0 ms** | **−326.5 ms (−1.95%)** |

Overall accuracy moved from **9/12 = 75%** to **12/12 = 100%**.

## Frozen decision-rule audit

`P4-N1-PASS` required all five preregistered conditions:

1. test TARGET accuracy >= baseline TARGET accuracy + 0.25  
   **PASS:** `1.00 >= 0.75 + 0.25`
2. test TARGET accuracy >= 0.75  
   **PASS:** `1.00`
3. CONTROL accuracy does not fall by more than 0.25  
   **PASS:** it increased from `0.75` to `1.00`
4. at least 6/8 test TARGET responses are present and interpretable  
   **PASS:** `8/8`
5. no cue text or correctness was exposed before baseline submission  
   **PASS:** baseline was submitted before cue disclosure; the hidden bank was committed by hash before testing.

Therefore the mechanically determined verdict is:

> **`P4-N1-PASS`**

## Interpretation

Within this participant and this locked item bank, a one-sentence system-derived cue was followed by perfect performance on eight unseen TARGET positions, compared with six of eight before teaching. The cue was not visible during the unseen test.

The result is especially notable because baseline TARGET accuracy was already 75%; the frozen +25 pp criterion therefore required **8/8** on the unseen TARGET set, which occurred.

The timing result is directionally supportive but small: median TARGET decision time decreased by about 2%. It was not required for PASS.

CONTROL accuracy also improved from 75% to 100%. This does not falsify cue-specific learning, because the preregistered specificity guard only required that controls not deteriorate, but it means the design does **not isolate** the +25 pp TARGET gain from possible generic task familiarity or broader chess adaptation as cleanly as a randomized between-condition experiment would.

## What now has authority

The following statement is licensed, with N-of-1 scope:

> **For one participant, a mechanically selected, board-observable system relation could be compressed into a short cue and was followed by improved choice accuracy on unseen uncued test positions.**

Combined with P3, the current evidence chain is:

`relational signal in engine-preserved move data`  
→ `cross-rule transfer among valid actions (P3-PASS)`  
→ `single human-readable cue extracted without post-hoc choice`  
→ `within-participant unseen transfer after teaching (P4-N1-PASS)`

## What this does NOT establish

P4 does not establish:

- population efficacy;
- causality against a randomized no-cue or alternative-cue control;
- long-term retention;
- transfer to ordinary games;
- natural trigger recognition under time pressure;
- that `post_own_overloaded_piece_count` is the unique or optimal human cue;
- homeostasis or controllability as the correct latent theory;
- superiority to engine analysis.

The next authority question is now prospective natural transfer:

> **After the cue is no longer shown, does the participant use it appropriately when matching situations arise naturally in ordinary games?**

That requires future ordinary-game decisions and cannot be replaced by another offline item-bank analysis.