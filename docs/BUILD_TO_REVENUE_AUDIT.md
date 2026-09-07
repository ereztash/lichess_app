# Build-to-Revenue Evidence Audit

**Canonical state:** `main@2390b3510f798cd40e5ae5fd21573edb5e965181` (2026-09-06)
**Purpose:** input to a White Paper update and a commercial roadmap. Research only. No product
change is proposed or made by this document.
**Access date for every external source:** 2026-09-06.

Every claim below carries one label. Nothing is presented as fact that is not `REPO_EVIDENCE` or
`EXTERNAL_EVIDENCE`.

| label | meaning |
| --- | --- |
| `REPO_EVIDENCE` | read in this tree at the SHA above, with a path |
| `EXTERNAL_EVIDENCE` | read on a named external source, with a URL and access date |
| `INFERENCE` | derived from the two above, and derivable by the reader |
| `COMMERCIAL_HYPOTHESIS` | a belief about a market, not yet tested |
| `PRICING_HYPOTHESIS` | a price not observed in the market as stated |
| `FIELD_REQUIRED` | closable only by a real user, never by more browsing |
| `OWNER_REQUIRED` | closable only by a decision the owner has not recorded |

---

## BLUF

1. **First buyer to test: the chess coach**, and specifically a coach who already sells hours.
2. **Why:** the coach is the only candidate whose substitute has an observed price
   (`EXTERNAL_EVIDENCE`: $20 to $75 per hour on the Lichess coach directory), and the only one who
   buys once and consumes many times. The player's substitute is a $4.85 to $15 per month
   subscription, which is a far weaker price signal per test.
3. **Minimum sellable configuration:** one written, population-corrected decision report on one
   named player's public game archive, produced by the owner from the frozen research pipeline.
   Not the app.
4. **Sellable today with no build:** longitudinal decision evidence, recurring-pattern analysis
   against a same-rating population model, and a structured, preregistered review that is allowed
   to return nothing. All four are inside the current evidence ceiling.
5. **Minimum build required for a first payment: none.** There is no payment code in the tree and
   none is needed. Invoice out of band, deliver a document.
6. **Earliest credible route to first payment:** three named prospects, one price, three reports.
   The capability is present today; the demand is unmeasured.
7. **Still FIELD:** whether anyone pays, at what price, whether the report changes behaviour,
   whether a second one is bought, and how much owner time one report actually costs.
8. **Defer:** platform / API, multi-tenancy, billing infrastructure, self-serve coach seats, and
   the English interface. Each of them is expensive and none of them is required to learn whether
   a buyer exists.
9. **The hard constraint nobody has priced yet:** the interface is Hebrew-only by design, and the
   repository says translating it is not a formatting job. That constrains the *app* to Hebrew
   readers. It does not constrain the *report*, which is why the report is the first product.
10. **Do not sell the owner's finding.** R\* and R\*\* are the owner's, on the owner's record. What
    generalises is the procedure and the population baseline, not the result.

---

## A. Canonical State

`main` is `2390b3510f798cd40e5ae5fd21573edb5e965181`, the merge of PR #91
(`research/rstarstar-mechanism-decomposition`). Read at that SHA.

### What exists in the running product

All `REPO_EVIDENCE`.

| capability | state on `main` | where |
| --- | --- | --- |
| Cold entry with no account, two routes | present, walked in Chromium at 390x844 | `docs/PRE_RELEASE_STATE.md`; `tests/layout/a-stranger-takes-their-first-decision.layout.test.ts`, 9 of 9 pass |
| Import a player's own games, no credential, no token | present, Lichess and Chess.com public endpoints read straight from the browser | `client/src/lib/lichess-public.ts`, `client/src/lib/chesscom-public.ts`, `client/src/lib/fetch-games.ts` |
| Import cap | 50 games | `client/src/lib/game-source.ts:131` |
| Local engine scoring of a whole game | present, Stockfish 18 Lite WASM in the browser | `client/src/lib/batch-analysis.ts` |
| Decision captured before the engine speaks | present, and it is the product rule | `README.md`; `shared/record-service.ts`; gate `GATE-COMMIT` |
| Population comparison on screen | present, 693,130 scored moves | `shared/record-dashboard.ts`, `shared/population-baseline.ts`, `tests/client/population-on-screen.test.tsx` |
| Longitudinal record, calibration, stability, sensitivity | present | `shared/record-dashboard.ts`, `shared/detector.ts` |
| Persistence for a non-owner | browser `localStorage` only | `client/src/lib/local-record-store.ts`, key `decision-lab.record.v1` |
| Record export | JSON download plus a clipboard report, from the self-check drawer | `client/src/components/SelfCheck.tsx:141,175` |
| Production route | serving, with a scheduled deployed check whose three positive controls go red under deliberate break | `docs/PRE_RELEASE_STATE.md` |
| Repository gates | 35, each with a deliberate positive control, all passing | `docs/GATES.md`, `npm run gates`, `npm run gates:controls` |

### What does not exist, and in one case cannot exist without a deliberate reversal

| capability | state | where |
| --- | --- | --- |
| Account / user separation for the record | **absent by gate and by schema at once.** `TENANCY = "single"`. Every record procedure sits behind `ownerProcedure`; no record table carries an owner column; no query carries an owner predicate | `shared/tenancy.ts`, `server/_core/owner.ts`, `server/recordRouter.ts`, `tests/server/one-record-one-person.test.ts` |
| Server persistence for a customer | absent. The server holds one person's record, the one `OWNER_OPEN_ID` names | same |
| Sharing, coach sees student data | absent. No share surface exists in `client/src` | source scan at this SHA |
| Human-readable report artifact | absent. Export is raw JSON | `client/src/lib/local-record-store.ts:409` |
| Payments, billing, plans, subscriptions | absent. No payment dependency in `package.json`. The only occurrence of the word in the tree is `payment=()` in the Permissions-Policy header | `package.json`, `vercel.json:21` |
| Permissions model | binary: owner or refused | `server/_core/owner.ts` |
| Coach, academy, student, teacher entities | absent | source scan at this SHA |
| English interface | absent. `INTERFACE_LANGUAGE = "he"`, `dir="rtl"`, 931 Hebrew strings across 115 files | `shared/interface-language.ts`, `client/index.html:2` |

`REPO_EVIDENCE`, verbatim from `shared/interface-language.ts`: translating those strings "is not a
formatting question: the copy IS the measurement stimulus ... Two languages would be two
populations and would need a field arm each."

### What exists in the research layer and is directly reusable as a service

`REPO_EVIDENCE`.

- `research/mechanism/chesscom/replicate_prelearning.py` takes `--pgn --engine --book-keys --out`
  and applies the frozen predicate to an arbitrary PGN corpus. One constant is hardcoded:
  `PLAYER = "ereztal-shir"`.
- `research/mechanism/analysis/population.py` computes a player's residual elevation against a
  population model fit on other players.
- `research/mechanism/analysis/field_eval.py`, `invariance.py`, `predict.py`, `stability_loco.py`
  are the rest of the frozen chain.
- **This chain has already been run end to end on a corpus that was not the owner's Lichess
  account.** 50 supplied Chess.com games, 48 admitted, 1,040 board-eligible decisions, 142 frozen
  R\*\* opportunities, 2,070 positions scored, zero parse errors, workflow run `33992527252`
  (`research/mechanism/chesscom/CROSS_PLATFORM_DISPOSITION.md`).

`INFERENCE`: the concierge delivery mechanism is not a plan. It has already executed once, in CI,
on someone's game file. What has never happened is a person paying for its output.

### The evidence ceiling this document is bound by

`REPO_EVIDENCE`, from `research/mechanism/NETA_FINDING.json` and `README.md`.

| claim | state | permission |
| --- | --- | --- |
| C1 recurring region on the owner's record, invariant across strata | `SUPPORTED` | `ALLOW` / discriminate |
| C2 the region predicts future unseen games | `SUPPORTED` | `ALLOW` / discriminate |
| C3 structure is level-typical, owner near the population median | `SUPPORTED` | `ALLOW` / hypothesise |
| C4 narrow personal residual after population correction | `SUPPORTED` | `ALLOW` / hypothesise |
| C5 the frozen instruction as an intervention | `INSUFFICIENT_REALITY` | `DEFER` |
| C6 the instruction reduces the error rate | `INSUFFICIENT_REALITY` | **`DENY`** |

Cross-platform: `PARTIAL_CROSS_PLATFORM_REPLICATION`. The board region transfers to Chess.com
(+9.43 pp, z = 3.27). The narrower persistent-non-resolution localisation does **not**, on six
comparison events. Status `INSUFFICIENT_CROSS_PLATFORM_SUPPORT`.

**A paid pilot may sell:** longitudinal decision evidence, recurring-pattern analysis, comparison
against population patterns, a structured review of decision processes.

**A paid pilot may not sell:** proven Elo improvement, proven behavioural change, cognitive
diagnosis, proven causal mechanism. Nor, per `RSTARSTAR_MECHANISM_LOCALIZATION.md`, tunnel vision,
"you did not see it", attention failure, calculation-depth failure, or rushing as a cause.

**One further boundary this audit adds, and it is commercial rather than scientific.** R\* and
R\*\* were discovered on the owner's record. `README.md` states plainly that the repository does
not establish that one player's result generalises to another. So the sellable object is not
"we will find your pattern". It is "we run a frozen procedure on your record and report what it
finds, including finding nothing". A concierge offer written any other way is outside the ceiling.

---

## B. Buyer Ranking

No composite score. A single number here would add a coach's willingness-to-pay evidence to a
build burden measured in developer days, and those do not share a unit. The ranking is a reading
of the rows, and the reading is stated after the table.

| Buyer | Pain | Existing WTP evidence | Decision Lab advantage | Build burden | Field burden | Revenue speed | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **A. Serious player** | wants to know what is wrong with their play beyond a centipawn number | **strong and observed.** Aimchess $7.99/mo, $57.99/yr `EXTERNAL_EVIDENCE`; Chess Dojo $15/mo, $120/yr `EXTERNAL_EVIDENCE`; Chess.com paid tiers in the same band, secondary sources only | population-corrected personal residual; a report allowed to return null; pre-engine capture in the app | **high for self-serve** (Hebrew-only UI, no accounts, no payments); **zero for concierge** | who pays, at what price, and whether a null result is acceptable to them | fast for a one-off, slow for recurring | **second.** Test only after a coach signal, or in parallel at the same price point |
| **B. Chess coach / academy** | unpaid preparation time; must decide what to work on with each student | **indirect and observed.** Coach hourly rates $20 to $75 on the Lichess directory `EXTERNAL_EVIDENCE`. No observed price for a coach-facing analysis tool: the coach platforms found are free to start `EXTERNAL_EVIDENCE` | the only per-student object no competitor produces: an out-of-sample, population-corrected decision reading with a preregistered null | **zero for concierge**; very high for self-serve (needs multi-tenancy, which is gated shut) | whether it saves prep time at all, and whether the coach or the student pays | fastest, and repeatable per student | **first.** Concierge only. Sell the object, never the prep-time saving |
| **C. Platform / API** | none stated by anyone | none found | none that survives without paid evidence upstream | very high | total | slowest | **`DEFER`.** See section C footnote |

**The reading.** Coach first, for three reasons that do not need to be summed.

1. The coach's substitute has an observed hourly price. The player's substitute is a subscription
   at $4.85 to $15 per month, so a player test can only ever produce a price signal inside that
   band, while a coach test can probe a band anchored to billable hours.
   (`EXTERNAL_EVIDENCE` + `INFERENCE`.)
2. One coach who buys is many reports. One player who buys is one report. The same test cost
   returns more information about repeatability. (`INFERENCE`.)
3. Both routes require identical build, which is none. So the ordering costs nothing to get wrong
   and can be run concurrently if prospects exist for both. (`REPO_EVIDENCE` + `INFERENCE`.)

**The counter-argument, stated because it is real.** The coach's reason to buy is prep time saved,
and prep time saved is exactly the quantity with no evidence anywhere in this repository or
outside it. `FIELD_REQUIRED`. The resolution is not to abandon the coach; it is to refuse to make
the claim. Sell the object and let the coach form the time hypothesis. A seller who asserts hours
saved has left the evidence ceiling on the commercial side rather than the scientific one, which
is the same failure.

### C. Platform / API: `DEFER`

The question is not whether an API is buildable. It is whether it is a rational allocation before
any paid evidence exists in Player or Coach. It is not, on three grounds.

- There is no second tenant to serve. `TENANCY = "single"` is enforced by gate and schema
  together, and `shared/tenancy.ts` states that a record table gaining a `user_id` while no query
  carries an owner predicate would serve one person's rows to another. Any API is downstream of
  breaking that deliberately. `REPO_EVIDENCE`.
- No prospect has been named. There is no inbound request in the tree, no partner, no integration
  discussion. `REPO_EVIDENCE` by absence.
- The concierge route reaches revenue without it. `INFERENCE`.

`DEFER` until a buyer has paid twice and asked for programmatic access by name.

---

## C. Build-to-Revenue Gap

"First paid pilot" means: money changes hands for one delivered report, once.

### Buyer A, Serious player

| Capability | Exists on `main`? | Required for first paid pilot? | Can be concierge? | Build required? | Evidence | Effort confidence |
| --- | --- | --- | --- | --- | --- | --- |
| Get the player's games | yes, and with no credential | yes | yes, public archive URL | none | `REPO_EVIDENCE` `lichess-public.ts`, `chesscom-public.ts` | high |
| Score the games with an engine | yes, two paths: browser WASM and the research chain | yes | yes | none | `REPO_EVIDENCE` `batch-analysis.ts`; `replicate_prelearning.py` | high |
| Frozen predicate + population correction | yes, research layer | yes | yes | none, except one hardcoded player constant | `REPO_EVIDENCE` `analysis/population.py`; `replicate_prelearning.py:15` | high |
| Human-readable report | **no** | yes | **yes, written by the owner** | none for the pilot | `REPO_EVIDENCE`, export is JSON only | high |
| Onboarding into the app | yes, no account | **no** | n/a | none | `REPO_EVIDENCE` `PRE_RELEASE_STATE.md` | high |
| Account / user separation | **no, gated shut** | **no** | n/a | large, and a deliberate reversal | `REPO_EVIDENCE` `tenancy.ts` | high |
| Persistence across devices | no, browser-local | **no** | n/a | large | `REPO_EVIDENCE` `local-record-store.ts` | high |
| Payments / billing | **no** | **no** | **yes, invoice or transfer** | none | `REPO_EVIDENCE` `package.json`, `vercel.json:21` | high |
| Progress / history over time | yes, locally | no, not for report one | yes, rerun the pipeline | none | `REPO_EVIDENCE` `record-dashboard.ts` | high |
| Hebrew-only interface | yes, Hebrew-only | **no**, if the deliverable is the report | n/a | very large | `REPO_EVIDENCE` `interface-language.ts` | high |
| Privacy posture for someone else's data | partial | yes | yes, but see below | none for the pilot | `REPO_EVIDENCE` `docs/RETENTION.md` | medium |
| Support burden | unmeasured | yes | yes | none | `FIELD_REQUIRED` | low |

### Buyer B, Chess coach / academy

Coach workflow, mapped stage by stage. `CURRENT COACH TASK` and `TIME / COST` are
`COMMERCIAL_HYPOTHESIS` unless marked, because no measured coach time budget was found.

| Coach task | Time / cost | Can Decision Lab replace or compress it? | Current product support | Manual / concierge option | Build required | Measurable ROI |
| --- | --- | --- | --- | --- | --- | --- |
| Pull the student's recent games | minutes | no, this is already cheap everywhere | full, by username, no credential | n/a | none | none |
| Review those games for mistakes | the bulk of unpaid prep; magnitude `FIELD_REQUIRED` | partly. It reports where risk concentrates, not what to teach | app does this for the account at the keyboard only | **yes**, owner delivers the reading | none for pilot | **`FIELD_REQUIRED`.** Do not assert hours |
| Identify recurring weaknesses | recurring across sessions | **yes, and this is the strongest fit.** Frozen predicate search plus held-out validation is exactly a recurrence test | research layer, not the product surface | **yes** | none for pilot | `FIELD_REQUIRED` |
| Separate "this student" from "everyone at this rating" | rarely done at all | **yes, and this is the differentiator.** Population model, 34,794 same-rating decisions, holdout AUC 0.77 | population baseline is on screen in-app; the residual model is research-side | **yes** | none for pilot | `FIELD_REQUIRED` |
| Prepare the next lesson | per lesson | partly. It narrows what to look at | no lesson-planning surface exists | yes, as a written recommendation inside the ceiling | none for pilot | `FIELD_REQUIRED` |
| Choose positions to drill | per lesson | yes in principle; the drill and transfer machinery exists | present in-app for the owner only | yes, positions listed in the report | none for pilot | `FIELD_REQUIRED` |
| Track a student over time | ongoing | yes, by rerunning on new games | in-app for one account only | yes, a second report | none for pilot | `FIELD_REQUIRED` |
| Personalise across students | ongoing | yes per student, one report each | **no**, single tenancy | yes, N separate reports | large for self-serve | `FIELD_REQUIRED` |

| Capability | Exists on `main`? | Required for first paid pilot? | Can be concierge? | Build required? | Evidence | Effort confidence |
| --- | --- | --- | --- | --- | --- | --- |
| Coach sees student data | **no** | yes | **yes, the report is the artifact** | none for pilot; large for self-serve | `REPO_EVIDENCE`, no share surface | high |
| Multi-student separation | **no, gated shut** | **no**, one report per student | yes | large, and a deliberate reversal of `one-record-one-person.test.ts` | `REPO_EVIDENCE` `tenancy.ts` | high |
| Student consent / privacy handling | not modelled | **yes** | yes, by written consent before the archive is pulled | none for pilot | `REPO_EVIDENCE` `docs/RETENTION.md` states the username leaves the browser; nothing models third-party consent | medium |
| Coach seats, permissions, billing | **no** | **no** | yes, one invoice | large | `REPO_EVIDENCE` | high |
| Report in the coach's language | n/a, the report is written by hand | yes | yes | none | `INFERENCE` | high |

**The single most important row in both tables:** payments. Nothing needs to be built to receive
the first money. There is no Stripe, no Paddle, no plan model, and none is required. An invoice and
a bank transfer close the loop, and building billing before a buyer exists would be infrastructure
purchased to answer a question it cannot answer.

**The second most important row:** consent. The player's own games are public, so pulling them
needs no credential. A coach handing over a student's username is a third party's data, and the
repository models a single owner's record and nothing else. This is not a build item for the pilot;
it is a written consent line the owner must obtain before the first coach report. `OWNER_REQUIRED`.

---

## D. Competitive Value Gap

Only distinctions that would change positioning or roadmap. No completeness matrix.
`docs/COMPETITIVE_BENCHMARK.md` (2026-08-22) already holds the wide comparison and is not repeated.

`EXTERNAL_EVIDENCE`, accessed 2026-09-06.

| product | price | what it is | source |
| --- | --- | --- | --- |
| Aimchess | $7.99/mo, $57.99/yr ($4.85/mo) | game analytics across six dimensions vs same-rating players; personalised puzzles; **coach sharing already exists** | [aimchess.com](https://aimchess.com/) |
| Chess Dojo | $15/mo, $120/yr | structured training program, levels 0 to 2500 | [chessdojo.shop/plans-pricing](https://www.chessdojo.shop/plans-pricing) |
| Chess.com paid tiers | Diamond around $14.99/mo, annual figures inconsistent across secondary sources; official page not machine-readable at access time | Game Review, insights, coach explanations | secondary only; treat as a band, not a figure |
| Lichess coach directory | **$20 to $75 per hour, observed on listings** | human coaching marketplace | [lichess.org/coach](https://lichess.org/coach) |
| Chessido, ChessPlay.io | free to start | chess academy management: classroom, homework, per-student analytics, rating sync | [chessido.com](https://www.chessido.com/blog/chess-academy-management-software/), [chessplay.io](https://chessplay.io/blog/5-essential-software-tools-every-online-chess-coach-needs-in-2025) |

### The four distinctions with decision value

Each is graded on three separate axes, because conflating them is how a roadmap gets built out of
a feature nobody wants.

**1. Pre-engine decision capture.**
`DIFFERENT`: yes, structurally. Every competitor's input is the move list after the fact. Decision
Lab's input includes what the player recorded before the reveal.
`VALUABLE`: plausible, unmeasured.
`PROVEN BUYER VALUE`: **no.** `docs/VALUE_CLARITY_FIELD_PROTOCOL.md` exists precisely to measure
whether a cold player can even reconstruct this distinction, and it has not been run.
**Roadmap consequence, and it is uncomfortable:** the concierge report is built on historical PGN,
which contains no confidence, no candidate list, no stated read. **The first sellable product does
not carry the product's headline differentiator.** That is a fact to write into the White Paper,
not to route around.

**2. Population correction that is allowed to remove the finding.**
`DIFFERENT`: partly. Aimchess already compares a player to their rating peers, so comparison itself
is commodity. What is not commodity is subtracting the population and reporting only the residual,
including the finding that most of an effect was level-typical, which is what `README.md` reports
about R\*.
`VALUABLE`: plausible for a coach, who needs to know whether a weakness is worth a lesson or is
just what 1600s do.
`PROVEN BUYER VALUE`: **no.** A buyer may prefer a flattering report. `FIELD_REQUIRED`.

**3. An admissible null.**
`DIFFERENT`: yes, and no competitor found does this. `refuted` and `retired` states, reversal
conditions on every claim, preserved failed designs.
`VALUABLE`: unknown, and possibly negative in a consumer market.
`PROVEN BUYER VALUE`: **no.** This is the sharpest single unknown in the whole audit: whether
anyone pays for a report that may say "nothing specific to you was found". `FIELD_REQUIRED`.

**4. Coach workflow.**
Decision Lab is **behind**, not ahead. Aimchess already lets a student share data with a coach.
Chessido and ChessPlay.io already own classroom, homework and per-student analytics, free to start.
**Roadmap consequence:** never position against Aimchess on "share with your coach", and never
build a classroom. The coach-facing claim must be about the object in the report, not about
workflow plumbing that is already free.

### The answer to the central question

> Which value object can Decision Lab supply that is not commodity among competitors?

`INFERENCE`, from the rows above: **an out-of-sample, population-corrected, preregistered reading
of one player's decisions that is permitted to return nothing.** Every competitor supplies a
finding by construction. None supplies a procedure with a declared null and a reversal condition.

Whether that is worth money is precisely what the first three sales are for.

---

## E. Economics

Bottom-up. No TAM. Scenarios, not forecasts.

### Observed market anchors

`EXTERNAL_EVIDENCE`, 2026-09-06, from the table in section D:

- personalised chess analysis subscription: **$4.85 to $15 per month**;
- human chess coaching: **$20 to $75 per hour**, listed rates;
- coach-facing management software: **free to start**, no observed paid tier.

`INFERENCE`: there is an unoccupied price point between a $8 subscription and a $50 coaching hour,
and the concierge report sits in it. That is not proof the point is occupiable.

### Player scenario

`PRICING_HYPOTHESIS P1 = $8/month` (set to the observed Aimchess price, not derived).
`PRICING_HYPOTHESIS P2 = $15/month` (set to the observed Chess Dojo price, not derived).

| MRR target | paying players at P1 ($8) | at P2 ($15) |
| ---: | ---: | ---: |
| $1,000 | 125 | 67 |
| $5,000 | 625 | 334 |
| $10,000 | 1,250 | 667 |

Recurring player revenue requires the self-serve app, which requires accounts, cross-device
persistence and, for a market beyond Hebrew readers, an English interface. All three are absent
and one of them is gated shut. `REPO_EVIDENCE`.

### Coach scenario

`PRICING_HYPOTHESIS C1 = $50/month per coach` (roughly one billed coaching hour at the middle of
the observed $20 to $75 range).
`PRICING_HYPOTHESIS C2 = $150/month per coach` (roughly three).

| MRR target | coaches at C1 ($50) | at C2 ($150) |
| ---: | ---: | ---: |
| $1,000 | 20 | 7 |
| $5,000 | 100 | 34 |
| $10,000 | 200 | 67 |

### Concierge scenario, which is the one that can actually run this quarter

`PRICING_HYPOTHESIS R1 = $150 per report` (two to seven billed coaching hours at observed rates).

| monthly revenue | reports per month at R1 |
| ---: | ---: |
| $1,000 | 7 |
| $5,000 | 34 |
| $10,000 | 67 |

**The binding constraint is the owner's hours per report, and it is not known.** Engine time is
cheap and already automated: 2,070 positions scored in one CI run for the 48-game Chess.com corpus
(`REPO_EVIDENCE`). The cost is interpretation and writing. Until one report is delivered under a
clock, every row above is arithmetic, not a business. `FIELD_REQUIRED`.

### Hybrid

`INFERENCE` only, and stated to show the shape rather than to predict: three coaches at C2 plus
forty players at P1 is $770 per month. The reason to note it is that it is the first configuration
in which the two revenue types would be tested against each other, and neither has been tested once.

---

## F. Parallel Roadmap

```text
                       GATE                    GATE                    GATE
                        |                       |                       |
EVIDENCE LANE   [ L6 field protocol ]---->[ instruction vs sham ]---->[ C5/C6 resolved ]
(frozen)         128 rated blitz games    within-game contrast      intervention claim
                 alternating blocks       >= 4 pp or reversal       becomes sellable
                 owner's own games        analysis/field_eval.py    or is retired
                        |                       |                       |
                 owner PLAYS               owner does not             nothing on the
                 3 to 5 weeks              touch the product          product surface changes
                        |                       |                       |
- - - - - - - - - - - - + - - - - - - - - - - - + - - - - - - - - - - - + - - - - - - - -
                        |                       |                       |
REVENUE LANE    [ G1 will anyone pay ]--->[ G2 does it change ]--->[ G3 will they buy
(unfrozen)       3 concierge reports       anything                    a second one ]
                 no build at all           14-day follow-up            second report
                        |                       |                       |
                 owner WRITES              owner asks                  only here does
                 hours unmeasured          one question                a build become rational
                        |                       |                       |
                        v                       v                       v
                  first payment          first evidence of         repeatable revenue
                                          delivered value           hypothesis
```

**Can they run in parallel? Yes, and the reason is specific.**

`REPO_EVIDENCE`, `NETA_FINDING.json` `must_not_change`: the predicate, class definition, engine
regime, judge and block schedule may not change once the first field block is read, and
"intervention and measurement may not change together". A concierge report applies the same frozen
predicate to a **different person's** games. It reads nothing from the owner's field arm, writes
nothing into it, and changes no threshold. `INFERENCE`: the lanes are independent.

**The one resource they do share is the owner.** The evidence lane needs the owner to *play* 128
rated blitz games in 3 to 5 weeks. The revenue lane needs the owner to *write*. Those are different
hours, which is why the parallel is real rather than nominal. `INFERENCE`.

### Gates, stated as gates

| # | Uncertainty | Cheapest test | Pass condition | What it unlocks | Next investment |
| --- | --- | --- | --- | --- | --- |
| **G1** | Will anyone pay for a population-corrected reading that may return null? | 3 concierge reports offered to 3 named prospects at `R1` ($150). Zero build. | at least 1 pays **before** delivery | the right to spend anything on repeatability | parameterise `PLAYER` in `replicate_prelearning.py`; a report template. Under a day. |
| **G2** | Does the report change what the buyer does? | one question, 14 days after delivery: what did you do differently | 2 of 3 name a concrete change in what they work on | the right to talk about recurring pricing | a second-report offer |
| **G3** | Will a buyer pay again? | offer report two after roughly 40 new games | at least 1 renews at the same price | the subscription hypothesis, and only now a self-serve build | account model, persistence, and the deliberate reversal of `one-record-one-person.test.ts` |
| **G4** | Does the instruction reduce the error? (evidence lane, independent) | the already-frozen L6 protocol, unchanged | per `NETA_FINDING.field_requirement` | C5 and C6 move off `DENY` | nothing on the product surface |
| **G5** | Does self-serve require English? | only asked after G3 | n/a | the international market | full translation programme plus a field arm per language |

**Do not reorder G3 before G1.** Every self-serve capability in section C is downstream of a
question that costs one email to ask.

---

## G. Time-to-Revenue

Four different quantities. They are not the same and are not presented as such.

### `TIME_TO_FIRST_PAYMENT`

- **Minimum path:** name 3 prospects, state one price, deliver one report, invoice.
- **Dependencies:** a prospect list (`OWNER_REQUIRED`); a price (`PRICING_HYPOTHESIS R1`); an
  invoice route (`OWNER_REQUIRED`); written consent if the subject is a coach's student
  (`OWNER_REQUIRED`).
- **Known:** no build blocks it. The pipeline has already run on a supplied PGN in CI.
  `REPO_EVIDENCE`.
- **Estimated:** nothing. There is no estimate here because there is no denominator: no prospect
  has been approached.
- **Confidence:** high that the *capability* exists. Zero that *demand* exists.
- **What could delay it:** the absence of a prospect list; the owner's own hours; a consent
  question on student data that nobody has drafted.

### `TIME_TO_FIRST_REPEAT_PURCHASE / RENEWAL`

- **Minimum path:** first delivery, then enough new games to justify a second reading.
- **Dependencies:** the buyer's own play rate. `REPO_EVIDENCE` for scale: the frozen field
  protocol assumes 128 rated blitz games take the owner 3 to 5 weeks; a corpus of roughly 40 to 50
  games is what the Chess.com replication used.
- **Known:** the pipeline reruns cheaply.
- **Estimated:** weeks, not days, and the number is the buyer's, not ours.
- **Confidence:** low.
- **What could delay it:** a buyer who plays slowly; a first report that returned a null and left
  nothing to re-measure.

### `TIME_TO_REPEATABLE_REVENUE`

- **Minimum path:** G1, then G2, then G3, plus a **measured** delivery cost per report.
- **Dependencies:** all of the above, plus one number nobody has: owner hours per report.
- **Known:** nothing yet.
- **Estimated:** not estimated. `FIELD_REQUIRED`.
- **Confidence:** n/a.
- **What could delay it:** a delivery cost that makes `R1` unprofitable, which is the most likely
  single failure of this whole plan and is invisible until report one is written under a clock.

### `TIME_TO_PAYBACK`

**`OWNER_REQUIRED`.** The repository contains no definition of an investment base, so there is no
denominator, and inventing one would be exactly the manufactured certainty this project spends its
gates on.

The owner must answer, in writing, before any payback figure is produced:

1. Does the investment base include **sunk development time to date**, yes or no?
2. If yes, **how many hours**, and **at what hourly value**? The repository records commits, not
   hours, so both numbers must come from the owner.
3. Or is it **future cash spend only**? If so, which lines: hosting, database, domain, CI minutes,
   engine compute?
4. Were any **contractors** paid? If so, how much?
5. Is **opportunity cost** of owner time included, and at what rate?
6. Is payback measured on **gross revenue**, or on revenue **minus per-report delivery time** at
   the rate from question 5?

Until 1 through 6 are answered, this document reports no payback period and no break-even count.

---

## H. What the White Paper can now claim

Drop-in text. Every sentence is inside the ceiling in section A.

> **What is already built.**
> Decision Lab records a player's decision before an engine speaks, and preserves that record
> across games. A visitor needs no account: the application reads their public Lichess or
> Chess.com archive directly from the browser with no credential, scores it with a local engine,
> and compares their accuracy per position class against a baseline built from 693,130 scored
> moves. The build carries 35 repository gates, each paired with a deliberate positive control.
> Separately, a frozen research pipeline can search a player's record for a recurring decision
> region, validate it on games never used to find it, correct it against a model fit on 34,794
> same-rating decisions, and report whichever part survives. That pipeline has already been run
> end to end on a supplied game archive from a second platform.

> **What is not built, and is not claimed.**
> There is no multi-user record, no coach view, no sharing, no payments and no billing. The
> interface exists in one language. The product does not claim to improve chess performance or
> rating, does not diagnose attention or calculation, and does not establish that the proposed
> instruction reduces errors. That last question is frozen for a prospective field test and is
> currently denied as a claim.

> **Who can pay for it first.**
> A chess coach, for a written, out-of-sample reading of one student's decision record. Coaching
> hours are listed publicly at $20 to $75 per hour, and preparation time is unpaid. The report is
> produced by hand from the existing pipeline, so nothing has to be built to sell one.

> **The economic value we believe the buyer receives, and the evidence for it.**
> The buyer receives one thing no competing product supplies: a reading of one player's decisions
> that has been corrected against same-rating behaviour and is permitted to conclude that nothing
> player-specific was found. The evidence that this reading is producible is in the repository:
> a region discovered on a frozen window, validated on a later window, tested once on the newest
> games, invariant across opening family, colour, phase, speed, standing and clock state, and then
> substantially reduced by population correction, with only a narrow residual surviving.
> **The evidence that a buyer values it does not exist.** No one has been offered it.

> **The minimum missing to test the business.**
> Three named prospects, one price, and three delivered reports. No code.

> **What we will test first.**
> Whether anyone pays before delivery. Then whether the report changed what they worked on. Then
> whether they buy a second one.

> **What we will allow ourselves to build if it works.**
> Only after a second purchase: an account model, cross-device persistence, and a report the
> product generates rather than a person. Not before, and not billing infrastructure, and not an
> API.

---

## I. What must remain explicitly unknown

`FIELD_REQUIRED` unless marked otherwise. None of these is closable by more browsing, and this
audit stops here for that reason.

1. Whether anyone pays for a decision report at any price.
2. The actual willingness to pay, for a coach and for a player, separately.
3. Whether the report saves a coach any preparation time, and how much.
4. Whether a buyer accepts a report that returns a null result.
5. Decision Lab's conversion, retention, renewal and CAC.
6. Whether any player's behaviour changes after reading a report.
7. Owner hours per delivered report, which decides whether `R1` is a business or a hobby.
8. Whether the R\*/R\*\* procedure finds anything at all on a player who is not the owner. The
   repository explicitly does not establish that one player's result generalises.
9. Whether the frozen instruction reduces the error rate. `NETA_FINDING` C6, permission `DENY`,
   resolvable only by the L6 protocol.
10. The investment base, and therefore payback. `OWNER_REQUIRED`, six questions in section G.
11. Whether an English interface is required for a viable market, and at what cost.
    `OWNER_REQUIRED` for the decision, `FIELD_REQUIRED` for the need.

---

## J. Highest-RTD Next Actions

Five. In order. Actions 1 and 2 have no code in them.

### 1. Write the prospect list and the consent line

- **Decision it resolves:** whether a G1 test can start at all, and on whom.
- **Expected decision value:** highest available. Every other action is blocked behind it, and it
  is the only one nobody but the owner can do.
- **Cost:** one sitting. Five to ten named coaches or players who read Hebrew or accept an English
  report, plus one written sentence obtaining consent to pull a named third party's public archive.
- **Stop condition:** five names exist, or fewer than three can be named, in which case the coach
  buyer is not testable and the ranking in section B must be re-read before anything is built.

### 2. Offer three paid reports at `R1` before writing any of them

- **Decision it resolves:** G1, whether anyone pays.
- **Expected decision value:** it is the only action that can invalidate the entire commercial
  thesis at near-zero cost, and it does so before any delivery work.
- **Cost:** three messages. No build, no code.
- **Stop condition:** one payment received, or all three decline. A decline with a stated reason is
  a result and is recorded; a decline with no reason is not, and the reason must be asked for once.

### 3. Deliver report one under a clock

- **Decision it resolves:** the delivery cost in owner hours, which is the number that decides
  whether `R1` is viable at any volume.
- **Expected decision value:** high, and it cannot be obtained any other way. Section E is
  arithmetic until this number exists.
- **Cost:** one report, plus a timer. Parameterise `PLAYER` in
  `research/mechanism/chesscom/replicate_prelearning.py`, which is one constant.
- **Stop condition:** one report delivered and its hours recorded. Do not write a second before the
  first has been paid for and timed.

### 4. Run the frozen L6 field protocol, unchanged

- **Decision it resolves:** C5 and C6, the intervention and outcome claims currently at
  `DEFER` and `DENY`.
- **Expected decision value:** it is the only thing that can move the evidence ceiling, and the
  ceiling is what limits what may ever be sold.
- **Cost:** 128 rated blitz games in alternating blocks, 3 to 5 weeks of the owner's playing time.
  Nothing on the product surface changes.
- **Stop condition:** 430 instruction-arm opportunities or 60 days, per
  `NETA_FINDING.field_requirement`. Do not amend the predicate, the class, the engine regime, the
  judge or the block schedule after the first block is read.

### 5. Ask the six payback questions and record the answers in the tree

- **Decision it resolves:** the investment base, and therefore whether any payback figure may ever
  be stated.
- **Expected decision value:** moderate now, high the moment revenue exists, because an investment
  base defined after revenue arrives will be defined to flatter it.
- **Cost:** one written answer to the six questions in section G.
- **Stop condition:** the six answers exist in a committed file. Until then, no payback period is
  published anywhere, including in the White Paper.

---

## Stop condition for this audit

Met at section J. The first buyer is clear enough to test, the minimum sellable configuration is
one written report, build and concierge are separated in section C, a price range grounded in
observed market rates exists in section E, and both roadmap lanes are stated with gates in
section F. Everything still open in section I requires an owner decision or a real user.

No further browsing would change any recommendation above.

---

## Sources

Repository, all at `main@2390b351`: `README.md`, `research/mechanism/NETA_FINDING.json`,
`research/mechanism/RSTARSTAR_MECHANISM_LOCALIZATION.md`,
`research/mechanism/chesscom/CROSS_PLATFORM_DISPOSITION.md`,
`research/mechanism/chesscom/replicate_prelearning.py`, `research/mechanism/analysis/*.py`,
`docs/PRE_RELEASE_STATE.md`, `docs/VALUE_CLARITY.md`, `docs/VALUE_CLARITY_FIELD_PROTOCOL.md`,
`docs/RETENTION.md`, `docs/GATES.md`, `docs/COMPETITIVE_BENCHMARK.md`, `shared/tenancy.ts`,
`shared/interface-language.ts`, `shared/population-baseline.ts`, `shared/record-dashboard.ts`,
`shared/promise.ts`, `server/_core/owner.ts`, `server/routers.ts`, `server/recordRouter.ts`,
`client/src/lib/local-record-store.ts`, `client/src/lib/lichess-public.ts`,
`client/src/lib/chesscom-public.ts`, `client/src/lib/game-source.ts`,
`client/src/lib/batch-analysis.ts`, `client/src/components/SelfCheck.tsx`, `package.json`,
`vercel.json`.

External, all accessed 2026-09-06:

- [Aimchess](https://aimchess.com/) — official site, pricing and coach sharing.
- [Chess Dojo plans and pricing](https://www.chessdojo.shop/plans-pricing) — official pricing.
- [Lichess coach directory](https://lichess.org/coach) — listed coach hourly rates.
- [Chess.com coach directory](https://www.chess.com/coaches) — coach roster; rates not displayed on
  the listing page at access time.
- [Chessido, chess academy management software](https://www.chessido.com/blog/chess-academy-management-software/)
  — coach-platform feature set, free to start.
- [ChessPlay.io, coach software overview](https://chessplay.io/blog/5-essential-software-tools-every-online-chess-coach-needs-in-2025)
  — coach-platform feature set.

Chess.com membership prices were found only in secondary write-ups that disagree with one another;
the official membership page was not machine-readable at access time. They are therefore reported
as a band and are not used as a pricing anchor anywhere in section E.
