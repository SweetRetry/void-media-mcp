import { defineConfig } from "vite-plus"

/**
 * Unit tests cover pure modules, so they skip voidPlugin. Loaded from the workspace root, the
 * plugin would scaffold `.void/` and `void.json` there.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { name: "web", environment: "node" },
})
