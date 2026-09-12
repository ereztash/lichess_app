# Field test protocol — five mechanisms, separated

`research/learning-journey/FIELD_TEST_PROTOCOL.md` is **not superseded**. It tests whether a cold
user can reconstruct the journey, and its M1/M2/M3 are that question's mechanisms. This protocol
tests a different claim and uses a finer split, so the labels are **not interchangeable**. Where
both could run, run this one: it subsumes the older T1 revalidation.

## The claim under test

> A cold player, arriving with no explanation, understands what this product uniquely offers, can
> take the first act, gets something from the first decision, and does not expect the product to be
> measuring their improvement.

`OUTCOME`, resolution authority `FIELD`, required reality `R6`. Nothing in this repository can touch
it: every observation in `IMPLEMENTATION_REPORT.md` is `R1`–`R3`.

## The five mechanisms, which are not the same failure

| | mechanism | the sentence a participant produces when it is live |
| --- | --- | --- |
| **M1** | **value comprehension** | "I don't see what this gives me that the analysis button doesn't" |
| **M2** | **journey legibility** | "I understand what it does, I don't know where I am in it" |
| **M3** | **action clarity** | "I know what it is, I don't know what to press" |
| **M4** | **payoff / time-to-value** | "I get it, I got something, it isn't worth another one right now" |
| **M5** | **product-contract mismatch** | "I want it to tell me how to get to 1800" |

They have different repairs and three of them have **no** repair at the copy layer. Collapsing them
is the failure this protocol exists to prevent, and it is case C1, C4 and C8 of the paired run
meeting in one session.

## Participants

Four to six people who play chess and have never opened this product. A person is cold once.
Anyone who saw an earlier build is ineligible. At least two must have a Lichess or Chess.com account
with a game history, because the import path is a first-class case and not an edge.

## Session order, which is part of the instrument

The order is load-bearing: every later step can teach the answer to an earlier one.

1. **Before touching anything.** The phone is face down. The facilitator says: *"This is a chess
   product. Before you open it, tell me what you think it is for."* Then, after the phone is turned
   over and the front screen is read but **not** tapped: *"Now tell me again."*
   The second answer is **U**. It is recorded verbatim.
2. The participant reaches a position and records one decision through to the reveal. No
   facilitation. The facilitator records questions instead of answering them.
3. Immediately after the reveal: **Q-payoff**.
4. Return to the front screen: **Q-journey**, then **Q-next**.
5. *(participants with an account only)* Import their games. Then **Q-import**.
6. **Q-contract**, last, because it names the thing the protocol must not plant earlier.
7. **Stand-down**, and the continuation observation.

## What is asked, and what each is for

| | question | for |
| --- | --- | --- |
| **U** | "what do you think this is for" — verbatim, unprompted, before any tap | M1, M5 |
| **Q-payoff** | "What did that screen just tell you? Would a normal game analysis have told you the same thing?" | M1 |
| **Q-journey** | "What is it trying to learn about you right now? What would tell you it was finished?" | M2 |
| **Q-next** | "What would you do next?" | M3 |
| **Q-import** | "Which of these numbers would you act on?" | the import case, below |
| **Q-contract** | "Is this app measuring how close you are to getting better?" | M5 |

## The continuation observation, watched rather than asked

The facilitator says exactly this and nothing more:

> That is everything I needed. You can stop here, or keep using it. I will be quiet either way.

Then stops talking and does not look at the participant's screen. **C1** is a behaviour: does the
participant, unprompted and unassisted, begin another decision within two minutes?

Self-reported intention is not collected, because an earlier version of the older protocol read a
decision rule off "what would you expect next time" — an expectation, where the rule needed an
intention, and the two are different variables. Behaviour is preferred wherever a behaviour exists.

**What C1 is not.** Not retention, and no claim here predicts whether anyone returns tomorrow. One
observation of whether the product, having just explained itself, earns another minute unasked.

## Variables, all of them

Every one is scored from the recording, not from impression, as a value in the stated set.

| variable | source | values |
| --- | --- | --- |
| `U_exchange` | U | does the account mention saying what you think **before** the product/engine answers? `yes` / `no` |
| `U_rating` | U | does the account mention rating, ranking or getting to a number? `yes` / `no` |
| `T_move` | step 2, observed | the decision is committed and revealed **without help**. `yes` / `no` |
| `T_payoff` | Q-payoff | the participant names something a normal analysis would not have given them. `yes` / `no` |
| `T_journey` | Q-journey | the participant names what is being counted **and** that there is a threshold. `both` / `one` / `neither` |
| `T_next` | Q-next | the participant names a concrete act that exists on the screen. `yes` / `no` |
| `T_import` | Q-import | `acts-on-ranking` (picks the lowest rate as their weakness) / `refuses-ranking` (says the differences are too small, or that none of them separated) / `other` |
| `T_contract` | Q-contract | `no` (the app is not measuring that) / `yes` / `unsure` |
| `C1` | stand-down | another decision begun unprompted within two minutes. `yes` / `no` |

Nothing else is collected. Verbatim U is retained for reading a failure, and is not scored beyond
the two binaries above.

## Decision rule, fixed before anyone is run

Read in order. Each row names only variables in the table above.

| # | condition | reading |
| --- | --- | --- |
| 0 | `T_move = no` for **anyone** | **Stop.** The standing n=3 failure is not repaired. Nothing downstream is about a product they can use, and the rest of the session is not interpretable |
| 1 | `T_payoff = no` for most, **or** `U_exchange = no` for most | **M1.** What the product uniquely offers is not arriving. The exchange frame is not landing, or is landing and is not believed. This is a front-half failure and copy is the wrong layer to repair it at if `T_payoff = no` while `U_exchange = yes` |
| 2 | `T_journey = neither` for most, with `T_payoff = yes` | **M2.** Value lands, position does not. The ledger is the surface at fault, not the arrival |
| 3 | `T_next = no` for most, with `T_journey ≠ neither` | **M3.** Both the value and the state are legible and the act is not. This is the cheapest of the five to repair and the easiest to mistake for the others |
| 4 | `T_payoff = yes` and `T_next = yes` and `C1 = no` for most | **M4.** They understood it, they could act, and one decision was not worth a second. Time-to-value is binding and no representation repairs it |
| 5 | `T_contract = yes` for anyone, **or** `U_rating = yes` with `T_contract ≠ no` | **M5.** The product is being read as promising improvement. This is the one failure that is worse the better the rest of the product reads, and it is `OWNER`'s to resolve, not a copy fix |
| 6 | `T_import = acts-on-ranking` for most | The finding does not outrank its numbers **in perception**, whatever the geometry says. This is the field test of the perceptual inference this lane deliberately did not assert |
| 7 | none of the above | The front half did what it claimed. The next uncertainty is whether any of it changes behaviour over time, which is a different and far more expensive study |

Rows 1 through 6 are **not exclusive**. More than one mechanism can be live, and the protocol reports
all that fire rather than the first.

## Every decision-rule variable, and where it comes from

Written out because this exact cross-check is what caught the older protocol's unidentifiable branch.

| variable | collected by | read by rule |
| --- | --- | --- |
| `T_move` | step 2, observed | 0 |
| `U_exchange` | U | 1 |
| `T_payoff` | Q-payoff | 1, 2, 4 |
| `T_journey` | Q-journey | 2, 3 |
| `T_next` | Q-next | 3, 4 |
| `C1` | stand-down | 4 |
| `U_rating` | U | 5 |
| `T_contract` | Q-contract | 5 |
| `T_import` | Q-import | 6 |

Every variable in the table is read by at least one rule, and every rule reads only variables in the
table. Verbatim U is the only thing collected that no rule reads, and it is kept so a failure can be
described rather than only detected.

## The import case is not a subgroup, it is the second half of the test

§13 of the mission treats the import experience as a first-class case, and this lane's build changed
exactly that screen. `T_import` is therefore the most direct test of the thing that was built:

- the **observation** is measured in the repository (the finding renders above the rates, larger);
- the **perceptual inference** is stated as inference in `DECISION.md` and asserted nowhere;
- the **behavioural claim** — that players misread the ranking, or stop misreading it — is exactly
  `T_import`, and it is why the protocol exists rather than why the build was justified.

A build that fixed the geometry and not the reading is a build that moved pixels, and row 6 is the
only thing in this repository that can say so.

## What this cannot establish

That the product helps anyone play better. `CAUSALITY`, `FIELD`, and the frozen mechanism research
states it is unreachable by the discovery pipeline under any result. Nothing in this protocol, at
any sample size, moves that.
