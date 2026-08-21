import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig sets jsx: "preserve" for Vite's own pipeline; Vitest transforms with esbuild and
  // needs the runtime named explicitly, otherwise component tests fail on "React is not defined".
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    // Node by default: most of this suite is server-side, and jsdom's TextEncoder produces
    // Uint8Array from a different realm, which fails jose's instanceof check when signing JWTs.
    // Component tests opt in per file with `// @vitest-environment jsdom`.
    environment: "node",
    globals: true,
    setupFiles: [path.resolve(import.meta.dirname, "tests/setup.ts")],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["node_modules", "dist", "tests/fixtures/**"],
  },
});
