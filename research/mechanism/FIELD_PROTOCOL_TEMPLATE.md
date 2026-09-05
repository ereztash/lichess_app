# Field protocol template (Node L) — to be instantiated only for a candidate that reaches L4

Reuses, rather than reinvents, the repository's own frozen N-of-1 design
(`docs/system-invariant/PRE_EXPOSURE_BASELINE.md` §3) and the learning layer's surviving skeleton
(D21–D24: trigger = frozen board-only predicate evaluated by the system; delivery outside DECIDE;
denominator = every opportunity, fired or not; sham = matched perturbation that does not flip the
trigger; paired game-cluster bootstrap). Every blank is filled from the frozen candidate, never from
a post-hoc reading.

| item | value |
| --- | --- |
| TRIGGER | the frozen region predicate, version-hashed; evaluated by code on the pre-move board (never by the player's own sentence) |
| PLAYER WORDING | one sentence the player can evaluate at the board; its coverage of the code predicate is measured (share of code-trigger positions the sentence identifies) before delivery |
| DELIVERY | one written instruction before the session; never in-game (D21: an in-game cue is both intervention and measurement) |
| SHAM | a matched instruction of the same length and form about a non-trigger situation with the same base rate; delivered in alternating sessions by a frozen schedule (staggered within-participant, concurrent control) |
| EXPOSURE LOGGING | date-time of each delivery; games are labelled by the instruction in force |
| PRE-EXPOSURE BASELINE | the most recent 300 admissible blitz games before the first delivery, plus the whole record beside it; rating band ± 100 |
| PRIMARY OUTCOME | P(error \| trigger opportunity) within game, versus outside-trigger decisions in the same games (the within-game contrast the candidate was judged on) |
| POLICY OUTCOME | P(the prescribed operation's observable signature \| trigger opportunity) — reported separately from move quality |
| NEGATIVE ENDPOINT | error rate and policy signature on non-trigger decisions must not move (overgeneralisation is a failure) |
| DENOMINATOR | eligible trigger opportunities, identified by the same frozen code pre and post |
| MINIMUM OPPORTUNITIES | from the opportunity density measured on the record (per game) and the frozen minimum detectable contrast |
| STOPPING RULE | fixed number of post-delivery opportunities or fixed calendar days, whichever first; written before delivery |
| CONTAMINATION RULE | games played after any other cue exposure (e.g. the 2026-09-02 OwnExposure sentence) are labelled; no game is relabelled after the fact |
| ADHERENCE | the policy signature rate is the adherence measure; no self-report |
| ANALYSIS | paired within-game contrast, game-level cluster bootstrap 5,000 replicates, seed frozen; sham arm compared identically |
| FALSIFIER | the within-game contrast does not shrink under the true instruction relative to the sham instruction by at least the frozen minimum |
| REVERSAL | policy signature rises but error does not fall: the intervention targets the wrong distinction; error falls under sham as much as under the true instruction: attention, not mechanism |
EOF
echo written