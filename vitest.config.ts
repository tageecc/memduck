import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [".next/**", ".turbo/**", ".worktrees/**", "node_modules/**"],
    include: ["tests/**/*.test.ts"],
  },
});
