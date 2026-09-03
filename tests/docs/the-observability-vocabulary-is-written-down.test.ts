/**
 * `docs/OBSERVABILITY.md` names every operator event code, every failure class, every client
 * surface, and the two hard limits, by reading them from the code rather than remembering them.
 *
 * WHY A TEST AND NOT A CONVENTION. The authority scan classifies Q27 as ONE_CURRENT_AUTHORITY with
 * the document as the first path. An authority that lags the code it describes is the state
 * `AUTHORITY_MAP.md` v1 was found in, so the document is held to the code the same way the README's
 * gate table is held to `run_gates.ts`.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPERATOR_EVENT_CODES } from "../../server/_core/telemetry";
import { CLIENT_SURFACES, FAILURE_CLASSES } from "../../shared/failure-class";
import { MAX_PER_LOAD } from "../../client/src/lib/error-sink";

const doc = readFileSync("docs/OBSERVABILITY.md", "utf8");

describe("docs/OBSERVABILITY.md", () => {
  it("names every operator event code the server can emit", () => {
    for (const code of OPERATOR_EVENT_CODES) {
      expect(doc, `event code ${code} is not in the document`).toContain(`\`${code}\``);
    }
  });

  it("names every failure class and every client surface", () => {
    for (const klass of FAILURE_CLASSES) {
      expect(doc, `failure class ${klass} is not in the document`).toContain(`\`${klass}\``);
    }
    for (const surface of CLIENT_SURFACES) {
      expect(doc, `surface ${surface} is not in the document`).toContain(`\`${surface}\``);
    }
  });

  it("states the beacon's per-load ceiling and the one-hour retention it cannot fix", () => {
    expect(doc).toContain(`${MAX_PER_LOAD} reports per page load`);
    expect(doc).toContain("one hour");
    expect(doc).toContain("EXTERNAL_CONFIGURATION_REQUIRED");
  });
});
