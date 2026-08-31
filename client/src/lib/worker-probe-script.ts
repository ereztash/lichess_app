/**
 * The worker the self-check starts to find out whether this browser starts workers.
 *
 * Its own file because it has to be its own ASSET: the probe's whole point is to load from the same
 * origin the engine's worker loads from, which means a real URL under `/assets` — not a `blob:` and
 * not a `data:`. `worker-probe.ts` imports it as `?worker&url`, which is what makes Vite emit it.
 *
 * It says one word and closes. Anything more would make a failure ambiguous between "the browser
 * refused the worker" and "the worker's own code went wrong", which is the confusion the check
 * exists to remove.
 */
self.postMessage("alive");
self.close();
