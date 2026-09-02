# The falsification inventory, out of date

Positive control for `GATE-FALSIFICATION-INVENTORY`. Two drifts, and they are the two directions an
inventory of blocking checks can fall out of step with the job it describes.

1. **A blocking step nobody classified.** `Publish the release notes` runs in this workflow and has
   no row in `FALSIFICATIONS`. That is the ordinary way coverage rots: a step is added, the register
   is not, and *"every blocking check has falsification evidence"* quietly becomes *"every blocking
   check that existed when somebody last looked"*.

2. **A named mechanism that is not there.** This `package.json` defines `gates:controls` and neither
   `check:control` nor `bundle:budget:control`, both of which the inventory names as the runnable
   falsification for a step. A register pointing at a command that does not exist claims coverage it
   does not have, which is the more dangerous direction.

The real workflow is green on both. This directory is red on both.
