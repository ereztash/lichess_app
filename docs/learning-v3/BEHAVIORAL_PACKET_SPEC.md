# The behavioural packet — the object, before any component

**Status: SPECIFIED, NOT ADMISSIBLE.** The gates that decide whether a packet may be *derived* have
passed. The measurement that decides **which** packet — `BARRIER_DECISION.md` — has not run, because
it needs people. So this file specifies the object and its refusals, and stops short of choosing a
packet type. §7 says exactly what would unblock that choice.

**Why the object comes before the component.** `INERTIAL_UX_LAWS.md` LAW 3 — *state decides, screen
renders* — means a surface that re-derives anything is a second authority for a question that has
one. A React component written first would decide, by what it reads, what the object is. So the
object is written first and the component reads it.

---

## 1. What the packet is, and what it is not

```text
BehavioralPacket   the smallest thing a player is shown after a game, in the form
                   WHEN <cue> -> DO <action>, plus what is required to justify,
                   test and reverse it
```

**It is not a `Claim`.** A `Claim` is system-derived, graded `hypothesis / replicated / refuted`, and
is a statement about a pattern in the record.

**It is not a `LearningRule`.** A `LearningRule` is player-authored, in the player's own words, and
adds `retired`, which no derivation produces because it is an act of the player's.

**It is a third thing that references both and absorbs neither.** `AUTHORITY_MAP.md` §3 sets out why
they cannot merge: a fold can conclude that a rule replicated or was refuted; it cannot conclude that
a player stopped caring. A packet that swallowed either object would either lose that state or invent
a system-derived version of it, and both are the same mistake — erasing who said what.

---

## 2. Fields

```ts
interface BehavioralPacket {
  packet_id: string;

  /* PROVENANCE. At least one, and the packet says which kind. Never merged. */
  from_claim: string | null;          // a system-derived Claim, by id
  from_learning_rule: string | null;  // a player-authored LearningRule, by id
  from_rule_class: string;            // e.g. "RC-05" -- the frozen board predicate

  /* THE BEHAVIOURAL CORE. Both halves are predicate-backed, not prose. */
  cue: CueRef;                        // names a predicate, not a sentence
  action: ActionSetRef;               // names `satisfies`, not a single move

  /* THE BOUNDARY, present only where the barrier calls for it. */
  negative_boundary: CueRef | null;   // X' -- the near-miss the player must tell from X
  exception: string | null;           // player-authored, rendered as theirs

  /* THE TRUST LAYER, optional and separable by construction. */
  personal_evidence: PersonalEvidence | null;

  /* WHAT MAY BE SAID. Not a field the UI computes. */
  evidence_authority: EvidenceAuthority;   // shared/evidence-authority.ts, unchanged
  does_not_establish: string[];            // the sentences this packet may NOT carry

  /* THE TEST, frozen before the decision it will judge. */
  next_natural_test: NaturalRetestRef;

  /* LIFECYCLE. About delivery, never about evidence. See section 4. */
  status: "candidate" | "admissible" | "active" | "withdrawn";
  withdrawn_because: WithdrawalReason | null;

  created_at: string;
  instrument_identity: InstrumentIdentity;  // engine build, nodes, predicate version, corpus
}

interface CueRef {
  rule_class: string;        // the register entry whose `trigger` decides membership
  predicate_version: string; // rule_classes.py's own version, hashed in ITEM_BANK_PROTOCOL.md
  player_facing: string;     // the Hebrew sentence a player reads. NEVER the thing evaluated.
  engine_free: true;         // a type-level assertion; GATE-CUE-PLAYER-OBSERVABLE enforces it
}

interface ActionSetRef {
  rule_class: string;        // `satisfies(board, move, ctx)` decides membership
  predicate_version: string;
  player_facing: string;
  worst_permitted_regret_xs: number;  // from the frozen corpus. The packet carries its own risk.
}

interface PersonalEvidence {
  sentence: string;          // "in N similar opportunities, this appeared M times"
  numerator: number;
  denominator: number;       // a denominator, always. GATE-DENOM already forbids the alternative.
  causal_language: false;    // asserted, and checked
}
```

**`cue.player_facing` is never the thing evaluated.** The sentence a player reads and the predicate
that decides membership are two objects with one meaning, and the repository has been bitten by
merging them before: `LearningRuleComposer` takes a trigger as free text and **nothing in the tree
can evaluate it against a position** (`AUTHORITY_MAP.md` row 1). The packet fixes that by making the
predicate authoritative and the sentence a rendering of it.

---

## 3. Where each field's authority lives

No new authority is created for any question that has one.

| field | decided by | not by |
| --- | --- | --- |
| `cue` membership | `rule_classes.py::trigger`, board-only, no engine | the player's sentence, a UI component, an LLM |
| `action` membership | `rule_classes.py::satisfies` | **`accurateDecision`** — see below |
| `evidence_authority` | `shared/evidence-authority.ts::authorityOf` | the packet |
| `does_not_establish` | `STRONGEST_PERMITTED_CLAIM.json`'s `forbidden_claims` | prose written beside the packet |
| claim status | `shared/claim.ts::evaluateClaim` | the packet |
| rule status | `shared/learning-record.ts::gradeLearningRule` | the packet |
| next action | `shared/next-action.ts::deriveNextAction`, once LAW 3 grants ownership | the surface |

**The `accurateDecision` row is the one that matters.** `finishLearningTransfer` currently scores a
transfer success as *word-overlap recall* ∧ *the engine approved of the move* — nothing in that
expression asks whether the move satisfies the rule. A packet graded that way would credit a rule for
a good move played for another reason, and refute it for a correct application that lost evaluation.
Gate A measured how often that second case is real: on `RC-06`, **84.7%** of trigger-positive items
contain a rule-satisfying move that loses ≥100 cp.

---

## 4. Status is about delivery. Evidence status stays where it lives

The mission's candidate status set was `candidate / admissible / active / weakened / retired /
refuted`. **`weakened`, `retired` and `refuted` are not adopted**, because `Claim` and `LearningRule`
already own them and Phase 5's own rule forbids a duplicate authority.

```text
candidate    derived; the refusals in section 5 have not been checked
admissible   every refusal checked and none fired; may be shown
active       currently shown to this player
withdrawn    no longer shown, and `withdrawn_because` says on whose authority
```

```ts
type WithdrawalReason =
  | { kind: "claim-refuted"; claim_id: string }          // evaluateClaim said so
  | { kind: "rule-retired"; rule_id: string }            // the player said so
  | { kind: "evidence-decayed"; below: string }          // it no longer separates
  | { kind: "instrument-superseded"; was: InstrumentIdentity }
  | { kind: "player-dismissed" };
```

A packet is never withdrawn *by* the packet. It is withdrawn *because* an authority that owns the
question said something, and the reason is a pointer to that authority rather than a copy of its
state.

**Reversal is a requirement, not a courtesy.** `docs/learning-v3/README.md`'s graph rule — *a finding
that no longer separates the user's performance must visibly decay or retire* — is `evidence-decayed`
above, and `GATE-PACKET-REVERSIBLE` is the check that a path to it exists.

---

## 5. The ten refusals

Phase 10's list, each as a condition the system must be able to detect and refuse to prescribe under.
Where the frozen corpus already supplies the number, it is named.

| # | the system must refuse when | detected by | already measurable? |
| --- | --- | --- | --- |
| 1 | the pattern rests on too few opportunities | `GATE-DENOM`, and `MIN_BUCKET_N = 30` in `detector.ts` | yes, shipped |
| 2 | `T+` and `T−` are both poor — the rule separates nothing | separation on the frozen corpus | yes: `RC-13`'s `b_valid \| T+` is **.030** |
| 3 | the action rises under `T+` **and** `T−` alike | the mandatory ΔP(Y\|¬X) monitor | **no — needs participants** |
| 4 | one strong permitted action hides many harmful ones | p90 of the permitted-set regret distribution | yes: **five classes have p90 = 1.0000** |
| 5 | the packet's evidence no longer separates | recomputation against the current record | yes, once a record exists |
| 6 | the packet cites a superseded instrument | `instrument_identity` against the current predicate version and engine build | yes — the corpus manifest carries both |
| 7 | the packet was generated from data the player saw before deciding | `makingEvidence`, and `D21`'s exposure rule | yes, shipped |
| 8 | the retest criterion was defined **after** the decision | `created_before_decision` on the retest | yes, by construction |
| 9 | the cue needs engine-only knowledge at decision time | `GATE-CUE-PLAYER-OBSERVABLE` | **the gate does not exist yet** |
| 10 | the cue is not recognisable, and is labelled actionable anyway | recognition data | **no — needs participants** |

**Three of the ten cannot be checked today**, and two of those need people. That is the honest count,
and it is why this file's status is `SPECIFIED, NOT ADMISSIBLE`.

---

## 6. What `RC-05` would fill in, if the barrier decision picked it

Illustrative, and marked as such: the content is decided by the barrier, not by this file.

```text
cue         a pawn of yours can promote, and nothing attacks the promotion square
            predicate: rule_classes.py::_promote_trigger. Board only. No engine. No search.
action      promote to a queen
            predicate: rule_classes.py::_promote_satisfies -- `move.promotion == QUEEN`
risk        p90 permitted-action regret 0.0000; worst-per-item mean 0.0379
authority   E1 at best. Zero humans. `mayPrescribe` is FALSE at every level this packet could hold
```

**Why `RC-05` is the only class that could fill this in today.** Its cue is decidable from the board
with no engine (refusal 9). Its permitted set is safe at the ninetieth percentile (refusal 4). Its
`T−` cell prescribes something and that something can be wrong (refusal 2). And its response
predicate does not consult its own trigger, so `T+` and `T−` score the same act — which is the
precondition `RC-06` fails and no matching repairs.

**And it may not be shipped.** `mayPrescribe` is true only at `tested`, this packet would be at
`hypothesis` at best, and `refusals 3, 9 and 10` are unchecked.

---

## 7. What would make a packet admissible

In order, and none is skippable:

1. **`GATE-CUE-PLAYER-OBSERVABLE` exists and is blocking**, with a positive control that goes red on
   a cue defined by an engine quantity. Closes refusal 9.
2. **Study D runs** and reports which of recognition, action selection or conditional discrimination
   is first. Closes refusals 3 and 10, and picks the packet type.
3. **The retest is frozen before the decision it judges**, per `NATURAL_RETEST_SPEC.md`. Closes
   refusal 8 mechanically rather than by intention.
4. **The packet reaches `tested`** on `evidence-authority.ts`'s own ladder, which requires a forward
   test that could have come back negative.

Until all four, a packet may be **derived and logged in shadow** — `INERTIAL_UX_LAWS.md` LAW 3's own
sequence, *derivation, then shadow, then ownership* — and may not be shown to a player.
