import { defineConfig } from "vitest/config";

// Root tests: backend (api/), AI layer (ai/), functions. web/ has its own vitest setup.
export default defineConfig({
  test: { include: ["api/**/*.test.ts", "ai/**/*.test.ts", "netlify/**/*.test.ts"] },
});
