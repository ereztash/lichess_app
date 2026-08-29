# Blitz computation research

Code for the study preregistered in
[`docs/research/BLITZ_COMPUTATION_PREREG.md`](../../docs/research/BLITZ_COMPUTATION_PREREG.md).
Findings, and the reason the study stopped where it did, are in
[`docs/research/BLITZ_COMPUTATION_RESULTS.md`](../../docs/research/BLITZ_COMPUTATION_RESULTS.md).

**The study stopped at Gate 1.** No node budget between 25,000 and 1,600,000 produces a deep
reference stable to the preregistered tolerance, so the ground truth every downstream metric needs
does not exist at any budget this could afford. H1 and H2 were not run, and `run_analysis.py`
refuses to run them — the gate is enforced by the code, not by anyone's discipline.

## Why the semantics live in TypeScript

Think time, the clock the player faced, game phase and winning chances are all defined by modules
the product itself uses (`shared/pgn-clock.ts`, `shared/phase.ts`, `shared/win-probability.ts`). A
corpus built with a second definition of "seconds spent" would measure a different thing from the
product it is meant to inform. Python here does statistics and nothing else.

`search-trajectory.ts` is under `research/` rather than `shared/` deliberately: nothing in the
product imports it, and a module in `shared/` would say the product measures something it does not.

## Reproducing

```bash
npm install

# The engine. Version and options are recorded in every manifest.
curl -sSL -o sf.tar \
  https://github.com/official-stockfish/Stockfish/releases/download/sf_17.1/stockfish-ubuntu-x86-64-avx2.tar
tar xf sf.tar                       # -> stockfish/stockfish-ubuntu-x86-64-avx2

# 1. Decision events from the Lichess open database (CC0). Streams byte-range prefixes; nothing
#    is downloaded whole. Seeded, so the dataset hash in the manifest is reproducible.
npx tsx scripts/build_blitz_research_dataset.ts --bytes 48000000 --games 1700

# 2. Gate 1: does the deep reference saturate?  (~4 min on 4 cores)
npx tsx scripts/run_deep_reference_saturation.ts --workers 4 --engine ./stockfish/stockfish-ubuntu-x86-64-avx2

# 3. The same seeded sample on a longer grid, to distinguish "out of compute" from "does not
#    converge". Post-hoc, and labelled as such wherever it is quoted.
npx tsx scripts/run_deep_reference_saturation.ts --workers 4 --tag saturation_extended \
  --budgets 25000,50000,100000,200000,400000,800000,1600000 \
  --engine ./stockfish/stockfish-ubuntu-x86-64-avx2

# 4. Budgeted trajectories, and the same decisions scored against two defensible references
#    (~40 min on 4 cores)
npx tsx scripts/run_budgeted_search.ts --workers 4 --games 350 --engine ./stockfish/stockfish-ubuntu-x86-64-avx2

# 5. Control 3: the identical seeded positions through fresh engine processes. Every feature is a
#    function of the position alone, so the two runs must agree exactly.
npx tsx scripts/run_budgeted_search.ts --workers 4 --games 30 --tag budgeted_search_replicate \
  --engine ./stockfish/stockfish-ubuntu-x86-64-avx2

# 6. Analysis. Enforces the gate; writes data/analysis_results.json and two SVGs.
pip install numpy
python3 research/blitz/run_analysis.py
```

`data/` is not committed — it is ~100 MB of engine output. Every file that reads it also writes a
manifest carrying the seed, the engine, the engine options, the budgets, the exclusion counts and a
SHA-256 of the output, and those manifests are quoted in the results document.

## Files

| file | what it is |
| --- | --- |
| `search-trajectory.ts` | the preregistered §6.3 metrics. Research-only; the product does not import it |
| `dataset.py` | loads the artifacts and their manifests |
| `statistics.py` | Wilson intervals, Cohen's κ, Spearman, Gini — each with why it beats the obvious alternative |
| `bootstrap.py` | cluster bootstrap by game; the naive version is kept only to show how much narrower the wrong analysis would have been |
| `plots.py` | two hand-rolled SVGs, so a negative result is legible |
| `run_analysis.py` | the gate, the consequence analyses, and the refusal to run H1/H2 |
