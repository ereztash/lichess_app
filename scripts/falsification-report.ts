/**
 * Print the falsification inventory the mission asks to publish: blocking check, mechanism, and
 * whether the mechanism can be run here.
 *
 * DERIVED ON EVERY RUN. The steps come out of `.github/workflows/verify-build.yml`; nothing here is
 * transcribed. An inventory that was maintained by hand would be the third hand-maintained register
 * this repository has had to fix, and `GATE-FALSIFICATION-INVENTORY` fails when the workflow gains
 * a step this table does not classify.
 */
import { FALSIFICATIONS, findFalsificationDrift, inventory } from "./falsification-scan";

const rows = inventory(".");
const width = Math.max(...rows.map((r) => r.step.length));
console.log("\nBlocking checks, and what can falsify each\n");
console.log(`${"step".padEnd(width)}  ${"kind".padEnd(29)}  runnable here`);
console.log("-".repeat(width + 2 + 29 + 2 + 24));
for (const row of rows) {
  console.log(`${row.step.padEnd(width)}  ${row.kind.padEnd(29)}  ${row.runnable}`);
}

const byKind = new Map<string, number>();
for (const row of rows) byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + 1);
console.log("\n" + [...byKind].map(([k, n]) => `${k} ${n}`).join("  ·  "));

const runnable = rows.filter((r) => r.runnable !== "-").length;
console.log(
  `\n${rows.length} blocking steps · ${runnable} with a mechanism runnable in this repository · ` +
    `${rows.filter((r) => r.kind === "NO_HONEST_SYNTHETIC_CONTROL").length} where a synthetic ` +
    `control would prove something else`,
);

const drift = findFalsificationDrift(".");
if (drift.length) {
  console.error(`\nDRIFT\n${drift.map((d) => `  - ${d.file} ${d.text}`).join("\n")}`);
  process.exit(1);
}
console.log(`\nevery blocking step is classified (${FALSIFICATIONS.length} rows)\n`);
