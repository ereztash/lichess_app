# Pre-human UX, pass 3: the record was on the screen, saying zero

Pass 1 built the press layer and the busy state. Pass 2 opened five candidates under `M-C` and
closed all five without shipping anything, because each one turned out to be a decision the product
had already made on purpose.

This pass went after the owner's remaining raw signal, the one nothing had touched yet:

> התשלום לכל החלטה מקומי מדי. אני רוצה שכל החלטה תבנה תמונה מצטברת.

It found a sentence that was false on the screen, fixed it, and killed one more finding of its own
along the way.

---

## 1. What was measured, before anything was designed

Pass 3 in `PRE_HUMAN_UX_PASS_2_3_4.md` specified an accumulation surface from the owner's sentence
alone. That specification is what this pass was going to build. It measured first.

`docs/neta/harness/k-record-spend.mjs` — three complete decisions on `dist/public`, then every
painted text element of the third reveal, assigned to the panel section it sits in by DOM ancestry
rather than by a regex over its words.

| block | elements | characters | about the record |
| --- | --- | --- | --- |
| `reveal-limits` | 4 | 298 | **1 element, 60 characters** |
| `reveal-build-limit` | 1 | 89 | 0 |
| `reveal-one-thing` | 5 | 168 | 0 |
| `reveal-question` | 2 | 57 | 0 |
| `reveal-detail` | 1 | 11 | 0 |
| `reveal-continuation` | 1 | 131 | 0 |

**One element in fourteen. Sixty characters in seven hundred and fifty-four. And it sits inside the
block headed `מה ההחלטה הזאת עדיין לא אומרת`.**

The sentence is `נרשמו 3 החלטות. זה עדיין תיאור של ההחלטות האלה, לא של השחקן.` The record's growth
reaches the reveal in exactly one place, and its function there is to deny.

The closing sentence directly beneath it — `CONTINUATION_PROPOSITION` — promises the thing the panel
does not do: *"החלטה נוספת היא עמדה אחרת ורגע אחר, וזה מה שמאפשר לשאול אם מה שקרה כאן חוזר."* It is a
constant, correctly, and it says the same words after decision five as after decision one. The
product offers to let you ask whether something repeats, and then never asks.

---

## 2. The discrimination that had to run first, and the finding it killed

A local reveal beside a record screen is a layout choice, not a defect. So: is the accumulation
simply one click away?

`docs/neta/harness/l-where-the-record-is.mjs` listed every control on the reveal screen and every
in-app route. It reported:

```
### anchors to any in-app route, from the reveal screen
   NONE. no element on this screen links to an in-app route.
```

That measurement is correct and the conclusion drawn from it was wrong. **The route is not a link.**
`Home.tsx` renders `.explore-toggle` — `מה עוד יש כאן` — which mounts `RecordExplorer` in place,
handed `recordReading.data`, the entire record dashboard, with no navigation. `a[href^="/"]` cannot
see a disclosure.

> **KILLED FINDING 5.** *"The reveal offers no route to the record."* Wrong. The route is a
> disclosure, not an anchor, and an anchor probe is the wrong instrument for reachability. Same
> class as ranking salience by painted area: the proxy was measurable and was not the thing.

---

## 3. What is actually behind the door

`docs/neta/harness/m-the-door.mjs`. Three complete bank decisions, then the explorer opened from the
third reveal, at 1440x900 and 390x844. One page then carried, top to bottom:

| y | what it said |
| --- | --- |
| 108 | `עוד 60 החלטות מדודות עד שאפשר לומר משהו. 3 נמדדו ונקראות בחלק אחר של הרשומה` |
| 233 | `נרשמו 4 החלטות. זה עדיין תיאור של ההחלטות האלה, לא של השחקן.` |
| 1870 | `מהלכים שנרשמו 3 נרשמו` |
| 2089 | `עוד לא נחשפה אף החלטה, ולכן אין מה למדוד. הרשומה נבנית מהחלטה אחת בכל פעם.` |

**Four numbers describing the same player's decisions — 3, 4, 3, 0 — beside a floor of 60, and the
last of the four contradicts the first, on a screen that is itself the third reveal.**

The zero is not a rounding, a threshold or a wait. It is a sentence saying no decision has been
revealed, printed under the heading `הרשומה שלך`, to a player looking at their third engine verdict.

---

## 4. Why it happens, and why the fix that found it once did not catch it

`RecordDashboard` prints that sentence whenever `scored === 0`. Its own docblock records that this
went wrong before:

> *"Walked in Chromium from an empty profile: one decision, committed, revealed, the engine's
> verdict rendered on the same screen, and this panel said no decision had been revealed. The
> player is told to do the thing they have already done."*

That fix carried `withoutConfidence` and branched on it. It closed one cause and there are three.

`shared/evidence-policy.ts` files `anchor`, `drill`, `transfer`, `import` and `legacy` decisions as
`separate` from `descriptive-history` — correctly, each has its own denominator. `recordReading`
computes `awaitingReveal` and `withoutConfidence` over the **described** atoms alone. So a bank
decision that was committed, revealed, **and scored** is in neither count, and `scored === 0` falls
through to the zero sentence.

| cause | count that catches it | caught before this pass |
| --- | --- | --- |
| revealed, engine has not answered | `awaitingReveal` | yes |
| revealed, confidence never asked | `withoutConfidence` | yes |
| revealed and scored, in another population | **nothing** | **no** |

And this is the `N-3` owner decision, on the surface it names:

> Every completed measured decision must be acknowledged on the record surface.
> Bank/shared-set decisions remain outside the personal-game denominator and must be labelled as such.
> The zero-decision state and the measured-but-not-yet-eligible state must not share the same primary message.

`N-3` was built on the front door — `blitz-words.ts`, `resume-reading.ts`, `loop-position.ts`,
`ResumeScreen.tsx`. `RecordDashboard` is a record surface too, and it was missed. The front door's
line at y=108 and this panel's line at y=2089 are the same decision, answered two different ways, on
one screen.

---

## 5. What was changed

Five files, and no denominator among them.

**`shared/plain-reading.ts`** gains `decisionsHeldElsewhere(n)` — the acknowledgement clause, once,
so the two record surfaces cannot drift. `נרשמו` and not `נמדדו`, carried from `blitz-words.ts`
where that choice was made and reasoned: the count includes decisions still waiting for the engine,
and recorded is what all of them are.

**`shared/blitz-words.ts`** now calls it instead of holding its own copy. Output byte-identical; the
existing `N-3` tests hold it.

**`shared/record-dashboard.ts`** — `RecordReading` gains `readElsewhere`, and the `unscored` bag a
third member. It defaults to `0`, which is a smaller claim than the old behaviour, exactly as the
two counts beside it do.

**`shared/record-service.ts`** supplies it, **counted off the admission and not by subtracting the
population from the record**:

```ts
readElsewhere: allAtoms.filter(
  (atom) => admissionFor("descriptive-history", atom).kind === "separate",
).length,
```

`allAtoms.length - atoms.length` gives the same number today and would go on giving it silently
after it stopped being true. The sentence says those decisions are *read somewhere else*, and only
`separate` means that. Every non-admitted cell of `descriptive-history` is `separate` right now;
`refused` — which `discovery` uses five times — means read nowhere, and would point the player at a
section that does not hold their decision. A test holds the policy to that.

**`client/src/components/RecordDashboard.tsx`** gets the third branch. Measured on the same walk:

```
before   עוד לא נחשפה אף החלטה, ולכן אין מה למדוד. הרשומה נבנית מהחלטה אחת בכל פעם.
after    3 החלטות שלך נרשמו ונקראות בחלק אחר של הרשומה — הסט המשותף, תרגול או משחקים
         שיובאו. כאן נקרא פער כיול ממשחקים ששיחקתם, ועוד אין החלטה כזאת.
```

The clause is the front door's; the tail is this screen's, because what this screen measures is a
calibration gap and the front door's is games played. `N-3` requires that the two states not share a
primary message, and they no longer do.

**No denominator, event, protocol rule or eligibility criterion moved.** `scored` still excludes
every decision `readElsewhere` counts. `anchor` still carries the bank ones under their own heading.
`MIN_BUCKET_N`, the detector and `ACQUISITION_PROTOCOL_V1` are untouched.

---

## 6. The falsifier and its positive controls

`tests/client/a-record-that-said-you-had-decided-nothing.test.tsx`, written before the fix and run
against the unfixed tree first: **2 of 5 failed**, on the two assertions about the sentence. The
other three passed, which is what made the first one worth trusting — it establishes at the service
level that `scored === 0 && awaitingReveal === 0 && withoutConfidence === 0 && anchor.n === 3` is a
reachable state, so the browser walk was not the only evidence.

| test | what it holds |
| --- | --- |
| reaches the state | three real bank decisions through `commitDecision` + `reveal`, then the four counts |
| does not say it | the panel no longer prints `עוד לא נחשפה אף החלטה` to that player |
| says where they went | the count and the population are both on the screen |
| **positive control** | a record that really is empty still prints it, in those words |
| **positive control** | the `withoutConfidence` branch still fires for the state that produces it |
| policy pin | every `descriptive-history` cell is `admitted` or `separate`, never `refused` |

Without the two controls the change is indistinguishable from deleting the sentence.

---

## 7. The finding this pass raised and did not fix

Runs of `m-the-door.mjs` over the identical three-decision walk printed different numbers in the
same sentence. At the third reveal, where the true count is three, the panel said `נרשמו 3 החלטות`
on some runs and `נרשמו 4 החלטות` on others — **including once within a single run, where the
desktop pass said 3 and the handset pass said 4 over the same three decisions.** No code between
those two passes differs.

`docs/neta/harness/n-the-count-on-the-reveal.mjs` took five decisions in one walk and read the
sentence at every reveal: **5 of 5 correct.** That probe waits 1500ms after each reveal before
reading, and the wait is the difference — which is itself the evidence, because the value is
captured once and frozen.

The mechanism, from the code rather than from more walks. `Home.tsx:972` builds
`decisionsOnRecord: (decisionCount.data?.decisions ?? 0) + 1`, and `decisionCount.refetch()` runs
further down the same async function, **after** the inputs are captured. The decision being revealed
is already written to the store by then, so the stored count at reveal `k` is `k`; the query is one
refetch behind at `k-1`; `+1` recovers `k`. **The number is correct because the query is stale.**
Anything that lands a refetch between the commit and the capture makes it `k+1`.

The mechanism is read off the code and the disagreement is reproduced; what is not established is
the correct sentence. `decisionsOnRecord` is documented as *"Recorded decisions so far, including
this one"*, and whether `+1` is the right arithmetic depends on whether the decision being revealed
is already written at capture — in every path, including a blocked write, which has its own branch
here. Deciding that is deciding what a number in the limits block means, and the limits block is
`F-2` copy.

So it is a different defect from the one this pass fixes, it needs a probe that forces a refetch
into the window rather than waiting for one to fall there, and shipping an unverified fix beside a
verified one is the failure mode pass 2 exists to prevent.

**Recorded, not fixed.** `client/src/pages/Home.tsx:972`. It needs a probe that forces a refetch
between commit and reveal, which is a pass of its own.

---

## 8. Two more instrument defects, measured

Both belong in `harness/README.md` beside the two pass 2 recorded.

**An anchor probe cannot see a disclosure.** `a[href^="/"]` returned nothing on a screen that opens
the entire record dashboard in place. Reachability is not linkage.

**A leaf filter that lists tags misses the tags it does not list.** `m-the-door.mjs` reported the
zero sentence twice, at y=2089 and y=2112, one with a leading `— `. `NotMeasured` renders an outer
`span.value-triple` whose `innerText` is `— {reason}` and an inner `span.value-provenance` whose
`innerText` is the reason; the filter excluded elements containing `h1,h2,h3,p,li,button,summary`
and not `span`, so both matched. **A duplicate in the instrument, not on the screen.**

---

## 9. What is still open

**Unchanged from pass 2, and still not mine.** Whether headings carry weight is the product's voice.
354 painted elements at weight 400, 14 at 600, 24 at 700. That is an `OWNER` claim under v0.2 and the
observation is `REPO` at `R3`.

**New, and also the owner's.** The accumulation surface that pass 3 of the earlier document
specified — `"המרכז סגור" נבחרה ב-3 החלטות` on the reveal — is still unbuilt, and this pass did not
build it. What it found instead was that the record surface was **saying zero to a player holding
three decisions**, and a screen that reports the wrong number is not made better by adding a second
number beside it. The specification stands; it is now a change on a surface that tells the truth.

Two questions decide it, and both are the owner's:

1. Does the accumulation line **replace** `CONTINUATION_PROPOSITION` or **sit beside** it? The
   constant is field-required copy under `F-2`, and a test asserts all five reveal outcomes render
   it identically.
2. Does the loop show the record at all, or does it stay behind `מה עוד יש כאן`? Measured: that
   control is **below the fold on both viewports** — 912px down a 900px viewport on desktop, 1185px
   down an 844px one on the handset — at weight 400, 12px, and its label names no record.

---

## Stopping decision

- The measurement supported a build. The build it supported was not the one that was specified.
- A false sentence on the record surface was found, fixed, gated with two positive controls, and
  verified in the browser on the same walk that found it.
- One finding of this pass was killed by its own follow-up measurement, and two instrument defects
  were recorded.
- One defect is open and named, with its line and its mechanism, and deliberately not fixed here.
- What remains needs the owner, not another probe.
