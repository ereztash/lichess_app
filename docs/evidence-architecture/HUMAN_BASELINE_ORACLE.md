# The human-policy baseline

# Verdict: `DEFER`, and the reason is not availability

**Maia is available, licensable and reproducible. It is deferred because the question it would
answer has already been answered by something cheaper, and the question it was needed for is
blocked.**

---

## What is actually available

Verified against the repositories, not against a description of them.

| | **Maia (1)** | **Maia-2** | **Maia-3** |
| --- | --- | --- | --- |
| repository | [`CSSLab/maia-chess`](https://github.com/CSSLab/maia-chess) | [`CSSLab/maia2`](https://github.com/CSSLab/maia2) | [`CSSLab/maia3`](https://github.com/CSSLab/maia3) |
| **licence** | **GPL-3.0** | **MIT** | **AGPL-3.0** |
| skill conditioning | **one model per Elo bucket** (1100–1900, nine models) | **unified**, `active_elo` / `opponent_elo` per position | UCI options `SelfElo` / `OppoElo` |
| weights | released with the repo | released, `pip install maia2` | Hugging Face — `Maia3-5M`, `-23M`, `-79M` |
| output | move distribution (Leela/lc0 policy head) | `move_probs`, plus a White-perspective expected score | move prediction, runs as a UCI engine |
| Python | via lc0 | 3.10–3.12 | packaged as `maia3` |
| reported accuracy | ~50–52% move match at the matching bucket | *"surpassing original Maia by almost 2 percentage points"*; perplexity 4.67 → 4.07 bits | reports improvement over Maia-2 |

**Licence implication, stated because the programme requires it before any import.** This repository
is **GPL-3.0** (`LICENSE`, "GNU GENERAL PUBLIC LICENSE Version 3"), and it already conveys
GPL-3.0 software correctly (`THIRD_PARTY_NOTICES.md`, Stockfish 18.0.8 WASM, with licence text served
and corresponding source named).

- **Maia-2 (MIT)** — compatible with GPL-3.0 in either direction. No relicensing consequence.
- **Maia (GPL-3.0)** — compatible. Same obligations already met for Stockfish.
- **Maia-3 (AGPL-3.0)** — GPLv3 permits linking with AGPLv3 code, **but the combined work must be
  distributed under AGPL-3.0**, whose §13 adds a network-use source-disclosure obligation this
  product does not currently carry. **Adopting Maia-3 would relicense the product.** That is a
  business decision, not a research one, and it is recorded here so that nobody makes it by
  installing a package.

**For research use outside the product, all three are fine**, and `PSEUDOCODE_ORACLE` (the mode
`docs/decisions/README.md` already defines) is the right one.

## What Maia was going to be used for, and what happened to each use

**Use 1 — a human-policy chance baseline: `P_human(B | position, Elo)`.**
The screen's chance rate is the share of legal moves satisfying `B` — a **uniform-random** null. A
human-policy null is strictly better, because humans do not play uniformly.

> **Answered already, and Maia cannot improve on it.** On `RC-06`'s trigger-negative cell, **99.5% of
> legal moves satisfy the rule as stated**, and on 94.1% of items **every** legal move does
> ([`RECONCILIATION.md`](RECONCILIATION.md) §2.6a). Any policy — uniform, Maia at any Elo, Stockfish,
> a beginner — scores ≈1.00. Running Maia would produce a number between .99 and 1.00 at the cost of
> a torch install. **When a predicate is satisfied by everything, no policy model can tell you
> anything about it.**

**Use 2 — item difficulty and exchangeability for Gate B** (`move entropy`, `top-k probability`,
`predicted human difficulty` as matching covariates). This is a **genuinely good use** and it is the
one Maia is actually for.

> **Blocked upstream.** Gate B is moot: matching items for a contrast that is void does not produce a
> valid contrast ([`ACTION_MODEL_DECISION.md`](ACTION_MODEL_DECISION.md)). The moment a rule class
> exists with a non-degenerate noise cell under one fixed predicate, this becomes the first thing to
> run.

**Use 3 — an alternative explanation for observed behaviour.** *"The player made this move because
players at this rating make this move here."* Still valid, still wanted, and still downstream of
having a contrast worth explaining.

**Use 4 — item difficulty for a human item bank.** Same status as Use 2.

## What Maia must never be used for

- **Not as cognition.** Maia predicts move frequencies. A high `P_human(m)` says players play `m`,
  not that they recognise anything. The programme's rule — *never interpret Maia as cognition* — is
  restated here because Use 3 is where the temptation lives: an alternative *explanation* is an
  alternative *statistical* explanation, not a mechanism.
- **Not as ground truth.** Maia is not an oracle about correctness. Stockfish adjudicates value;
  Maia describes behaviour; neither adjudicates knowledge.
- **Not in product code**, under any licence, until an explicit later phase authorises it.

## The one Maia measurement worth queueing now

**`P_human(B | T−, Elo)` on a *method-shaped* rule class**, the moment one is screened under `C11`.
The reason is specific: `RC-11 move-the-threatened-minor` has a T− prescription size of .175, so its
noise cell is genuinely narrow — and the question *"do weak players play `B` here anyway?"* is then a
real question with a non-trivial answer, which is exactly when a human-policy null earns its cost.

**Recorded, not run.** Running it before a class survives `C11` would be preparing work for a phase
that has not been unlocked.

---

## Reproducibility note

Maia's own reproducibility is good — pinned weights, published papers (Maia-2 at NeurIPS 2024), pip
distribution. **The constraint here is this repository's**: `research/measurement/environment.lock`
pins `python 3.11.15`, and Maia-2 supports 3.10–3.12, so a separate research environment is not
required. A torch dependency would be, and it is not carried today.
