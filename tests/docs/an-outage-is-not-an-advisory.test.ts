/**
 * The audit step retries a dead endpoint and never retries a finding.
 *
 * WHY THE STEP HAS A LOOP AT ALL. `npm audit --omit=dev --audit-level=high` went red three times
 * in two hours with no advisory in existence, against
 * `registry.npmjs.org/-/npm/v1/security/advisories/bulk`, twice with a 503 and once with a network
 * timeout. It runs BEFORE the build, the tests, the gates and the bundle budget, and a job stops
 * at its first failing step -- so an outage at npm did not cost the audit signal, it cost every
 * signal, and a red `verify` meant "npm was busy" rather than anything about the commit.
 *
 * WHY THIS FILE EXISTS RATHER THAN TRUST IN THE COMMENT. A retry loop that cannot tell an outage
 * from a vulnerability is strictly worse than no loop: it would swallow the finding the step is
 * for, three times, and then go green on the fourth if the endpoint hiccupped at the right moment.
 * The whole safety of the change is one `case` arm, and one `case` arm is exactly the kind of
 * thing a later edit widens by accident.
 *
 * SO THE SCRIPT IS RUN, NOT READ. The step body is lifted out of the YAML and executed against a
 * fake `npm` on `PATH` in four states: clean, a high-severity finding, a total outage, and an
 * endpoint that fails twice and then answers. Asserting on the text of the script would pass for
 * a loop that had been rewritten to retry everything.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/*
 * A six-line reader rather than a YAML dependency, and the trade is the point: pulling a parser
 * into the tree to test the step that audits the tree would add a package to the thing being
 * audited. The file is one job with one list of steps and the shape is asserted below, so a
 * rewrite that broke this reader fails loudly instead of silently matching nothing.
 */
const source = readFileSync(".github/workflows/verify-build.yml", "utf8");

/** Every `- name:` step, in file order, with its `run: |` block dedented. */
function stepsOf(yaml: string): { name: string; run: string }[] {
  const out: { name: string; run: string }[] = [];
  const lines = yaml.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const named = /^(\s*)- name: (.+)$/.exec(lines[i]);
    if (!named) continue;
    const [, indent, name] = named;
    const body: string[] = [];
    let j = i + 1;
    let inRun = false;
    let runIndent = "";
    for (; j < lines.length; j += 1) {
      const line = lines[j];
      if (new RegExp(`^${indent}- `).test(line)) break;
      if (!inRun) {
        const oneLine = /^\s*run: (?!\|)(.+)$/.exec(line);
        if (oneLine) { body.push(oneLine[1]); break; }
        if (/^\s*run: \|\s*$/.test(line)) {
          inRun = true;
          runIndent = /^(\s*)/.exec(lines[j + 1] ?? "")![1];
        }
        continue;
      }
      if (line.trim() !== "" && !line.startsWith(runIndent)) break;
      body.push(line.slice(runIndent.length));
    }
    out.push({ name, run: body.join("\n") });
  }
  return out;
}

const steps = stepsOf(source);
const audit = steps.find((s) => s.name.startsWith("Audit"));

const dir = mkdtempSync(join(tmpdir(), "audit-step-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/*
 * The fake stands in for every way `npm audit` can end. `advisory` is the one that matters: it
 * exits non-zero with a report and says nothing about an endpoint, which is what a real
 * vulnerability looks like.
 */
const FAKE = `#!/usr/bin/env bash
case "$MODE" in
  clean)    echo "found 0 vulnerabilities"; exit 0 ;;
  advisory) echo "# npm audit report"; echo "1 high severity vulnerability"; exit 1 ;;
  outage)   echo "npm error audit endpoint returned an error" >&2; exit 1 ;;
  flaky)    n=$(cat "$COUNTER" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "$COUNTER"
            if [ "$n" -lt 3 ]; then echo "npm error audit endpoint returned an error" >&2; exit 1; fi
            echo "found 0 vulnerabilities"; exit 0 ;;
esac
`;

writeFileSync(join(dir, "npm"), FAKE);
chmodSync(join(dir, "npm"), 0o755);
/*
 * A `sleep` that does not sleep. The back-off is 20s then 40s, so the two outage cases would spend
 * a real minute each proving something about a `case` arm. Stubbed on PATH rather than removed
 * from the script: the thing under test stays byte-identical to the thing that runs in CI.
 */
writeFileSync(join(dir, "sleep"), "#!/usr/bin/env bash\nexit 0\n");
chmodSync(join(dir, "sleep"), 0o755);

/** Run the step body exactly as the runner does: `bash -e`, with the fake first on PATH. */
function run(mode: string): { code: number; out: string } {
  writeFileSync(join(dir, "counter"), "0");
  const script = join(dir, "step.sh");
  writeFileSync(script, audit!.run!);
  try {
    const out = execFileSync("bash", ["-e", script], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        MODE: mode,
        COUNTER: join(dir, "counter"),
      },
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
}

describe("the audit step", () => {
  it("is still the step this file is about, and still runs before the build", () => {
    /*
     * A guard against the other honest fix. Moving the audit after the tests would also stop an
     * outage costing every signal, and would make this file's premise false without failing it.
     * If that day comes, this assertion is the reminder to revisit the loop rather than keep it
     * out of habit.
     */
    expect(steps.length, "the step reader matched nothing, so every assertion below is vacuous")
      .toBeGreaterThan(3);
    expect(audit, "the audit step was renamed or removed").toBeTruthy();
    expect(audit!.run, "the audit step no longer runs a script").toContain("npm audit");
    /*
     * Matched exactly, because "Audit the dependencies this build ships" contains the word build
     * and a loose regex found the audit step as its own successor. The premise of this file is
     * that the audit runs before the work, so the assertion has to be about the other steps.
     */
    for (const name of ["Build", "Test", "Gates"]) {
      const at = steps.findIndex((s) => s.name === name);
      expect(at, `there is no step named ${name} any more`).toBeGreaterThanOrEqual(0);
      expect(
        steps.indexOf(audit!),
        `the audit no longer runs before ${name}, so an outage may already cost only the audit`,
      ).toBeLessThan(at);
    }
  });

  it("keeps the flags that decide what it asks about", () => {
    expect(audit!.run, "the audit stopped being about what the deployment ships").toContain(
      "--omit=dev",
    );
    expect(audit!.run, "the severity floor moved").toContain("--audit-level=high");
  });

  it("passes a clean audit on the first attempt", () => {
    const { code, out } = run("clean");
    expect(code).toBe(0);
    expect(out).toContain("found 0 vulnerabilities");
    expect(out, "a clean run retried").not.toContain("attempt 1 of 3");
  });

  /*
   * THE ASSERTION THE WHOLE CHANGE RESTS ON. A loop that retried this would swallow the finding
   * the step exists to surface, and would then pass on a lucky attempt.
   */
  it("fails a real advisory immediately, with no retry", () => {
    const { code, out } = run("advisory");
    expect(code, "an advisory did not fail the step").toBe(1);
    expect(out).toContain("1 high severity vulnerability");
    expect(out, "the loop retried a vulnerability").not.toContain("attempt 1 of 3");
    expect(out, "an advisory was reported as an endpoint outage").not.toContain("::error::");
  });

  it("retries an unreachable endpoint, then fails red and says why", () => {
    const { code, out } = run("outage");
    expect(code, "a total outage passed the step").toBe(1);
    expect(out).toContain("attempt 1 of 3");
    expect(out).toContain("attempt 3 of 3");
    expect(out, "the job went red without naming the cause").toContain(
      "::error::npm advisories endpoint unreachable",
    );
  });

  it("recovers when the endpoint answers on a later attempt", () => {
    const { code, out } = run("flaky");
    expect(code, "a recoverable outage still failed the build").toBe(0);
    expect(out).toContain("attempt 2 of 3");
    expect(out).toContain("found 0 vulnerabilities");
  });

  /*
   * The five-minute stalls in the logs were `fetch-timeout`, whose npm default is 300000 ms.
   * Without a shorter one, three attempts cost fifteen minutes and the cure is worse than the
   * disease.
   */
  it("does not let three attempts cost more wall clock than one did", () => {
    const match = audit!.run!.match(/--fetch-timeout=(\d+)/);
    expect(match, "no fetch timeout, so each attempt can stall for npm's default five minutes")
      .not.toBeNull();
    expect(Number(match![1]), "the timeout is not shorter than npm's 300000 default").toBeLessThan(
      300000,
    );
  });
});
