import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * `npm run dev` was `vite` alone, so nothing mounted the Express app and every tRPC call 404ed
 * locally -- the API only existed once deployed. This mounts the same app the serverless entry
 * uses in both the dev server and `vite preview`, so every local server runs the production API
 * contract rather than silently serving index.html for /api routes.
 */
function apiDevServer(): Plugin {
  return {
    name: "api-dev-server",
    apply: "serve",
    async configureServer(server) {
      const { createApp } = await import("./server/app");
      server.middlewares.use(createApp());
    },
    async configurePreviewServer(server) {
      const { createApp } = await import("./server/app");
      server.middlewares.use(createApp());
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiDevServer()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: { outDir: path.resolve(import.meta.dirname, "dist/public"), emptyOutDir: true },
});
