# Gate B — trigger contrast and exchangeability

**Outcome: `B-PASS`, for `RC-05 safe-promotion`, under minimal functional twins, with one domain
limit recorded.**

The action-set contrast moves in the direction predicted before the run, it survives conditioning on
position value, it is **larger** on the strictest subset than on the full bank, and a matched sham
perturbation that does not flip the trigger produces a small effect in the **opposite** direction.

**`B-PASS` licenses a task, not a claim.** What it says is that a rule-use task on this class would
measure the trigger rather than item difficulty. It says nothing about whether a player can see the
trigger, whether seeing it changes the move, or whether any of it appears in an ordinary game.

---

## 1. Why this class, and why not `RC-06`

`PRE_HUMAN_GATES.md` puts a precondition ahead of both of Gate B's frames:

> *"A twin pair `P / P'` flips the trigger. If `B` is **also** defined differently on the two sides,
> the contrast measures the predicate change and not the trigger change, and no matching repairs
> that — it is in the response definition, not in the items."*

**`RC-06` fails that precondition**, and the repository measured what it costs. `_threat_satisfies`
asks *"is the opponent left without mate in one"* on `T+` and *"is the opponent left without any
check at all"* on `T−`, so a hit and a false alarm score different behaviours:

```text
b_valid   branching   T+ .952   T- .192    separation  +0.760
b_valid   symmetric   T+ .952   T- 1.000   separation  -0.048
```

with **92%** of the negative cell satisfying the stated rule under every legal move. Gate B cannot be
run on it as specified, which `PRE_HUMAN_GATES.md` records as a blocker ahead of its own B1 and B2.

**`RC-05` has no such problem, and not by luck:**

```text
trigger    queen promotions exist, all to ONE square q; T+ iff nothing attacks q
response   move.promotion == QUEEN          -- A PROPERTY OF THE MOVE ALONE
```

The response predicate never consults the trigger, so `B` is **identical on both cells by
construction**. It is also the class the current authorities favour: `C11` MEASURABLE, `c10_grade`
`tested-by-the-trigger`, `ANCHOR_REBUILD` corrected separation .454 at 59.3% of the rebuilt ceiling,
and — from `ACTION_SET_AUDIT.md` — the only permitted set in the corpus whose ninetieth-percentile
member costs nothing.

---

## 2. The transformation, and what it holds fixed

**Relocate one enemy piece so that the single promotion square changes between attacked and
unattacked.** A relocation rather than an addition or a deletion, because adding or removing a piece
changes material — the covariate `GO_NO_GO.md` already names as the largest imbalance in the natural
item sets (SMD **−0.487**).

Every one of these disqualifies a candidate twin, and each is a refusal rather than a repair:

* the position is not legal by `chess.Board.status()`;
* the side to move changes, or its check status does;
* the side **not** to move is left in check, which is not a position;
* the promotion target set stops being exactly `{q}` — a relocated piece can block a push or open a
  capture-promotion to a second square, and then the twin is a different decision;
* the shipped trigger does not return the flipped state when asked;
* a pawn would land on the first or last rank.

### The bank

| | |
| --- | --- |
| source items | **736** — RC-05's entire corpus presence, 370 T+ and 366 T− |
| pairs built | **378** |
| yield | **50.0%** from T+, **52.7%** from T− |
| material balance, piece count | move by **exactly zero** on all 378 pairs |
| mean covariate movement | +0.106 legal moves, +0.222 captures, +0.082 checks, +0.286 forcing moves |
| relocation distance | **206 of 378 move a piece one square**; 259 move it two or fewer |
| piece moved | rook 191, bishop 92, knight 53, queen 42 |
| cells after construction | **378 in each**, balanced by construction rather than by matching |

An example pair, which is the whole design in one line:

```text
source  T+   8/6pk/7p/8/8/1R5P/rp4PK/4r3 b - - 5 48
twin    T-   8/6pk/7p/8/8/7P/rp4PK/3Rr3 b - - 5 48
        white rook b3 -> d1, so b1 goes from unattacked to attacked
        material identical, one piece two squares away, everything else untouched
```

---

## 3. Question 5 — the action-set contrast, against a prediction written first

`gate_b.py` states the direction before the numbers exist:

> `regret_B` **T+ < T−** — obeying costs less when the trigger fires
> `advantage` **T+ > T−** — disobeying costs more when the trigger fires

Paired within twin, expected score, 378 pairs, 0 engine failures:

| quantity | T+ − T− | 95% CI | t | predicted |
| --- | --- | --- | --- | --- |
| `regret_b_xs` | **−0.1088** | [−0.1411, −0.0766] | −6.61 | negative ✓ |
| `advantage_xs` | **+0.1485** | [+0.1129, +0.1842] | +8.17 | positive ✓ |
| `b_valid` | **+0.4101** | [+0.3552, +0.4649] | +14.66 | — |
| `max_regret_in_b_xs` | −0.1081 | [−0.1403, −0.0758] | −6.57 | — |

Both directions of the transformation agree — built from a T+ source, −0.0871 / +0.1202; built from
a T− source, −0.1297 / +0.1756 — so the effect is not an artefact of which half was constructed.

**The engine's own best move is a queen promotion 41 percentage points more often when the promotion
square is safe.** That is the trigger governing the decision, stated in the units the published
screen uses.

---

## 4. Question 3 — is item difficulty doing the work?

Difficulty is measured by **what the position is worth**, `V*`, and not by the covariates the
transformation holds fixed. Using material or legal-move counts to argue the pair is matched would
be circular: the transformation pins them.

`V*` is **not** identical across a pair — mean gap **+0.1367** [+0.1002, +0.1733] in favour of the
`T+` half. That is expected rather than alarming: a promotion square that nothing attacks really is
worth more than one that is attacked. It is still an alternative explanation, so it is tested rather
than argued:

| subset | n | `regret_b_xs` | `advantage_xs` | `b_valid` |
| --- | --- | --- | --- | --- |
| all pairs | 378 | −0.1088 [−0.1411, −0.0766] | +0.1485 [+0.1129, +0.1842] | +0.4101 |
| **`V*` gap exactly zero** | **277** | **−0.1058** [−0.1414, −0.0702] | **+0.1039** [+0.0670, +0.1408] | +0.3682 |
| `V*` gap non-zero | 101 | −0.1172 [−0.1886, −0.0458] | +0.2709 [+0.1882, +0.3536] | +0.5248 |
| **one square moved AND `V*` gap zero** | **142** | **−0.1607** [−0.2161, −0.1053] | **+0.1537** [+0.0960, +0.2113] | +0.4507 |

On the **73.3%** of pairs whose two halves are worth *exactly the same* to the engine, the contrast
survives at full strength. On the strictest subset available — one piece moved one square, and the
two positions worth exactly the same — the regret effect is **larger** than on the full bank, not
smaller.

**Prescription size moves by +0.0003** [−0.0007, +0.0012]. The chance rate is the same on both sides
of the flip, which is exactly what `RC-06` could not achieve (.317 against .101) and what
`CRITERION_CHANNEL.md` showed was worth *d′* = 0.80 to a move-blind agent there.

---

## 5. The control, because a contrast without one is a story

`RNL-04`: *a gate that has not demonstrated failure is not a gate.* The obvious objection to §3 is
that the contrast is about **moving a piece**, not about the trigger. So a sham bank was built:

```text
real twin   T(P) = 1  ->  T(P')  = 0      the trigger flips
sham twin   T(P) = 1  ->  T(P'') = 1      the trigger does not
```

Same source position, one enemy piece relocated, trigger deliberately unchanged. **377 of 378 shams
move the same piece as their real twin**, and the target is chosen to match the real relocation's
distance where a legal square allows it.

| quantity | real twin | sham control | **difference of differences** |
| --- | --- | --- | --- |
| `regret_b_xs` | −0.1088 [−0.1411, −0.0766] | +0.0225 [−0.0020, +0.0470] | **−0.1313** [−0.1656, −0.0970] |
| `advantage_xs` | +0.1485 [+0.1129, +0.1842] | −0.0327 [−0.0602, −0.0052] | **+0.1812** [+0.1431, +0.2192] |
| `b_valid` | +0.4101 [+0.3552, +0.4649] | −0.1164 [−0.1675, −0.0653] | **+0.5265** [+0.4724, +0.5805] |
| `V*` | +0.1367 [+0.1002, +0.1733] | −0.0346 [−0.0592, −0.0100] | +0.1713 [+0.1354, +0.2072] |

**The sham effect is small and points the other way**, so subtracting it makes the trigger effect
*larger*, not smaller. Moving a piece does not produce the Gate B contrast.

The sham is not a clean zero — `advantage` and `b_valid` differ from zero by a little, in the
direction that an arbitrary enemy relocation slightly favours the mover. That is reported rather
than rounded away, and it is the reason the difference of differences is the estimate this file
carries rather than the raw contrast.

**No source position was re-searched for this control.** Their values came from the twin run through
the content-addressed cache — 2,268 searches not spent, and the first use of the rule that
`COMPUTE_VALUE_EXTRACTION.md` sets out.

---

## 6. What this does to Gate A's reading of `RC-05`

`ACTION_SET_AUDIT.md` §5 reports `RC-05` as **safe and barely necessary**: advantage on `T+` is
−0.0141 in the natural corpus, and separation of chance-corrected advantage is +0.0623, third-lowest
of seventeen.

The twin contrast puts advantage at **+0.1485**, and at **+0.1812** against the sham.

Both are correct, and the gap between them is the finding:

> **The natural-cell separation statistic that the entire seventeen-class screen is built on
> understates a rule class whose trigger is a local board fact.**

The natural contrast compares *different positions* — a T+ item and a T− item that share nothing but
a rule class — so the between-position variance swamps the effect. The twin contrast compares *the
same position with one square changed*, and the variance cancels. This is precisely the argument
Sheridan and Reingold's design principle makes, and it is now measured in this corpus rather than
cited.

**What follows for the measurement model**, added to `ACTION_SET_AUDIT.md` §7's revision: a class may
not be retired on a weak natural separation alone. A weak natural separation and a strong twin
contrast is the signature of a real rule measured by a noisy comparison.

---

## 7. Verdict, and the domain limit

```text
B-PASS
```

Against the mission's four outcomes:

- **not `B-CONFOUNDED`** — the effect is *stronger* on minimal pairs than on the natural sets, which
  is the opposite of the confounded signature.
- **not `B-PREDICATE-FAIL`** — `B` is a property of the move and is identical on both cells;
  prescription size differs by +0.0003.
- **`B-DOMAIN-LIMIT` applies in part, and is recorded rather than hidden**: **49% of `RC-05`'s items
  admit no minimal twin at all.** A promotion square attacked by two pieces cannot be freed by
  moving one; a position with no spare enemy piece cannot be made to attack the square without
  changing something else. The bank is therefore drawn from the half of the class that admits a
  single-piece flip, and that half may differ from the other in ways nothing here measures.
- **`B-PASS`** on the half that does: a valid rule-use task is admissible for humans on this bank.

### What `B-PASS` does not establish

**That the twins are ecological.** No human has seen either half of any pair. `observable_action` is
null on all 378 twins and all 378 shams, by construction. This is an item bank for a **presented**
task — L2 on the repository's ladder — and the target of the whole programme is L5.

**That the cue is recognisable.** `RC-05`'s trigger is *"a pawn can promote to a square nothing
attacks"*. Whether a player notices that during a game, without being told, is untested, has no gate,
and is `E2`'s central claim. `KNOWLEDGE_MAP.md` §D would call it focal only if the ongoing task
already processes it.

**That natural `T+` and `T−` sets are exchangeable.** Gate B's frame B1 — natural matching, and the
residual `max |SMD|` — is untouched here. What this file establishes is B2.

**Data:** `research/learning-v3/results/gate_b.json`, `minimal_twins.json`, `sham_control.json`,
`sham_twins.json`. The banks themselves are in `research/learning-v3/corpus/` and every evaluation
behind them is content-addressed there.
