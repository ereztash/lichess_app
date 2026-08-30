# D09 — what does freezing a hypothesis mean?

**Mode:** `PORT_AFTER_EQUIVALENCE` (SHA-256 against `node:crypto`).
**Evidence level:** E2 — the manifest exists and its invariant is held by tests; nothing has yet
been frozen against real evidence.
**Depends on:** `shared/discovery/hypothesis-manifest.ts`, `shared/prereg.ts`.

## CLAIM

A search over a record spends the record's freedom: given enough candidates, something separates.
What buys that freedom back is naming **one** candidate, writing down everything about how it will
be judged, and then not touching any of it while the evidence arrives.

For that to be more than an intention, a frozen hypothesis needs an **identity** — and a changed
hypothesis needs a **different** identity. Evidence accumulates against an id. If two different
hypotheses can share one, a claim collects evidence gathered against a claim it is not, silently,
and every test of the statistics still passes.

## ALTERNATIVES

1. **A name.** `claim-fast-under-45s`, as the product uses now.
2. **A row id** from the store.
3. **A content hash** of a canonical serialisation of everything that was committed to.
4. **An experiment-tracking service** (MLflow and its peers) holding the run and its parameters.

## EXTERNAL IMPLEMENTATIONS

MLflow, Weights & Biases, and the general pattern of a run manifest with a content-addressed id.
The pattern is standard; the services are for a training pipeline, and this product is a static
browser bundle with a bundle budget.

## WHAT WAS COPIED

Nothing.

## WHAT WAS WRAPPED

Nothing.

## WHAT WAS ONLY USED AS REFERENCE

`node:crypto`'s SHA-256, as the thing `shared/discovery/sha256.ts` is differenced against.

**Why there is a reimplementation at all**, in a repository whose whole discipline is not to write
one: every module in `shared/` is imported by the browser bundle as well as the server, so a Node
builtin here is a build failure waiting for the first client module that reaches for a hypothesis
id; and WebCrypto's `digest` is asynchronous, which would make every equality check, map key and
assertion async for a reason unrelated to any of them.

**Why it is permitted**: SHA-256 is a fixed published function used here as an *identity* and never
as a security primitive — nothing authenticates on it, nothing is secret. And it is checked the way
this project checks a port: `tests/discovery/one-byte-is-a-different-hypothesis.test.ts` differences
it against `node:crypto` over the published vectors, **every length from 0 to 200** (both
block-padding boundaries), and 2,000 seeded random strings including surrogate pairs.

## LOCAL EVIDENCE

`shared/prereg.ts` already does this for the six shipped buckets and says why in as many words:
*"a hypothesis tested on the data that suggested it is not a hypothesis"*. Alternative 1 works
there because there are exactly six names and none of them carries a threshold. It stops working the
moment a subgroup is `clockShare < 0.37 AND materialAdvantage > 1`, because the number is part of
the statement and a name does not carry it.

The test file holds twelve one-change variants — a threshold moved by one part in a hundred
thousand, `<` becoming `<=`, the direction flipped, a feature's formula version bumped, the
derivation games changed, the stopping rule, the error budget, the minimum meaningful effect, the
protocol, the parent, the target, the generator — and asserts all thirteen ids are **distinct**, not
merely different from the base.

`canonicalJson` refuses three things that would otherwise collide:

| refused | because |
| --- | --- |
| `undefined` | `JSON.stringify` **drops** the key, so `{a:1, b:undefined}` and `{a:1}` hash alike |
| non-finite numbers | `NaN` serialises as `null`, colliding with a recorded absence |
| `-0` | serialises as `0`, and nothing in a manifest means negative zero |

Object keys are sorted; **array order is never touched**, because order is meaning in an array and
the predicate's atoms already have a canonical order of their own.

## COUNTEREVIDENCE

- **Nothing stores one of these yet.** The manifest is a shape with tests, not a mechanism with
  history. The first migration that carries a stored manifest is where the design meets reality,
  and `frozenIsIntact` exists for exactly that moment.
- **A hand-written SHA-256 is a hand-written SHA-256.** The equivalence test is thorough for the
  inputs it covers and does not prove the implementation correct for all inputs.
- **The identity is only as good as the canonicaliser.** A future field whose type is a `Map`, a
  `Date` or a class instance will throw rather than hash — which is the intended failure, but it is
  a failure a caller has to handle.

## UNCERTAINTY

Whether `effect_estimate_derivation` belongs inside the hash. It is a *measurement*, not a
*commitment*: re-running the derivation on the same games with a bug fixed would change the id of a
hypothesis whose statement did not change. It is inside for now because a validation that cannot be
compared with what it is replicating is not a replication — but the argument is not airtight and
this is the field most likely to move out.

## DECISION

**Alternative 3.** `hypothesis_id = SHA256(canonicalJson(manifest))`, with the predicate
canonicalised before hashing so two orderings of one conjunction cannot make two ids.

`freeze` **refuses rather than repairs**: a conjunction deeper than the declared maximum, a class
that admits no protocol, a feature the predicate reads with no recorded formula version, a claim
with no minimum meaningful effect, a budget with nothing left to spend. Freezing a repaired version
would freeze something nobody wrote.

`derivation_game_ids_hash` names the games without carrying them, so a later reader can prove the
validation games were not among the ones that suggested the claim.

## REVERSAL CONDITION

- **If two hypotheses are ever found sharing an id**, the canonicaliser is wrong and every stored
  manifest needs re-hashing under the corrected one, with the old ids kept as aliases — not
  silently reassigned.
- **If a legitimate re-derivation keeps producing new ids** for a hypothesis whose statement did not
  change, `effect_estimate_derivation` moves out of the hashed content and into a sidecar.
- **If `shared/` ever stops being isomorphic** — if it is server-only, or if a synchronous digest
  arrives in the platform — delete `sha256.ts` and call the platform's.
