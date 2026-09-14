# FIELD stimulus: the cutoff this change creates

**Nothing here rewrites history.** The previously frozen stimulus, its digest and the evidence
gathered under it stay exactly as they are. This file records that the product a future FIELD run
would test is **no longer the product the existing freeze describes**, and says precisely which
assumptions stopped holding.

---

## 1. The two stimuli

| | Previous freeze | This implementation |
| --- | --- | --- |
| `stimulus_sha256` | `20c3c60dcc168b2b8e42625a375acb42dcaf5db994af48c433151b68905b7ebd` | `f6856312d63e32236844bd32f20cfdd5c0a9fa29569443a10d7b2f5db9900433` |
| files | 40 | 44 |
| product SHA | `a8e7e69` | this branch, off `490aed0` |
| frozen branch | `field/frozen-20c3c60d` | — (no freeze taken) |

The frozen branch and its digest are **untouched**. Any FIELD data already collected describes the
40-file stimulus at `a8e7e69` and continues to describe exactly that.

---

## 2. Which FIELD assumptions no longer apply

The freeze was taken against a product in which the canonical policy ran in **shadow mode** on
every surface: it wrote what it would have proposed into a local ledger, and the screens ignored it.
Three assumptions in the existing protocol rest on that and no longer hold.

| Assumption under the old freeze | Status now | Why |
| --- | --- | --- |
| The front door's next step is one of two things — play, or wait | **VOID.** It is now any of nine canonical acts | `ResumeNext` was a two-kind table keyed on a blitz blocker; the policy has eleven kinds |
| After a blitz game the offer is "play another game" unless a position is worth seeing | **VOID.** A set in progress, an untested rule or a claim awaiting its test now outrank it | `postGameWords().action` said it unconditionally |
| The proposal a surface logs is unsound, so screen/policy disagreement is expected and is the measurement | **VOID.** Proposals are now sound and disagreement is structurally zero on the wired surfaces | the `unseenEvent` modelling repair; `ARCHITECTURE_UI_STATE_MAP.md` §4 |

**Unchanged and still applicable:** everything in the protocol about what must be *legible* — the
authorship contract, the evidence marks, the coding scheme, and the standing refusal to treat
continuation rate or willingness to pay as a clarity threshold. Those are claims about the reveal
and the record, and neither moved.

---

## 3. Is a new freeze required?

**Yes, before any FIELD run that intends to make claims about what a player does next.**

The behaviour a participant meets at the front door and after a game is different from the frozen
one, in the specific respect FIELD measures. A run against this build reported under the old freeze
would be an experimental artifact describing a product version it never tested, which is the one
thing §13 forbids.

**No, for a run that only measures reveal legibility.** The decision → commitment → evidence →
reveal contract is untouched: no component of it was modified, and `GATE-TWO-HANDS`,
`GATE-COMMIT` and `GATE-ENGINE-FAILURE-DISTINCT` all still pass.

**Not taken here, deliberately.** Freezing a stimulus is an owner act with a participant-facing
consequence, and this mission was not authorised to start or re-start a FIELD run. What it does is
make the cutoff explicit so the decision is available rather than implied.

---

## 4. What a new freeze would have to capture

- `stimulus_sha256 f6856312d63e32236844bd32f20cfdd5c0a9fa29569443a10d7b2f5db9900433` and the 44-file manifest, read from the deployed origin rather than
  computed locally.
- The product SHA this branch merges at.
- That the canonical policy is **live** on Resume, PostGame and the record page, and **shadow** on
  no surface that also acts.
- That `review-event` remains unreachable: no seen-set exists, and none was built.
