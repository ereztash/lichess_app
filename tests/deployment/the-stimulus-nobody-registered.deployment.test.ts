/**
 * `L6`. Is the origin a participant will open still serving the stimulus that was registered?
 *
 * WHAT WAS MISSING. `write-stimulus-manifest.ts` closed the gap between the stimulus and its name:
 * the origin now publishes one `stimulus_sha256` over all forty files it emits, so a swapped Hebrew
 * face can no longer hide behind an unchanged JS filename. What consumed that number was a person.
 * `research/player-path/field/README.md` step 2 asked the moderator to open the manifest in a
 * browser and confirm the digest matched the protocol, by eye, sixty seconds before a participant
 * sat down. Sixty-four hex characters compared by eye is a check that passes.
 *
 * AND NOBODY WAS WATCHING BETWEEN SESSIONS. Production tracks `main`. The protocol's own words:
 * *"any merge invalidates it, and two have."* The pre-session check, however good, only ever runs
 * when a session is about to start, so a merge that moved the stimulus was invisible until the
 * moderator was already in the room with a participant. This runs on every production deployment
 * and once a day besides, which is the interval at which the answer can still change the plan.
 *
 * WHY IT IS NOT SIMPLY RED TODAY. The run has not started and the digest moves with every merge,
 * so the escalation rule lives in `scripts/field-stimulus.ts` rather than here: a moved stimulus
 * warns while `state` is `open` and `participantsRun` is zero, and fails the moment either leaves
 * that state. The verdict is pure and the control proves it goes red; this file fetches and
 * reports. What is red in every state -- an unreachable origin, a build with no manifest, a changed
 * storage model -- is red here too.
 *
 * NO WRITES, on this suite's standing rule. Three reads of paths a participant's browser fetches
 * anyway.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe as vitestDescribe, expect, it } from "vitest";
import { isStimulusManifest } from "../../scripts/stimulus-manifest";
import {
  escalationNote,
  isRegisteredStimulus,
  registrationProblem,
  stimulusVerdict,
  type ObservedOrigin,
  type RegisteredStimulus,
} from "../../scripts/field-stimulus";
import { DEPLOYED_ORIGIN, get, hasOrigin } from "./origin";

const root = resolve(__dirname, "../..");

/**
 * The registration, read rather than restated.
 *
 * IT THROWS RATHER THAN SKIPPING. A missing or malformed registration is not the `DEPLOYED_ORIGIN`
 * case: the file is in the checkout, so failing to read it means the field package is broken and a
 * quiet skip would report that as nothing at all.
 */
function readRegistration(): RegisteredStimulus {
  const path = resolve(root, "research/player-path/field/REGISTERED_STIMULUS.json");
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRegisteredStimulus(parsed)) {
    throw new Error(`${path} is not a valid stimulus registration`);
  }
  return parsed;
}

const registration = readRegistration();

/**
 * The origin the registration names, unless a run was pointed somewhere else on purpose.
 *
 * `DEPLOYED_ORIGIN` WINS WHEN IT DISAGREES, and the suite says so in its own name rather than
 * silently checking production while the workflow believed it was checking a preview.
 */
const origin = hasOrigin ? DEPLOYED_ORIGIN : registration.origin;
const suite = hasOrigin ? vitestDescribe : vitestDescribe.skip;

/** The three readings, taken once and shared, so the verdict describes one moment. */
async function observe(): Promise<ObservedOrigin> {
  let reachable = false;
  try {
    const page = await get("/", origin);
    reachable = page.status === 200;
  } catch {
    reachable = false;
  }

  let manifestDigest: string | null = null;
  let manifestProblem: string | null = null;
  try {
    const fetched = await get("/stimulus-manifest.json", origin);
    if (fetched.status >= 300 && fetched.status < 400) {
      manifestProblem = `answered ${fetched.status}, a redirect; the origin is behind protection`;
    } else if (fetched.status !== 200) {
      manifestProblem = `answered ${fetched.status}`;
    } else if (!fetched.contentType.includes("application/json")) {
      manifestProblem = `answered 200 as \`${fetched.contentType}\`, which is the SPA fallback: this build predates the manifest`;
    } else {
      const parsed: unknown = JSON.parse(fetched.body);
      if (!isStimulusManifest(parsed)) {
        manifestProblem = "answered JSON that is not a stimulus manifest";
      } else {
        manifestDigest = parsed.stimulus_sha256;
      }
    }
  } catch (error) {
    manifestProblem = `could not be read: ${String(error)}`;
  }

  let storage: string | null = null;
  let gitSha: string | null = null;
  try {
    const health = await get("/api/health", origin);
    if (health.status === 200 && health.contentType.includes("application/json")) {
      const parsed = JSON.parse(health.body) as {
        checks?: { storage?: unknown };
        build?: { gitSha?: unknown };
      };
      // NESTED UNDER `checks`, NOT AT THE TOP LEVEL. The protocol carried the wrong shape once and
      // a moderator looking at the top level would have found nothing and reported a failure.
      if (typeof parsed.checks?.storage === "string") storage = parsed.checks.storage;
      if (typeof parsed.build?.gitSha === "string") gitSha = parsed.build.gitSha;
    }
  } catch {
    storage = null;
  }

  return { reachable, manifestDigest, manifestProblem, storage, gitSha };
}

suite(`the registered FIELD stimulus at ${origin}`, () => {
  it("carries a registration the protocol permits", () => {
    // BEFORE ANY READING OF THE ORIGIN. `open` with participants already run is the combination
    // FIELD_RUN_CURRENT.md forbids, and every verdict below would be computed under the wrong rule.
    expect(registrationProblem(registration) ?? "").toBe("");
  });

  it("still serves the stimulus the protocol registered", async () => {
    const observed = await observe();
    const verdict = stimulusVerdict(registration, observed);

    // PRINTED WHATEVER THE VERDICT, because a green run that says nothing leaves the next reader
    // unable to tell a checked origin from an unchecked one.
    console.log(
      [
        "",
        `FIELD stimulus check -- ${origin}`,
        escalationNote(registration),
        "",
        ...verdict.lines.map((line) => `  ${line}`),
        "",
      ].join("\n"),
    );

    if (verdict.severity === "fail") {
      expect.fail(verdict.lines.filter((line) => line.startsWith("FAIL")).join("\n"));
    }
  });
});
