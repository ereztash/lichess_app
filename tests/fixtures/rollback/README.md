# The rollback chain as it would rot

Positive control for `GATE-ROLLBACK-EVIDENCE`. Every link the document rests on is softened here,
one per way the procedure decays without the document changing:

1. `docs/ROLLBACK.md` no longer names the workflow, the `DEPLOYED_SHA` binding or the control.
2. `deployed.yml` lost its `sha` input and does not run the SHA-mismatch control.
3. `origin.ts` no longer exports `servesExpectedBuild`; the suite no longer calls it.
4. The SHA-mismatch control file is absent.
5. `vercel.json` installs with `npm install`, so a redeploy is not the tree that was known good.

The tree is green on all five. This directory is red on all five.
