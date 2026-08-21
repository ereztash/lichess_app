import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Config for gate POSITIVE CONTROLS only.
 *
 * Control files live under tests/fixtures/, which the main config excludes so they never break
 * `npm test`. They are expected to FAIL -- that failure is the proof a gate is a gate. This
 * config exists so they are actually collected and run; without it vitest reports "No test
 * files found" and exits 1, which looks like a passing control while proving nothing.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  test: {
    environment: "node",
    setupFiles: [path.resolve(import.meta.dirname, "tests/setup.ts")],
    globals: true,
    include: ["tests/fixtures/controls/**/*.test.ts", "tests/fixtures/controls/**/*.test.tsx"],
    exclude: ["node_modules", "dist"],
  },
});
