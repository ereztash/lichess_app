/**
 * The rollback evidence chain, checked against the files that carry it.
 *
 * `docs/ROLLBACK.md` says how a bad deployment is undone and what closes the incident: a green L6
 * run bound to the commit that was rolled back TO. That sentence rests on four files agreeing:
 *
 *   1. the workflow can be told which commit to expect (`workflow_dispatch` input `sha`),
 *   2. the L6 suite actually binds to it (`servesExpectedBuild` with `EXPECTED_SHA`),
 *   3. the control that proves the binding can fail is collected (`deployed-sha.control.test.ts`),
 *   4. the build installs the lock file exactly (`installCommand` is `npm ci`), so a redeploy of a
 *      known-good commit is the same tree that was known good.
 *
 * Any one of them can drift without the document changing -- an input renamed, an assertion
 * softened, a control deleted, a `vercel.json` edited in a dashboard-shaped hurry. The document
 * would then describe a procedure the repository no longer has. This scanner reddens when it does.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Finding } from "./gate-scan";

export const ROLLBACK_DOC = "docs/ROLLBACK.md";
export const DEPLOYED_WORKFLOW = ".github/workflows/deployed.yml";
export const L6_ORIGIN = "tests/deployment/origin.ts";
export const L6_SUITE = "tests/deployment/the-origin-that-answers.deployment.test.ts";
export const SHA_CONTROL = "tests/fixtures/controls/deployed-sha.control.test.ts";
export const VERCEL_CONFIG = "vercel.json";

const read = (root: string, path: string) =>
  existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null;

function lineOf(text: string, needle: string): number {
  const at = text.indexOf(needle);
  return at < 0 ? 1 : text.slice(0, at).split("\n").length;
}

export function rollbackDrift(root: string): Finding[] {
  const out: Finding[] = [];
  const doc = read(root, ROLLBACK_DOC);
  const workflow = read(root, DEPLOYED_WORKFLOW);
  const origin = read(root, L6_ORIGIN);
  const suite = read(root, L6_SUITE);
  const vercel = read(root, VERCEL_CONFIG);

  if (doc === null) {
    out.push({ file: ROLLBACK_DOC, line: 1, text: "the rollback procedure is not written down" });
  } else {
    for (const named of [DEPLOYED_WORKFLOW, "DEPLOYED_SHA", SHA_CONTROL]) {
      if (!doc.includes(named)) {
        out.push({ file: ROLLBACK_DOC, line: 1, text: `does not name ${named}, which its evidence rests on` });
      }
    }
    /* The evidence step itself, as the operator types it: not a mention, the dispatch. */
    if (!/Run workflow[\s\S]{0,200}\bsha:\s*<40-hex/.test(doc)) {
      out.push({
        file: ROLLBACK_DOC,
        line: 1,
        text: "does not show the dispatch with its `sha:` input, so a reader cannot run the evidence step from it",
      });
    }
  }

  if (workflow === null) {
    out.push({ file: DEPLOYED_WORKFLOW, line: 1, text: "the L6 workflow is gone" });
  } else {
    /*
     * ANCHORED TO THE INPUTS BLOCK: `sha:` must be a direct child of `workflow_dispatch.inputs`, at
     * the indentation of its siblings, not a `with: sha:` on some step further down (the first
     * version matched any later `sha:` key; adversarial review, attack 6).
     */
    const dispatch = /^on:[\s\S]*?^ {2}workflow_dispatch:\s*\n((?: {4,}.*\n|\s*#.*\n)*)/m.exec(workflow);
    const inputs = dispatch ? /^ {4}inputs:\s*\n((?: {6,}.*\n|\s*#.*\n)*)/m.exec(dispatch[1]) : null;
    if (!inputs || !/^ {6}sha:/m.test(inputs[1])) {
      out.push({
        file: DEPLOYED_WORKFLOW,
        line: lineOf(workflow, "workflow_dispatch"),
        text: "workflow_dispatch has no `sha` input, so a rollback cannot name the commit it expects",
      });
    }
    if (!workflow.includes(SHA_CONTROL)) {
      out.push({
        file: DEPLOYED_WORKFLOW,
        line: 1,
        text: `does not run ${SHA_CONTROL}, so the SHA binding is never shown to fail before it is trusted`,
      });
    }
  }

  if (origin === null || !origin.includes("export function servesExpectedBuild")) {
    out.push({ file: L6_ORIGIN, line: 1, text: "servesExpectedBuild is gone; nothing binds a run to a commit" });
  }
  if (suite === null || !suite.includes("servesExpectedBuild(")) {
    out.push({ file: L6_SUITE, line: 1, text: "the L6 suite no longer calls servesExpectedBuild" });
  }
  if (read(root, SHA_CONTROL) === null) {
    out.push({ file: SHA_CONTROL, line: 1, text: "the SHA-mismatch control is gone" });
  }

  if (vercel === null) {
    out.push({ file: VERCEL_CONFIG, line: 1, text: "vercel.json is gone" });
  } else {
    let installCommand: unknown;
    try {
      installCommand = (JSON.parse(vercel) as { installCommand?: unknown }).installCommand;
    } catch {
      out.push({ file: VERCEL_CONFIG, line: 1, text: "vercel.json is not JSON" });
    }
    if (typeof installCommand !== "string" || !/^npm ci\b/.test(installCommand)) {
      out.push({
        file: VERCEL_CONFIG,
        line: lineOf(vercel, "installCommand"),
        text: "installCommand is not `npm ci`, so a redeploy of a known-good commit may install a different tree",
      });
    }
  }
  return out;
}
