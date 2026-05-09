import { defineConfig } from "oxlint";

export default defineConfig({
  $schema: "./node_modules/oxlint/configuration_schema.json",
  ignorePatterns: ["node_modules/**", "src/routeTree.gen.ts"],
  overrides: [
    {
      files: ["**/*.{ts,tsx}"],
      plugins: ["typescript", "react", "vitest"],
      env: {
        es2020: true,
        browser: true,
        vitest: true,
      },
    },
  ],
});
