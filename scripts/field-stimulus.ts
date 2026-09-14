/**
 * The registered stimulus, and the rule that decides when a mismatch stops being bookkeeping.
 *
 * WHY THIS EXISTS. `write-stimulus-manifest.ts` made the build's identity checkable: the origin now
 * serves one `stimulus_sha256` over everything it emitted. What consumed that number was still a
 * human. `research/player-path/field/README.md` step 2 asked a moderator to open the manifest in a
 * browser and confirm the digest "must equal the one in `../FIELD_RUN_CURRENT.md`" -- a
 * 64-character hex comparison, by eye, in the minute before a participant sits down. That is the
 * class of check that passes. The digest closed the gap between the stimulus and its NAME; this
 * closes the gap between the name and the person reading it.
 *
 * AND THE PROTOCOL ALREADY CARRIED THE RULE IN PROSE. `FIELD_RUN_CURRENT.md`: *"Zero participants
 * have run, which is what makes this bookkeeping rather than a protocol violation. After the first
 * session it would be one, and the same change would have to wait."* That sentence is a state
 * machine and it was enforced by nobody. It is `registration.state` below.
 *
 * WHY A MISMATCH IS NOT ALWAYS RED, which is the part worth arguing with. Production tracks `main`,
 * so today every merge moves the digest and a check that failed on each one would be red
 * continuously for a reason nobody can act on until the run starts. `stimulus-manifest.ts` states
 * the cost of that directly: *"A check that fires when nothing moved is a check the moderator
 * learns to override, and an overridden check is worse than an absent one."* So while the run is
 * `open` and no participant has run, a moved digest is a WARN naming the re-point. The moment
 * `participantsRun` leaves zero the identical mismatch is a FAIL, and no new mechanism has to be
 * built by somebody under time pressure to make that happen.
 *
 * WHAT IS RED IN EVERY STATE, because none of it is ever bookkeeping: an origin a participant
 * cannot open, a build serving no manifest at all, and a storage model that is not the one every
 * walk was performed against. A registration that says `open` while participants have already run
 * is red for the same reason -- it is the one combination the protocol forbids outright.
 *
 * This module is the registration format and the verdict, and nothing else. The fetching is in
 * `tests/deployment/the-stimulus-nobody-registered.deployment.test.ts`, on the
 * `stimulus-manifest.ts` / `write-stimulus-manifest.ts` precedent: the thing a reviewer has to
 * agree with is a rule rather than an IO script.
 */

/** Where the registration lives, relative to the repository root. */
export const REGISTERED_STIMULUS_PATH = "research/player-path/field/REGISTERED_STIMULUS.json";

export const REGISTRATION_VERSION = 1;

/**
 * `open` -- no participant has run, and the stimulus may still be re-pointed.
 * `frozen` -- re-pointing is a protocol violation, whatever the participant count says.
 */
export type RunState = "open" | "frozen";

export interface RegisteredStimulus {
  readonly registrationVersion: number;
  readonly state: RunState;
  /** Sessions actually run against this registration. Above zero forces `frozen`. */
  readonly participantsRun: number;
  /** The address handed to a participant, no trailing slash. */
  readonly origin: string;
  /** The digest the origin must serve. Lowercase hex, 64 characters. */
  readonly stimulus_sha256: string;
  /** Provenance. Beside the digest, never compared against it: see `stimulus-manifest.ts`. */
  readonly gitSha: string;
  readonly files: number;
  readonly bytes: number;
  /** What `/api/health` must report for `checks.storage`. */
  readonly storage: string;
  readonly registeredAt: string;
  readonly protocol: string;
}

/** A shape check with a reason, so a malformed registration fails where it is read. */
export function isRegisteredStimulus(value: unknown): value is RegisteredStimulus {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.registrationVersion !== REGISTRATION_VERSION) return false;
  if (v.state !== "open" && v.state !== "frozen") return false;
  if (typeof v.participantsRun !== "number" || !Number.isInteger(v.participantsRun)) return false;
  if (v.participantsRun < 0) return false;
  if (typeof v.origin !== "string" || !v.origin.startsWith("https://")) return false;
  if (v.origin.endsWith("/")) return false;
  if (typeof v.stimulus_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(v.stimulus_sha256)) {
    return false;
  }
  if (typeof v.gitSha !== "string" || !/^[0-9a-f]{40}$/.test(v.gitSha)) return false;
  if (typeof v.files !== "number" || typeof v.bytes !== "number") return false;
  if (typeof v.storage !== "string" || v.storage.length === 0) return false;
  return typeof v.registeredAt === "string" && typeof v.protocol === "string";
}

/**
 * What the origin was observed to answer.
 *
 * EVERY FIELD IS A READING RATHER THAN A JUDGEMENT, so the verdict below is falsifiable against a
 * literal. `manifestDigest` is `null` when the origin served no manifest -- which, on this host, is
 * a `200 text/html` SPA fallback and not a `404`. `manifestProblem` says which of the two it was,
 * because "no manifest" and "unreachable" have different repairs and the first version of the
 * moderator's step conflated them.
 */
export interface ObservedOrigin {
  readonly reachable: boolean;
  readonly manifestDigest: string | null;
  readonly manifestProblem: string | null;
  readonly storage: string | null;
  readonly gitSha: string | null;
}

export type Severity = "pass" | "warn" | "fail";

export interface Verdict {
  readonly severity: Severity;
  readonly lines: readonly string[];
}

/** `fail` beats `warn` beats `pass`, so one red reading cannot be averaged away by four green ones. */
function worst(a: Severity, b: Severity): Severity {
  if (a === "fail" || b === "fail") return "fail";
  if (a === "warn" || b === "warn") return "warn";
  return "pass";
}

/**
 * Is the registration internally coherent?
 *
 * `open` with participants already run is the one combination `FIELD_RUN_CURRENT.md` forbids
 * outright, and it is exactly the state a moderator would leave behind by running a session and
 * forgetting the count. It is red before any reading of the origin, because with the count wrong
 * every other verdict on this page is computed under the wrong rule.
 */
export function registrationProblem(registration: RegisteredStimulus): string | null {
  if (registration.state === "open" && registration.participantsRun > 0) {
    return (
      `the registration says \`open\` with ${registration.participantsRun} participant(s) already ` +
      `run. Re-pointing the stimulus stopped being bookkeeping at the first session: set ` +
      `\`state\` to \`frozen\`, or correct the count if no session has run`
    );
  }
  return null;
}

/**
 * The verdict, from the registration and the readings.
 *
 * PURE, so the escalation can be falsified without a deployment: the control in
 * `tests/fixtures/controls/field-stimulus.control.test.ts` hands it a frozen registration and a
 * moved digest and MUST go red. If this ever answers `pass` or `warn` for that pair, a session
 * would run against a stimulus nobody registered and the record would not say so.
 */
export function stimulusVerdict(
  registration: RegisteredStimulus,
  observed: ObservedOrigin,
): Verdict {
  const lines: string[] = [];
  let severity: Severity = "pass";
  const say = (level: Severity, line: string): void => {
    severity = worst(severity, level);
    lines.push(`${level.toUpperCase().padEnd(4)} ${line}`);
  };

  const incoherent = registrationProblem(registration);
  if (incoherent) say("fail", `registration -- ${incoherent}`);

  // A MOVED STIMULUS IS BOOKKEEPING ONLY WHILE BOTH HOLD. The state is the declaration; the count
  // is the fact. Either one being past `open`/zero makes the mismatch a protocol violation.
  const stillBookkeeping = registration.state === "open" && registration.participantsRun === 0;
  const onMismatch: Severity = stillBookkeeping ? "warn" : "fail";

  if (!observed.reachable) {
    say("fail", `${registration.origin} did not answer 200 to a signed-out visitor`);
  } else {
    say("pass", `${registration.origin} answers 200 signed out`);
  }

  if (observed.manifestDigest === null) {
    // NEVER A WARN, IN EITHER STATE. A build with no manifest is not a build that moved; it is a
    // build the freeze check cannot read at all, so there is nothing to be lenient about.
    say(
      "fail",
      `no stimulus manifest at ${registration.origin}/stimulus-manifest.json -- ` +
        `${observed.manifestProblem ?? "reason not recorded"}. The check is the content and never ` +
        `the status code: an SPA fallback answers 200 text/html for any unknown path`,
    );
  } else if (observed.manifestDigest === registration.stimulus_sha256) {
    say("pass", `stimulus ${registration.stimulus_sha256.slice(0, 12)} is the registered one`);
  } else {
    say(
      onMismatch,
      `stimulus moved: registered ${registration.stimulus_sha256.slice(0, 12)}, origin serves ` +
        `${observed.manifestDigest.slice(0, 12)}` +
        (stillBookkeeping
          ? `. Zero participants have run, so this is a re-point rather than a violation -- ` +
            `update ${REGISTERED_STIMULUS_PATH} and say in ${registration.protocol} why it moved`
          : `. Participants have run against the registered digest. STOP and check with the owner`),
    );
  }

  if (observed.storage === null) {
    say("fail", `${registration.origin}/api/health did not report checks.storage`);
  } else if (observed.storage === registration.storage) {
    say(
      "pass",
      `storage is \`${registration.storage}\`, the model every walk was performed against`,
    );
  } else {
    // NEVER A WARN EITHER. Storage is server configuration: it can change with no deployment at
    // all, so a mismatch here is never explained by a merge and is never the re-point case.
    say(
      "fail",
      `storage is \`${observed.storage}\`, registered as \`${registration.storage}\`. This can ` +
        `change with no deployment, so it is not a stale registration`,
    );
  }

  // gitSha IS REPORTED AND NEVER ASSERTED, on `stimulus-manifest.ts`'s rule: a commit touching only
  // `docs/` produces a byte-identical build, and failing on it would report a move that did not
  // happen. The digest is the claim about what the participant saw.
  if (observed.gitSha && observed.gitSha !== registration.gitSha) {
    say(
      "pass",
      `origin is built from ${observed.gitSha.slice(0, 12)}, registered against ` +
        `${registration.gitSha.slice(0, 12)}. Reported, not asserted: the digest above is the claim`,
    );
  }

  return { severity, lines };
}

/** The escalation, in one sentence, so a reader of the output knows what changes and when. */
export function escalationNote(registration: RegisteredStimulus): string {
  return registration.state === "open" && registration.participantsRun === 0
    ? `Run state: open, 0 participants. A moved stimulus is a WARN. It becomes a FAIL the moment ` +
        `\`participantsRun\` leaves zero or \`state\` reads \`frozen\` in ${REGISTERED_STIMULUS_PATH}.`
    : `Run state: ${registration.state}, ${registration.participantsRun} participant(s). A moved ` +
        `stimulus is a FAIL.`;
}
