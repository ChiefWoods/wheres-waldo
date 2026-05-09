import { defineConfig } from "oxlint";

export default defineConfig({
  $schema: "./node_modules/oxlint/configuration_schema.json",
  ignorePatterns: ["node_modules/**"],
  overrides: [
    {
      files: ["**/*.ts"],
      plugins: ["typescript", "node", "vitest"],
      env: {
        es2026: true,
        node: true,
        vitest: true,
      },
    },
  ],
});
