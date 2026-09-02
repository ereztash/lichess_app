# The authority map as it would rot

Positive control for `GATE-AUTHORITY-RESOLVED`. Every authority path the registry names is present
here as a stub, so the only findings are the four injected drifts and the scanner run over this
directory is the same scanner run over the repository root.

Four drifts, one per way an authority map decays without anybody touching it:

1. **An authority that vanished.** `shared/promise.ts` is deleted. `Q01` still names it. A map whose
   answer no longer exists answers *"who decides the product's promise?"* with a dead path.

2. **A competitor that stopped being scoped.** `PREREGISTRATION_FREEZE.json` no longer carries
   `amended_sha256_superseded_by`, the key that says which record replaced its hash block. Scoping
   is what makes a second claimant harmless; unscoped, `Q21` has two answers again — which is
   exactly the state `X-02` was found in.

3. **A capability gap that quietly closed.** `docs/ROLLBACK.md` exists. `Q26` is recorded as a
   `CAPABILITY_GAP`, and a gap that has become a capability makes the record the stale one. This is
   the predicate that keeps the classification honest **in both directions**: without it the
   repository could keep saying it cannot roll back long after somebody wrote the script, and a
   reader who added the document would believe the question answered while the record said
   otherwise.

4. **An unscoped migration.** `drizzle/0002_unscoped.sql` sits outside the directory CI applies and
   says nothing about what superseded it. CI's glob never reaches it, so it can claim anything about
   the schema for as long as it exists. One such file is in the repository and it is scoped; this is
   what keeps the next one from not being.

The tree is green on all four. This directory is red on all four.

**The stubs are generated from the registry**, so a question added to `AUTHORITY_QUESTIONS` without
a stub here leaves this fixture red for one more reason. A control that must be red staying red is
the correct failure mode.
