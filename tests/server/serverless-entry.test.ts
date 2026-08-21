/**
 * The serverless entry must actually LOAD.
 *
 * This is the test that was missing, and its absence took production down while every other check
 * stayed green. `npm run verify` mounts the Express app in-process through vitest, so it never
 * touches api/[...path].ts at all; `tsc --noEmit` accepts extensionless relative imports because
 * moduleResolution is "bundler"; the Vite build only builds the client. Nothing in the pipeline
 * ever asked whether the file Vercel runs can be imported by Node.
 *
 * It could not. package.json says `"type": "module"`, so Vercel's emitted JS is ESM, and ESM does
 * not resolve extensionless relative specifiers the way CommonJS did:
 *
 *   Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/app'
 *   imported from /var/task/api/[...path].js
 *
 * Every API request returned FUNCTION_INVOCATION_FAILED. The original author had already hit this
 * and worked around it by inlining 250 lines into the entry -- the commit is literally titled
 * "Make Vercel API self-contained" -- and a later refactor reduced it to a three-line re-export,
 * which read as a cleanup and silently restored the crash.
 *
 * Two things this test does deliberately, because the obvious shortcuts both fail silently:
 *
 * 1. It spawns a real `node` process. Importing the emitted file from inside vitest proves
 *    nothing: Vite's module loader intercepts `import()` and resolves specifiers with its own
 *    bundler-style algorithm, which is exactly the algorithm that does NOT run in production.
 * 2. It emits inside the project directory. Emitting to /tmp makes the bare imports fail
 *    ("Cannot find package '@trpc/server'") because Node walks parent directories looking for
 *    node_modules, and /tmp has none -- a failure that looks like the bug but isn't.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "..", "..");
// Inside the project, so Node's node_modules lookup walks up into the real one.
const outDir = join(projectRoot, ".entry-check");
const entry = join(outDir, "api", "[...path].js");

/** What a fresh Node process reports after importing the emitted entry. */
type Probe = { ok: true; defaultType: string; isExpressApp: boolean } | { ok: false; error: string };

function importInRealNode(file: string): Probe {
  // Node, not vitest: the same ESM resolver the serverless runtime uses.
  const script = `
    const url = ${JSON.stringify(pathToFileURL(file).href)};
    import(url).then((m) => {
      const app = m.default ?? {};
      process.stdout.write(JSON.stringify({
        ok: true,
        defaultType: typeof m.default,
        isExpressApp: typeof app.use === "function" && typeof app.listen === "function",
      }));
    }).catch((error) => {
      process.stdout.write(JSON.stringify({
        ok: false,
        error: [error && error.code, error && error.message].filter(Boolean).join(": "),
      }));
    });
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: projectRoot,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, JWT_SECRET: process.env.JWT_SECRET ?? "test-secret-for-entry-load" },
  });
  if (!result.stdout) {
    return { ok: false, error: `node produced no output: ${result.stderr || result.error}` };
  }
  return JSON.parse(result.stdout) as Probe;
}

beforeAll(() => {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const config = join(outDir, "tsconfig.emit.json");
  writeFileSync(
    config,
    JSON.stringify({
      extends: resolve(projectRoot, "tsconfig.json"),
      compilerOptions: {
        noEmit: false,
        // The base config is incremental and its .tsbuildinfo is already up to date from
        // `npm run check`, so tsc would decide there is nothing to do and emit nothing at all.
        incremental: false,
        outDir: ".",
        rootDir: "..",
        declaration: false,
        sourceMap: false,
        // Emit what Vercel emits: ESM, relative specifiers preserved verbatim.
        module: "ESNext",
        allowImportingTsExtensions: false,
        skipLibCheck: true,
      },
      include: ["../api/**/*.ts", "../server/**/*.ts", "../shared/**/*.ts", "../drizzle/**/*.ts"],
    }),
  );
  // Type errors are `npm run check`'s job. Emit regardless; the import below is the assertion.
  try {
    execFileSync("npx", ["tsc", "-p", config], { cwd: projectRoot, stdio: "pipe" });
  } catch {
    /* ignored on purpose -- see above */
  }
}, 180_000);

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe("the file Vercel runs", () => {
  it("was emitted at all", () => {
    // If tsc emitted nothing the two tests below would pass or fail for reasons of their own.
    expect(existsSync(entry)).toBe(true);
  });

  it("imports in real Node without ERR_MODULE_NOT_FOUND", () => {
    const probe = importInRealNode(entry);
    // Assert on the error text so a failure names the unresolvable specifier instead of "false".
    expect(probe.ok ? null : probe.error).toBeNull();
  }, 90_000);

  it("hands back an Express app, not a bare object", () => {
    const probe = importInRealNode(entry);
    expect(probe.ok && probe.defaultType).toBe("function");
    expect(probe.ok && probe.isExpressApp).toBe(true);
  }, 90_000);
});
