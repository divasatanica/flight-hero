import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev -w @flight-hero/be",
      cwd: "../..",
      port: 4400,
      env: {
        PORT: "4400",
        PLANES_COUNT: "3",
        BASIC_UPDATE_INTERVAL_MS: "200",
        DETAILED_UPDATE_INTERVAL_MS: "200",
      },
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      env: { VITE_WS_BASE_URL: "ws://127.0.0.1:4400/ws" },
      reuseExistingServer: false,
    },
  ],
});
