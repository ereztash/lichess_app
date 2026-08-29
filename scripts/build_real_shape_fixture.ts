/**
 * The shape real decisions actually have, frozen into a fixture the gates can run without a
 * network or an engine.
 *
 * WHY A FIXTURE AND NOT THE RAW EVIDENCE. `research/harness/decision_evidence.jsonl` is engine
 * output and is not committed; a gate that needed it could not run in CI. This distils it to the
 * four fields a bucket predicate is allowed to look at, as whole tuples rather than four separate
 * histograms -- so the JOINT structure survives too. Real endgame decisions really do arrive with
 * low clocks, and a control built from independent marginals would quietly test an easier world.
 *
 * WHAT IT CANNOT CARRY, and this is the permanent hole rather than a gap in the corpus: no stated
 * confidence. Nobody asked those players how sure they were, and nobody ever can. The control that
 * consumes this supplies confidence itself, drawn independently, and says so.
 *
 * Run: npx tsx scripts/build_real_shape_fixture.ts
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const PHASES = ["opening", "middlegame", "endgame"] as const;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function main() {
  const dataDir = arg("data", "research/harness");
  const out = arg("out", "tests/fixtures/real-shape.json");
  const report = JSON.parse(readFileSync(`${dataDir}/harness_report.json`, "utf8"));
  const rows = readFileSync(`${dataDir}/decision_evidence.jsonl`, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  /*
   * Forced positions are dropped, because the product drops them: a bucket never sees a move the
   * player had no choice about, so a control built from them would test a record the detector
   * cannot be handed.
   */
  const kept = rows.filter((r) => !r.forced);
  const tuples = kept.map((r) => [
    PHASES.indexOf(r.phase),
    r.secondsTaken,
    r.clockMsRemaining,
    r.accurate ? 1 : 0,
  ]);

  const body = JSON.stringify(
    {
      schema: ["phaseIndex", "secondsTaken", "clockMsRemaining", "accurate"],
      phases: PHASES,
      source: {
        corpus: report.corpus,
        engine: report.engine,
        importDepth: report.importDepth,
        players: report.players,
        decisionsBeforeForcedRemoved: rows.length,
      },
      note: "No stated confidence: nobody asked these players. The control supplies it.",
      tuples,
    },
    null,
    0,
  );
  writeFileSync(out, body);
  process.stderr.write(
    `${tuples.length} tuples -> ${out} (sha256 ${createHash("sha256").update(body).digest("hex").slice(0, 16)})\n`,
  );
  const withoutTime = tuples.filter((t) => t[1] === null).length;
  const withoutClock = tuples.filter((t) => t[2] === null).length;
  process.stderr.write(`  without time ${withoutTime}, without clock ${withoutClock}\n`);
}

if (process.argv[1]?.endsWith("build_real_shape_fixture.ts")) main();
