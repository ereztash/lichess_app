// @vitest-environment jsdom
/**
 * A self-check report that cannot say which build it ran on cannot be acted on.
 *
 * Two people send reports on the same day; one loaded the app before a deploy and one after. Without
 * a build on the report the operator cannot say which fix to confirm or which regression to blame.
 * The check reads the same file the L6 suite reads, and refuses the same way: an SPA fallback
 * answers `200 text/html` for any unknown path, and reading that as "an older build" would be a
 * confident and false diagnosis, so the check names the fallback instead.
 */
import { describe, expect, it } from "vitest";
import { checkBuild, formatReport, type CheckEnv } from "@/lib/self-check";

const env = (response: Response): CheckEnv =>
  ({ fetch: async () => response }) as unknown as CheckEnv;

describe("the build on the report", () => {
  it("is read from /build-identity.json and printed first", async () => {
    const result = await checkBuild(
      env(
        new Response(
          JSON.stringify({
            gitSha: "c848f244d380e13a8622c590791b22a2bef7a39b",
            builtAt: "2026-09-02T12:43:22.048Z",
            target: "production",
            protocolVersion: "1.0.0",
          }),
          { status: 200, headers: { "content-type": "application/json; charset=utf-8" } },
        ),
      ),
    );
    expect(result.status).toBe("pass");
    expect(result.detail).toContain("build=c848f244d380");
    expect(result.detail).toContain("target=production");
    const report = formatReport([result], "2026-09-02T13:00:00Z");
    expect(report.split("\n")[0]).toContain("build=c848f244d380");
  });

  it("names the SPA fallback for what it is, rather than reading it as a build", async () => {
    const result = await checkBuild(
      env(new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } })),
    );
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("קדם לזהות הבילד");
    expect(formatReport([result], "x").split("\n")[0]).toContain("build=unknown");
  });

  it("is a failure, not a guess, when the file is missing or malformed", async () => {
    expect((await checkBuild(env(new Response("", { status: 404 })))).status).toBe("fail");
    expect(
      (
        await checkBuild(
          env(new Response(JSON.stringify({ hello: 1 }), { status: 200, headers: { "content-type": "application/json" } })),
        )
      ).status,
    ).toBe("fail");
  });
});
