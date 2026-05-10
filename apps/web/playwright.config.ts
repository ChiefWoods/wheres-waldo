import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command:
        "DATABASE_URL=file:./data/dev.db AUTO_SEED_ON_EMPTY_DB=true PORT=3456 bun src/index.ts",
      cwd: "../server",
      url: "http://127.0.0.1:3456/",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      name: "backend",
    },
    {
      command:
        "VITE_API_PROXY_TARGET=http://127.0.0.1:3456 bunx vite --config vite.config.ts --host 127.0.0.1 --port 4173",
      cwd: ".",
      url: "http://127.0.0.1:4173/",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      name: "frontend",
    },
  ],
});
