import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Load .env so test files can access secrets like RESEND_API_KEY
// .env is gitignored — safe to load here
config();

// globalSetup/globalTeardown run once before/after the ENTIRE suite
// They create and clean up seed test data so no tests skip due to missing data

// Path where the authenticated session state is saved by the setup project
export const AUTH_FILE = ".playwright/auth.json";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  timeout: 25_000,
  globalSetup:    "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:5177",
    headless: true,
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    // ── Setup: sign in once and save session state ───────────────────────────
    {
      name: "setup",
      testMatch: /e2e\/setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    // ── Authenticated tests — load saved session ─────────────────────────────
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_FILE,
      },
      dependencies: ["setup"],
    },
  ],
  // Dev server must already be running (npm run dev)
});
