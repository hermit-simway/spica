import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Web app Vitest config. Tests consume the canonical `@simway/spica`
 * directly from its TypeScript source (aliased) so the suite stays green in
 * CI before the `pnpm build` step compiles `packages/core/dist`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@simway/spica": fileURLToPath(
        new URL("../../packages/core/src/index.ts", import.meta.url)
      )
    }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
