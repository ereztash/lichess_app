# The harness that produced run 001

Not part of the build, not part of `npm test`, not a gate. It is the instrument, kept so the
numbers in [`../NETA_EMBODIED_RUN_001.md`](../NETA_EMBODIED_RUN_001.md) can be re-measured rather
than believed.

Run with `NODE_USE_ENV_PROXY=1 node docs/neta/harness/<script>`.

| file | what it measures |
| --- | --- |
| `session.mjs` | opens a clean Chromium context against production. Fresh profile per run: no `localStorage`, no cookies, no prior session. Production bytes and production headers are relayed through Node because this sandbox's browser cannot complete a TLS handshake to the origin; the engine reaches `uciok` under the relay, so the relay is not standing between the product and its own engine |
| `lib.mjs` | the four commitment steps and one commit, as a person performs them |
| `step13-clean.mjs` | press to reveal, sampled at 100ms. `+36ms` label, `+139ms` computing, `+2,185ms` the engine's sentence |
| `step18-trigger.mjs` | whether the counterfactual question follows the move played. It does not |
| `step19-cf.mjs` | whether it follows click count or elapsed time. Neither |
| `step21-mobile.mjs` | every element's y at 390x844, on all three screens |
| `step22-blitz.mjs` | the `N-3` control: three blitz moves, then the front door |
| `step23-verify.mjs` | the `N-2` intervention, walked on `dist/public` |

Two of these scripts encode a mistake worth keeping. `step13`'s ancestor detected the reveal by the
string `REVEAL`, which matches the masthead `COMMIT · THEN REVEAL` on every screen, and its
confidence selector `/^5/` matched `5.Be3` in the move rail and scrubbed the game. Both produced
findings that were wrong and were killed by discrimination, which is recorded in
[`../NETA_EMBODIED_RUN_001.md`](../NETA_EMBODIED_RUN_001.md) §7.
