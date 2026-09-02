# AMENDMENT CHAIN

> ### THESE NUMBERS EVALUATE THE RECONSTRUCTION STUDY.
> ### THEY ARE NOT A SCORE OF THE APPLICATION.
>
> Every figure below says how well this repository's operating system was *reconstructed*. None of
> them says the product is production-ready, the science is valid, or consolidation is safe.
> `SCORING_METHOD_V2.md` §7 lists what is knowingly outside them.

This file exists because the repository's own `RNL-10` says failed history is provenance, kept
unmodified with an explicit and scoped replacement pointer. Study v1's numbers were wrong. They are
therefore **kept**, with the pointer attached, rather than overwritten.

---

## The chain

### Study v1 — `d1db018`, 2026-09-02

| field | value |
| --- | --- |
| score | **97.78 / 100** |
| metric labelled *confidence* | **96.35 %** |
| verdict | `STRONG_REPO_NATIVE_OS` |
| kernel | 4 rules |
| laws | 16 repository-wide, 2 domain, of 18 candidates |
| authority questions | 24 / 24 resolved |
| contradictions | 16, 0 unresolved, 0 critical |
| method | [`SCORING_METHOD.md`](SCORING_METHOD.md) — **preserved unchanged** |

### Reason for amendment

Study v1 was reviewed by a pass whose stated job was to falsify it, not to confirm it. That pass
found **four methodological defects and ten new contradictions**, eight of the ten inside the
study's own artefacts. The two headline numbers were treated as hypotheses. Both were recomputed
from formulas written and frozen **before** the recomputation.

The governing principle is the study's own `K2`, turned on the study: *nothing gains authority until
a step ran that could have taken it away.* v1's `97.78` had never faced a scoring system capable of
producing a lower number, because v1 wrote the scoring system and the conclusions in one pass.

### Changed formulas

`A`, `B`, `C` and `F` are the defects the review mission named. `D`, `E` and `G` were found by
this pass while repairing them — `G` by attacking the repair for `B`.

| # | found by | v1 | v2 | why |
| --- | --- | --- | --- | --- |
| **A** | the mission | `D2 = 20 × repo_native_laws / candidates`, asserted to be promotion-neutral | `D2 = 20 × (0.35·separation + 0.40·κ + 0.15·falsification_coverage + 0.10·admissibility)` | v1's assertion was false: the function is monotonically increasing in the promotion rate, which is the thing under test. `SCORING_METHOD_V2.md` §0-A |
| **B** | the mission | `D1 = 20` for `169 / 169 governing files`, called *corpus coverage* | `D1a` governance 10 + `D1b` implementation 6 + `D1c` support 4, each with its own population and inspection mode | `169/169` is real; it is not repository coverage. 479 `authored-sot` files exist. §0-B |
| **C** | the mission | metric named *evidential confidence* | metric named **`WEIGHTED_EVIDENCE_SUPPORT` (`WES`)**, with `WES₉₀` reported beside it | the quantity is a weight-averaged evidence strength over conclusions the study *chose to publish*. It is not `P(correct)`. §0-C |
| **D** | **this pass**, via a control that failed | *(first draft of the corrected `D2`)* `rule_fidelity` = share of candidates where published class equals the bar's | Cohen's **κ**, chance-corrected | **found by `D2`'s own control before the v2 total was computed.** 16 of 18 candidates genuinely qualify, so a classifier that promotes all 18 scores 0.889 by construction. `P1` reached 12.11/20, above the stated limit. §0-D |
| **E** | **this pass**, by reading the computation | *(the first implementation of the corrected `D2`)* the "published" classification was **generated** by applying the bar to the evidence; `D6`'s grounding and the five `WES` ceilings were **entered by hand** | both sides read: the classification parsed from §B, the counts from the newly published [`LAW_SUPPORT.json`](LAW_SUPPORT.json), the domain counts re-derived from the corpus, every ceiling computed | `separation = 1.000` and `κ = 1.000` were structurally guaranteed, not measured. A comparison that cannot fail is not a step. §0-E |
| **F** | the mission | `D4 = 15 × 24 / 24` | `D4 = 15 × 25 / 36` | v1's numerator and denominator were chosen by the same reader in the same pass. Round one of the completeness attack found eight omitted questions and made it `24/32`; round two found **four more** and made it `25/36`, published as a **lower bound**. Six have **no authority at all**, and all six are operational. [`AUTHORITY_MAP_V2_ATTACK.md`](AUTHORITY_MAP_V2_ATTACK.md) |
| **G** | **this pass**, attacking the repair for B | `D1b`'s population was *"every implementation file named as evidence by a corpus case, an authority-map row, or a law's operational-instance list"* — all study artefacts | the **204** implementation files the 169 governance files name; `quoted` (**26**) derived by [`d1b_population.py`](d1b_population.py) rather than counted | fixing `D1a`'s denominator and leaving `D1b`'s self-chosen was a half-repair: cite 85 and quote 16 → `2.59/6`; cite only the 16 you quoted → `6.00/6`. §0-G |

Each correction was written into [`SCORING_METHOD_V2.md`](SCORING_METHOD_V2.md) **before** the
corrected figure was published. Defect D was found by a control that failed, with the study's own
total still uncomputed. Defect E was found later, by reading the computation rather than its
output, **after** a total of `91.82` had been produced; the response was the one the mission
specifies — freeze the result, document the defect, repair the method, rerun from scratch. The
frozen pre-repair total and the post-repair total are both `91.82`, and the measured disagreement
between the published classification and the bar is **0 of 18**. Defect G was found later still,
by the second adversarial pass attacking the repair for Defect B; the same four steps were followed
from the frozen `91.82`, and that one **did** move the number, to `91.56`. The same pass then
attacked `D4`'s repaired denominator and found four more omitted questions, taking it to `90.73`.
`ADVERSARIAL_REVIEW.md` Attacks 12–19 record all eight attacks and the two that landed.

### Changed classifications

| what | v1 | v2 | evidence |
| --- | --- | --- | --- |
| `RNL-12` inside kernel rule `K1` | in `K1` | **outside the kernel**, beside `RNL-09` | `X-26`, found by `selfcheck.py`. A domain law cannot sit inside a repository-wide kernel rule while its twin is excluded |
| kernel Jaccard | `1.44×` | **`1.39×`** | recomputed after `RNL-12` left `K1`. Every revision made it worse; every revision published the worse number |
| `G-02` "two enforced checks lack a control" | 2 | **5 blocking checks, 4 fixture-able, 1 (`npm audit`) where a synthetic control would be dishonest** | re-verification of Finding E against `.github/workflows/verify-build.yml` |
| `G-01` "one read site" | 1 | **4 read sites** in `LearningQueue.tsx` (15, 42, 111, 120) | re-verification |
| `X-02` and `X-16` "the same failure" | same | **same detection class, different cause and different repair** | a hand-written provenance record vs a stale machine output |
| authority questions | 24 | **36**, of which 25 resolved — and published as a **lower bound** | the completeness attack, two rounds |
| contradictions | 16 | **26** | `X-17` … `X-26` |
| law count and law text | 16 + 2 | **16 + 2, unchanged after re-testing** | the bar was re-applied mechanically; κ = 1.000 against it |
| kernel count | 4 | **4, unchanged after re-testing** | `X-18` was a publication drift, not a second taxonomy |

### Corrected result

| field | Study v1 | Study v2 | Δ |
| --- | ---: | ---: | ---: |
| score | 97.78 / 100 | **90.73 / 100** | **−7.05** |
| threshold > 95 | MET | **NOT MET** | |
| evidence metric | 96.35 % *(named confidence)* | **96.74 `WES`** *(named weighted evidence support)* | not comparable |
| `WES₉₀` | not computed | **100.00 %** | |
| threshold > 95.5 | MET | **MET** | |
| verdict | `STRONG_REPO_NATIVE_OS` | **`PARTIAL_REPO_NATIVE_OS`** | downgraded |

**The two metric figures are not comparable and the table says so rather than showing a delta.**
v1 averaged 52 conclusions at `Σw = 96`; v2 averages 83 at `Σw = 144`. Different conclusion sets,
different populations. Worse, the movement inside v2 is itself an illustration of the metric's
declared limitation: publishing Defect E — one new conclusion, weight 2, strength 1.00 — moved
`WES` `96.46 → 96.52`, Defect G `→ 96.57`, and the second adversarial pass's own findings
`→ 96.74`, rising three times in the pass in which the score fell twice. **Adding a well-evidenced
conclusion raises the mean.** That is
recorded here rather than smoothed away, because it is the exact behaviour `SCORING_METHOD_V2.md`
§6 names as unrepaired: `WES` cannot see an omitted conclusion, and it rewards publishing strong
ones. It is why the figure is not called a confidence.

Where the 5.96 points went, exactly:

```
D1a governance evidence           0.00   169 of 169 governing files classified
D1b implementation evidence      −3.67   26 of the 204 files governance names are QUOTED
D1c support evidence             −0.02   2,928 of 2,954 tests executed
D4  authority resolution         −4.58   25/36, not 24/24
D5  falsifiability               −0.83   RNL-17 carries no counterexample search at all
D3  contradiction resolution      0.00   26/26 classified, 0 unresolved, 0 critical
D6  operational grounding         0.00   16/16 repo-wide laws with >=2 executed enforcements
D2  classification quality       +2.06   the corrected formula scores the analysis higher
                                 ─────
                                 −7.05
```

**`D2` rose.** The dimension that was rewriting itself to remove a promotion incentive gave the
study *more* credit once it measured discrimination instead of generosity — separation `1.000`,
κ `1.000`. The score fell because of coverage and authority, which is where the study was actually
weak, and not because the corrected formula was hostile.

**Both losses are denominators the study used to control.** `D1b` and `D4` together account for
`−8.25` of the `−7.05`; everything else nets `+1.20`. The single repeated defect across v1 and v2
was the same one: **a ratio whose numerator and denominator were chosen by the same reader in the
same pass.** It appeared in `D2` (Defect A), in `D4` (Defect F), in `D2` again one level down
(Defect D), in the comparison itself (Defect E) and in `D1b` (Defect G). Five of the seven defects
are one defect wearing five hats.

---

## What did not change, and why that matters

The mission permitted every one of these to fall. None did, and each was re-tested rather than
carried forward:

- **the four kernel rules** — re-derived; `X-18`'s "five" was a stale draft in one file, not a rival taxonomy;
- **the score itself, across the Defect E repair** — `91.82` before and after a repair that could have moved it (Defect G took it to `91.56`, and round two of the authority attack to `90.73`);
- **sixteen repository-wide laws** — the bar was re-applied mechanically to all 18 candidates and the published classification agrees with it exactly (κ = 1.000);
- **`0` unresolved and `0` critical contradictions** — after the count rose from 16 to 26;
- **28 gates green, 28 controls red** — re-executed;
- **both B3 verdicts** — re-reproduced from the committed analyses.

A result that survives an attack designed to break it is worth more than the same result asserted
once. That is `K2` again, and it is the only reason these five are still standing.

---

## What a reader should take from the movement

`97.78 → 91.82 → 91.56 → 90.73` is not a discovery that the repository got worse. Nothing in the repository changed
between the two numbers. It is a discovery that **v1's instrument could not read low**, in three
specific places: it scored a subset as if it were the whole, it counted its own questions as its own
denominator, and its central dimension paid for promotion.

The repository's own idiom for this is `RNL-04`: *a gate that has not demonstrated failure is not a
gate.* v1's score had never demonstrated failure. It has now.
