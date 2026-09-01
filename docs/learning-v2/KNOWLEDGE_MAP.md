# Anti-silo knowledge map

Nine fields. For each construct: **mechanism**, what it predicts **here**, its **boundary
condition**, how it could **fail**, what measurement would **falsify** it, and **source quality**
(V-rows from [`THEORY_EVIDENCE.md`](THEORY_EVIDENCE.md); `—` = no verified source found in this
pass, and the row therefore carries no weight).

**The standing rule:** no effect size below is transposed into chess. Where a row says "predicts
here", it predicts a *direction* or a *precondition*, never a magnitude.

---

## A. Learning sciences / instructional design

| construct | mechanism | predicts here | boundary | how it fails | falsified by | src |
| --- | --- | --- | --- | --- | --- | --- |
| retrieval practice / testing effect | effortful reconstruction strengthens the retrieval route | rehearsal must be *retrieval*, not re-reading | response congruency | practising the wrong response | congruent and incongruent retrieval indistinguishable | V1 |
| generation effect | self-produced content is better retained | the composer's own-words rule is the right shape | generated ≠ correct | generating a false rule | rule quality uncorrelated with retention | — |
| scaffolded self-explanation | explaining forces gap-filling | prompts beat presentation | scaffolding needed for quality | doubles as measurement | prompt improves nothing over a matched-time control | V5 |
| worked examples | borrowed schema at low load | a right-answer example before practice | expertise reversal | redundant for the knowledgeable | examples help experts equally | V9 |
| erroneous examples | contrast against a wrong solution | a near-miss set | needs a *plausible* error | trivial errors teach nothing | no advantage over correct-only | — |
| guidance fading | withdraw support as competence grows | drill guidance must decay | needs a competence estimate | fading on a wrong estimate | fixed guidance equals faded | V9 |
| feedback timing | when the correction lands | unknown direction here | domain-specific | assuming immediate is better | immediate beats delayed on a *delayed* test | V4 |
| elaborated feedback | content, not just correctness | the finding must say *why* | content moderates | more words ≠ more content | elaboration with no content-gain helps | V3 |
| spacing | distributed reviews raise retention | 1/3/7/21 is defensible | raises retention of *the rehearsed thing* | mistaking retention for transfer | spaced rules transfer better than massed ones do | V11, V12 |
| interleaving | mixing forces discrimination | mix rules, don't block them | similarity-moderated | interleaving dissimilar items | blocked equals interleaved on confusable items | V2 |
| variability of practice | varied instances abstract the schema | vary the position, hold the rule | needs a real invariant | varying the wrong dimension | varied equals constant on novel items | — |
| desirable difficulties | harder now, better later | expect worse immediate scores | opposite short/long effects | reading the dip as failure | the easier condition wins at delay too | V4 |
| mastery learning | do not advance until criterion | a gate before rehearsal | criterion must be valid | mastery on a bad criterion | mastery uncorrelated with delayed transfer | V12 |

## B. Transfer and generalization

| construct | mechanism | predicts here | boundary | how it fails | falsified by | src |
| --- | --- | --- | --- | --- | --- | --- |
| near vs far transfer | shared surface vs shared structure | the target is far | distance is graded | reporting near as far | near gain with no far gain called success | V1, V5 |
| **spontaneous vs cued transfer** | cued needs a prompt; spontaneous does not | **the target is spontaneous, so no system cue may exist at test** | the whole construct | any cue invalidates the measure | a cued test predicting an uncued one | V8 |
| representative design | items must resemble the world | puzzle banks cannot support the claim | selection restricts range | training on engine-unique positions | puzzle-selected items predict ordinary play | inherited |
| contextual variability | varied contexts widen retrieval | vary board context, hold the trigger | needs an invariant trigger | context varies the trigger too | varied context no better than fixed | — |
| contrastive / minimal pairs | boundary learned from the near-miss | **negative items are mandatory** | pairs must be genuinely near | pairs too easy to tell apart | boundary learned from positives alone | V2 |
| response congruency | practise the response you will need | practise a move, not a sentence | strong moderator, not a gate | practising the wrong response | format makes no difference | V1 |
| transfer-appropriate processing | match encoding to retrieval processing | encode under game-like processing | processing, not surface | matching surface but not process | surface match sufficient | — |

## C. Skill acquisition and expertise

| construct | mechanism | predicts here | boundary | how it fails | falsified by | src |
| --- | --- | --- | --- | --- | --- | --- |
| deliberate practice | effortful, targeted, feedback-rich | blitz is not it | observational evidence only | treating 3.61× as causal | randomised DP allocation shows no advantage | V7 |
| perceptual learning / chunking | recognition precedes calculation | the trigger must be *perceptible* | needs many exposures | teaching a verbal label instead | verbal labels produce recognition | — |
| recognition-primed decision | experts recognise, then verify | rules act by recognition under time | expertise-graded | expecting deliberation in blitz | deliberative rule use under a 3+0 clock | — |
| automaticity | practice reduces control demand | only automatic rules survive blitz | takes many trials | expecting it from four sittings | rule use at speed after minimal practice | — |
| contextual interference | mixing during practice aids retention | supports interleaved rules | costs immediate performance | reading the cost as failure | blocked practice better at delay | V2, V4 |

## D. Prospective memory / stimulus control — **the decisive field**

| construct | mechanism | predicts here | boundary | how it fails | falsified by | src |
| --- | --- | --- | --- | --- | --- | --- |
| **focal vs nonfocal cues** | focal cues are processed by the ongoing task and retrieve spontaneously; nonfocal need monitoring | **an authored trigger must name something the player already looks at while choosing a move** | the ongoing task defines focality | `mechanism_class` labels are nonfocal by construction | nonfocal triggers producing uncued transfer at rate equal to focal | V8 |
| spontaneous retrieval | cue reinstates intention without search | this *is* the target behaviour | requires focality | requiring monitoring under a clock | monitoring-dependent retrieval surviving blitz | V8 |
| cue–response association | strength of cue→act link | rehearsal should pair cue with act, not cue with words | pairing must be the real act | pairing cue with a sentence | text pairing equals act pairing | V1, V8 |
| conditional discrimination | respond to A, withhold on not-A | **both halves must be measured** | needs negatives | measuring only hits | a hits-only measure predicting appropriate use | V2 |
| false alarms / over-generalisation | trained response leaks to non-triggers | the harm series | needs matched negatives | none exist in the product | a trained rule with no rise in false application | V2, V6 |

## E. Behaviour change

| construct | mechanism | predicts here | boundary | how it fails | falsified by | src |
| --- | --- | --- | --- | --- | --- | --- |
| implementation intentions | if–then delegates control to the cue | **the composer already has this form** | measures enactment, not correctness | enacting a wrong plan | if–then form no better than free-form | V6 |
| rehearsal of the plan | practice strengthens the contingency | **the missing moderator** — the plan is never rehearsed | rehearsal ≠ retrieval of content | rehearsing words | rehearsed and unrehearsed plans equal | V6 |
| habit / automaticity | repetition in a stable context | blitz is the stable context | needs many repetitions | four sittings is not habit formation | habit-like use after four sittings | — |
| cue dependency | performance collapses when the prompt is removed | any in-product prompt risks this | prompt must be absent at test | coaching during play | prompted training transferring to unprompted play | V8 |

## F. Metacognition

| construct | mechanism | predicts here | boundary | how it fails | falsified by | src |
| --- | --- | --- | --- | --- | --- | --- |
| confidence calibration | stated vs actual | **already the product's core instrument** | it is the *diagnosis*, not the outcome | using calibration as a learning outcome | calibration change tracking uncued transfer | inherited |
| fluency illusion | ease is mistaken for learning | a smooth reveal feels like understanding | perception, not learning | optimising for felt understanding | perceived learning tracking delayed transfer | V4 |
| judgments of learning | learners mispredict retention | self-report of "I applied it" is unreliable | systematic, not random | using `applied_rule` as an outcome | self-report tracking observed rule use | V4 |
| knowing vs doing | the target gap | the whole mission | — | equating them | recall predicting application | V4, V8 |

## G. HCI / UX for learning

| construct | mechanism | predicts here | boundary | how it fails | falsified by | src |
| --- | --- | --- | --- | --- | --- | --- |
| cognitive load | working-memory limits | short sessions | expertise-graded | uniform load for all | high load helping novices | V9 |
| progressive disclosure | reveal on demand | already repo law | may hide what is needed | hiding the actionable part | disclosure reducing uptake | inherited |
| learner control | autonomy raises adherence | choice over which rule | may reduce learning | letting learners avoid difficulty | control improving both objectives | — |
| feedback literacy | learners must know what to do with feedback | the missing step, restated | teachable | assuming it | uptake without instruction | V3 |
| desirable difficulty vs perceived value | effort feels like failure | expect complaints from the *better* arm | direct conflict | optimising satisfaction | the preferred arm also transferring better | V4 |
| dropout from effortful practice | burden causes abandonment | review backlog is a known killer | dose-dependent | unbounded queues | backlog with no adherence cost | VOC |

## H. Human–AI / explainability

| construct | mechanism | predicts here | boundary | how it fails | falsified by | src |
| --- | --- | --- | --- | --- | --- | --- |
| explanation usefulness | explanations aid the *right* reliance | the finding is an explanation | usefulness ≠ persuasion | persuasive but unhelpful | persuasion tracking transfer | V3 |
| trust calibration | trust should track reliability | authority levels already do this | needs true reliability | calibrating to a wrong claim | trust calibrated to a refuted claim | inherited |
| automation bias / overreliance | deferring to the system | engine agreement as the criterion | strongest under load | scoring rule use as engine agreement | engine agreement indicating rule use | inherited (F3) |
| explanatory persuasion vs understanding | a good story ≠ a good model | a compelling reveal may teach nothing | the core H1 risk | optimising the story | persuasion producing uncued transfer | V5 |

## I. Measurement / psychometrics / causal inference

| construct | mechanism | predicts here | boundary | how it fails | falsified by | src |
| --- | --- | --- | --- | --- | --- | --- |
| construct validity | the score means what it claims | **refuted upstream for the one rule class tested** | argument, not a coefficient | assuming it | a signature that separates rule use from good play | inherited (F3) |
| measurement reactivity | measuring changes the measured | self-explanation is both | **untested here** | prompt as nonreactive measure | a prompt with no effect on the measured behaviour | inherited (F7), D21 |
| null models / base rates | what the bar returns when nothing was learned | **absent** — see the corrected numbers | needs a real base rate | reading a pass rate alone | a pass rate interpretable without a base rate | this repo |
| signal detection | hits and false alarms separately | both halves, `c` beside `d′` | needs negatives | accuracy alone | accuracy alone ordering the same way `d′` does | inherited (F5) |
| practice effects | improvement without learning | **+0.2 d′ at zero true effect** | any pre/post design | pre/post as evidence | pre/post improvement with concurrent controls flat | inherited (F8) |
| single-case / multiple baseline | staggered starts, within participant | the only affordable design | 5+ points × 6+ phases | too few phases | a between-subjects design at n=8–30 detecting anything | V10 |
| ecological validity | does the task resemble the world | instrument at L2, target at L5/L6 | four rungs | claiming L5 from L2 | L2 predicting L5 | inherited |

---

## The two rows that decide everything

**D/focal cues (V8)** and **I/construct validity (inherited F3)**. The first says the target
behaviour only exists if the trigger is focal, and nothing in the product makes it so. The second
says that even if it occurred, the repository cannot currently tell it from ordinary good play.
