# The stimulus-flag fixture

The positive control for `GATE-STIMULUS-FLAGS`. It reads a build-time variable that
`scripts/stimulus-manifest.ts` does not record, which is exactly the drift the gate exists to catch:
a flag that changes what a participant can reach and does not appear in the manifest the moderator
reads before a session.

Same predicate as the real run, different input. That is what makes the control mean anything.
