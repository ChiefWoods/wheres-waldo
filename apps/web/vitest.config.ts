import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@workspace/ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/dom/setup.ts"],
    include: ["./tests/dom/**/*.test.{ts,tsx}"],
    clearMocks: true,
    restoreMocks: true,
    css: true,
  },
});
