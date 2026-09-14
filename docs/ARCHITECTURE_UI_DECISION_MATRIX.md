# Architecture → UI: the decision matrix

The canonical priority ordering, the collisions it resolves, and where ambiguity is legitimate.

**This document is prose over a test.** `tests/shared/who-wins-when-two-states-compete.test.ts`
asserts every row below. Where the two disagree the test is right, because it runs.

---

## 1. The ordering, as the ladder actually has it

Read top to bottom; the first branch whose condition holds wins.

| # | Branch | Fires when | Act |
| --- | --- | --- | --- |
| 1 | `continue-drill` | a drill is open | `continue-run` |
| 2 | `continue-transfer` | a transfer is open | `continue-run` |
| 3 | `wait-analysis` | games are queued for the engine | — (no control) |
| 4 | `review-event` | an unseen stored event exists | `review-event` |
| 5 | `test-hypothesis` | the player wrote a rule nothing has tested | `test-hypothesis` |
| 6 | `test-claim` | the instrument separated something no drill has decided | `test-hypothesis` |
| 7 | `none` | the blitz standing has not been read | — |
| 8 | `play-first-decision` | no decisions and no games | `play-first-decision` |
| 9 | `play-blitz` | the blitz record may not speak yet | `play-blitz` |
| 10 | `play-first-decision` | the untimed loop has no decisions | `play-first-decision` |
| 11 | `collect-more-evidence` | the shared anchor set is unfinished | `play-first-decision` |
| 12 | `return-record` | nothing outstanding | `return-record` |

**Branch 4 is unreachable.** Nothing in this product produces an unseen event; the input is
`UNIMPLEMENTED` and is skipped rather than charged as blindness. See
`ARCHITECTURE_UI_STATE_MAP.md` §4. It is listed here because it is in the ladder, not because a
player can meet it.

---

## 2. Collisions, with the reason each is decided the way it is

| State A | State B | Winner | Why |
| --- | --- | --- | --- |
| open drill | open transfer | `continue-drill` | Both are pre-registered sets and one must go first. The order is fixed so the answer does not move between two loads of an unchanged record |
| open run | 11 games queued | `continue-run` | `wait-analysis` is the most defensible thing to promote and promoting it abandons a registered set to wait for an engine |
| open run | untested rule | `continue-run` | A set already started outranks a set not yet started. Half a registered test measures nothing |
| open run | claim awaiting a drill | `continue-run` | Same reason, one authorship over |
| open run | a playable record | `continue-run` | **The collision this migration is about.** PostGame answered it with "play another game", unconditionally |
| analysis backlog | untested rule | `wait-analysis` | The backlog is committed work nothing else unblocks, and a rule test needs decisions the queue has not scored |
| untested rule | claim awaiting a drill | `test-hypothesis` | Rule 4. A rule the player authored outranks a separation the search found: the first is theirs |
| claim awaiting a drill | unfinished anchor set | `test-claim` | Rule 3. A finding nobody has decided outranks collecting more evidence of the kind that raised it |
| unfinished anchor set | nothing else | `collect-more-evidence` | Comparison between people needs the same positions |
| nothing outstanding | — | `return-record` | **Not another game.** With nothing open, the honest answer is what was measured, not more measuring |

---

## 3. Legitimate ambiguity, and explicit unknown

| Situation | Resolution | Kind |
| --- | --- | --- |
| blitz standing not yet read | `none` — no action proposed | **explicit unknown** |
| a readable input went unread | proposal returned, `blind` non-empty, `soundProposal` false; **no surface may act** | **explicit unknown** |
| `unseenEvent` | skipped; branch unreachable, not blindness | **explicit unreachable** |
| `wait-analysis` and `none` | named, and no surface renders a control | **deterministic, no act** |
| two open drills | the newest wins | **deterministic**; the record cannot say which the player means, and `continuationReading` refuses to let a stale one mask a live one |
| open drill whose progress cannot be reconstructed | `active` + `restore: { ok: false }`; the surface offers a close, never a fresh drill | **explicit unknown** |

**No accidental fallthrough.** Branch 12 is a total function: every state that reaches it returns
`return-record`. There is no path that returns `undefined`, and no branch that silently declines.

---

## 4. What a surface may do with each answer

| Answer | Render | Never |
| --- | --- | --- |
| `sound` + offer | the presenter's label and reason, stamped with the canonical act | rename the act |
| `sound` + `null` offer | the surface's description, no primary control | invent a control for a state the policy says has none |
| `unsound` | the surface's description, no primary control | act on it; substitute a local default |
| `unknown` | the surface's description, no primary control | substitute a local default |

The last cell of rows three and four is the one that matters. A fallback that fires when the policy
cannot answer is the parallel policy returning through the error path, and it is the thing
`GATE-NO-LOCAL-PRODUCT-POLICY` exists to notice.
