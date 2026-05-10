import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: [
    "node_modules/**",
    "src/routeTree.gen.ts",
    "dist/**",
    "test-results/**",
    "playwright-report/**",
  ],
  sortImports: {
    groups: [
      "type-import",
      ["value-builtin", "value-external"],
      "type-internal",
      "value-internal",
      ["type-parent", "type-sibling", "type-index"],
      ["value-parent", "value-sibling", "value-index"],
      "unknown",
    ],
  },
  overrides: [
    {
      files: ["**/*.{js,jsx,ts,tsx,md,mdx,html}"],
      options: {
        sortTailwindcss: {
          stylesheet: "../../packages/ui/src/styles/globals.css",
          functions: ["clsx", "cn"],
          preserveWhitespace: true,
        },
      },
    },
  ],
  sortPackageJson: {
    sortScripts: false,
  },
});
