# The research corpus as it actually drifted

Positive control for `GATE-RESEARCH-RECONCILED`. Every file here is a reduction of a real artefact
to the smallest thing that still carries the drift it carried, and the scanner run over this
directory is the same scanner run over the repository root. A control with its own weaker predicate
proves nothing.

Four drifts, and two of them are not invented.

1. **A frozen-document record that no longer matches the document.** `X-02`. The live hash block
   names `DATA_PROTOCOL.md` as `cf263394…`; the document beside it hashes to something else. In the
   repository this happened because Gate 2 required an edit to the document, the hash was taken in
   the same working tree before the edit, and both were committed together. Here it is carried on
   `FINAL_HOLDOUT_SEALED.json`, which is the block classified `CURRENT` after the reconciliation.

2. **A generated artefact disagreeing with its generator.** `X-16`. `selftest.json` records plant
   `one-game-only` at `delta 0.45`; `worlds.py`, in the same fixture tree, declares `0.22`. In the
   repository both files were last written in the same commit, `34f5742`.

   **These two are the same detection class and not the same cause**, which is why the repository's
   repairs differed: the freeze record was superseded by a later correct one, and the self-test
   output was regenerated. One scanner, two repairs.

3. **An orphaned supersession.** The freeze here carries two `SUPERSEDED` hash blocks and says
   nothing about what replaced them. This is the control for the predicate that keeps `SUPERSEDED`
   from being a whitelist: without it, any drift could be retired by declaring the block historical,
   and a register that can retire its own claims answers *"does this still hold?"* with *"I no
   longer say"*.

4. **An unclassified hash claim.** `a_new_manifest.json` carries a `sha256` at a key
   `RESEARCH_RELATIONS` does not cover. This is the control for the extension path. Without it,
   *"the research corpus is reconciled"* decays into *"the part of it somebody last looked at is
   reconciled"* the first time a new register lands.

The tree is green on all four. This directory is red on all four. That is the whole contract.
