# The registers as they actually drifted

Positive control for `GATE-REGISTER-RECONCILED`. Every file here is a reduction of the real
document to the smallest thing that still carries the drift it carried, and the scanner run over
this directory is the same scanner run over the repository root — a control with its own weaker
predicate proves nothing.

Six drifts, and none of them is invented:

1. **A P0 with no row.** `R-19`, the fractional think time that meant no blitz game was ever stored,
   was written up in the laws and nowhere in the register. Here it shows as the register citing
   `shared/measured-duration.ts`, which this fixture tree does not contain — the same shape a
   citation takes after the file it names is deleted or renamed.
2. **A phantom gate.** The laws name `GATE-NO-DUPLICATE-ACTION` as a Gate and the runner does not
   register it.
3. **An invented state word.** `mostly addressed` reads as progress and hides a row from anyone
   scanning for `open`.
4. **Banked ceiling slack.** The component holds two pieces of state and the ratchet's ceiling is
   four, on a ratchet documented as only ever going down; and R-13 quotes a number that is not the
   constant.
5. **A ledger table out of step with its files.** `D04-…md` exists on disk and no row links it.
6. **A fired trigger filed as unfired.** D04 sits under "Not yet opened" reading *"opens now — M0
   has passed"*.
