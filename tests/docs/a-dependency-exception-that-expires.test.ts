/**
 * `docs/dependency-exceptions.json`: every accepted advisory has an id, a package, a reason and an
 * expiry in the future. The day one expires this fails, which is the whole point of writing the
 * date down.
 *
 * Also holds the two mechanical halves of the policy to what the document says: every GitHub
 * Action in every workflow is pinned to a 40-hex commit, and every `overrides` entry in
 * package.json is explained in the policy document by name.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Exception = { advisory: string; package: string; reason: string; expires: string };

describe("dependency exceptions", () => {
  const file = JSON.parse(readFileSync("docs/dependency-exceptions.json", "utf8")) as {
    exceptions: Exception[];
  };

  it("are well-formed and none has expired", () => {
    expect(Array.isArray(file.exceptions)).toBe(true);
    const today = new Date().toISOString().slice(0, 10);
    for (const e of file.exceptions) {
      expect(e.advisory, JSON.stringify(e)).toMatch(/^GHSA-|^CVE-\d{4}-\d+$/);
      expect(e.package.length, JSON.stringify(e)).toBeGreaterThan(0);
      expect(e.reason.length, JSON.stringify(e)).toBeGreaterThan(20);
      expect(e.expires, JSON.stringify(e)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.expires > today, `${e.advisory} on ${e.package} expired ${e.expires}`).toBe(true);
    }
  });
});

describe("the mechanical halves of docs/DEPENDENCY_POLICY.md", () => {
  it("pins every action in every workflow to a commit, with the version beside it", () => {
    for (const name of readdirSync(".github/workflows")) {
      const text = readFileSync(`.github/workflows/${name}`, "utf8");
      const uses = [...text.matchAll(/^\s*-?\s*uses:\s*(\S+)(.*)$/gm)];
      expect(uses.length, `${name} declares no actions`).toBeGreaterThan(0);
      for (const [, ref, rest] of uses) {
        expect(ref, `${name}: ${ref} is not pinned to a 40-hex commit`).toMatch(/@[0-9a-f]{40}$/);
        expect(rest, `${name}: ${ref} has no version comment`).toMatch(/#\s*v\d/);
      }
    }
  });

  it("explains every override in the policy document by package name", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { overrides?: Record<string, string> };
    const policy = readFileSync("docs/DEPENDENCY_POLICY.md", "utf8");
    for (const name of Object.keys(pkg.overrides ?? {})) {
      expect(policy, `override of ${name} is not explained in the policy`).toContain(`\`${name}\``);
    }
  });

  it("reads the Node major from one place", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { engines?: { node?: string } };
    expect(pkg.engines?.node).toMatch(/^\d+\.x$/);
    for (const name of readdirSync(".github/workflows")) {
      const text = readFileSync(`.github/workflows/${name}`, "utf8");
      expect(text, `${name} names a Node version instead of reading package.json`).not.toMatch(/node-version:\s*\d/);
      expect(text).toContain("node-version-file: package.json");
    }
  });
});
