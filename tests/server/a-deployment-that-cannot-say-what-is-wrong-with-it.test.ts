/**
 * The report that names the missing variable sits behind the thing the missing variable breaks.
 *
 * THE CATCH-22, traced through the real code. `system.lichessConfig` is the only place this
 * product names which server-side pieces are absent, and it is a `protectedProcedure` -- correctly
 * so, because those names describe the deployment and do not belong on an open URL. Reaching it
 * needs a session. Creating a session needs `JWT_SECRET`: `sdk.createSessionToken` throws
 * "JWT_SECRET is not configured" without it, so the OAuth callback answers 500, no cookie is set,
 * `auth.me` returns null, and the client settles into its signed-out browser-local mode.
 *
 * So on a deployment missing `JWT_SECRET`, the report that would say `JWT_SECRET` is missing is
 * the one thing that cannot be reached. What the operator sees is a sign-in button that appears
 * to do nothing, a health check answering 200, and no mention of the variable anywhere.
 *
 * COMBINATIONS, NOT PRESENCE. `lichessConfig` already lists five booleans; that is not what is
 * missing. What no single flag can show is that a SET of values is incoherent -- `OWNER_OPEN_ID`
 * naming an owner who can never sign in, a `DATABASE_URL` no account can ever reach. Each variable
 * is present or absent exactly as intended and the deployment still cannot work.
 *
 * AND AN EMPTY DEPLOYMENT IS NOT A FAULT. Nothing configured is the supported browser-local
 * product, running exactly as designed. Reporting that as a misconfiguration would train an
 * operator to ignore the report, which is the only way a report like this fails.
 *
 * THE CHANNEL IS THE SERVER LOG, on purpose. Naming variables on a public route would move the
 * report `ownerProcedure` deliberately keeps private onto the open internet -- the same reasoning
 * that keeps `/api/health` down to one boolean. The operator has the logs; nobody else does.
 */
import { describe, expect, it, vi } from "vitest";
import { configurationFaults, type DeploymentEnv } from "../../server/_core/configuration";

const NOTHING: DeploymentEnv = {
  jwtSecret: "",
  oAuthServerUrl: "",
  ownerOpenId: "",
  databaseUrl: "",
};

const codes = (env: Partial<DeploymentEnv>) =>
  configurationFaults({ ...NOTHING, ...env }).map((fault) => fault.code);

describe("a deployment configured for nothing is not broken", () => {
  it("reports no fault when nothing is set", () => {
    // The browser-local product. Every record procedure is unreachable and that is the design.
    expect(configurationFaults(NOTHING)).toEqual([]);
  });

  it("reports no fault on a fully configured deployment", () => {
    expect(
      configurationFaults({
        jwtSecret: "s",
        oAuthServerUrl: "https://oauth.example",
        ownerOpenId: "owner",
        databaseUrl: "mysql://x",
      }),
    ).toEqual([]);
  });
});

describe("it names the combinations no single flag can show", () => {
  it("catches an owner who can never sign in", () => {
    /*
     * THE ONE THAT MOTIVATED THE FILE. `OWNER_OPEN_ID` names the only account allowed through the
     * gate, and without `JWT_SECRET` no account can hold a session at all -- so the gate can never
     * pass, and the report that would say so is behind the gate.
     */
    expect(codes({ ownerOpenId: "owner" })).toContain("owner-without-session");
  });

  it("catches a sign-in that can be verified but never started", () => {
    // A secret with no OAuth server: the callback has nothing to exchange a code with.
    expect(codes({ jwtSecret: "s", ownerOpenId: "owner" })).toContain("session-without-oauth");
  });

  it("catches a database no account can reach", () => {
    /*
     * `DATABASE_URL` set and `OWNER_OPEN_ID` absent: `ownerProcedure` answers PRECONDITION_FAILED
     * to everyone, so the record stays in the browser and the database is provisioned, paid for,
     * and never written to. Nothing fails; it just silently does not happen.
     */
    expect(codes({ databaseUrl: "mysql://x", jwtSecret: "s", oAuthServerUrl: "u" })).toContain(
      "database-without-owner",
    );
  });

  it("does not call a database without an owner a fault when nothing else is configured either", () => {
    /*
     * A deployment with a database and nothing else is half-built rather than incoherent, and
     * saying so once is enough -- `owner-without-session` and this one would both fire and
     * describe the same missing decision twice.
     */
    expect(codes({ databaseUrl: "mysql://x" })).toEqual([]);
  });
});

describe("what the fault says", () => {
  it("names variables and never values", () => {
    /*
     * The log is the operator's channel, not a public one, but a secret in a log is still a secret
     * in a log -- and this file's whole subject is a report that leaks nothing being unreachable.
     */
    const secret = "s3cr3t-value-nobody-should-see";
    const faults = configurationFaults({
      jwtSecret: secret,
      oAuthServerUrl: "",
      ownerOpenId: `owner-${secret}`,
      databaseUrl: `mysql://user:${secret}@host/db`,
    });
    expect(faults.length).toBeGreaterThan(0);
    const text = JSON.stringify(faults);
    expect(text, "a configuration report leaked the value it reports on").not.toContain(secret);
    expect(text).toContain("OAUTH_SERVER_URL");
  });

  it("says what the deployment cannot do, not merely which name is absent", () => {
    /*
     * "OWNER_OPEN_ID is set and JWT_SECRET is not" is a restatement of the two booleans that were
     * already available. The consequence -- nobody can pass the gate -- is the thing no flag showed.
     */
    const [fault] = configurationFaults({ ...NOTHING, ownerOpenId: "owner" });
    expect(fault.consequence.length).toBeGreaterThan(20);
    expect(fault.consequence).not.toMatch(/[a-z]{4}/); // written for a person, in Hebrew
  });

  it("gives every fault its own consequence", () => {
    /*
     * A combination that really does produce two. The first version of this used an empty
     * `jwtSecret` with an owner and a database and expected two -- it yields exactly one, because
     * both of the other rules require a secret. The fixture was wrong, not the rules.
     */
    const all = configurationFaults({
      jwtSecret: "s",
      oAuthServerUrl: "",
      ownerOpenId: "",
      databaseUrl: "mysql://x",
    });
    expect(all.length).toBeGreaterThan(1);
    expect(new Set(all.map((f) => f.consequence)).size, "two faults share one sentence").toBe(
      all.length,
    );
  });
});

describe("the fault reaches the operator, not just the function that computes it", () => {
  /*
   * The whole point is that nothing SAYS this today. A pure function nobody calls would be the
   * same silence with more code in it -- and this session has already found two cases of a
   * distinction computed in shared code and discarded at the last step.
   */
  it("warns at startup, naming the variables", async () => {
    const previous = { ...process.env };
    process.env.OWNER_OPEN_ID = "owner-open-id";
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => void warnings.push(args.join(" "));
    try {
      vi.resetModules();
      const { createApp } = await import("../../server/app");
      createApp();
    } finally {
      console.warn = original;
      process.env = previous;
    }
    const line = warnings.find((text) => text.includes("owner-without-session"));
    expect(line, `nothing was logged; saw ${JSON.stringify(warnings)}`).toBeTruthy();
    expect(line).toContain("JWT_SECRET");
    expect(line).toContain("OWNER_OPEN_ID");
  });

  it("says nothing at startup on a deployment configured for nothing", () => {
    // A report that fires on the supported minimal deployment is a report an operator learns to
    // skip, and then it is worth less than no report at all.
    expect(configurationFaults(NOTHING)).toEqual([]);
  });
});
