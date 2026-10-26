import { defineConfig, devices } from "@playwright/test";

/**
 * E2E só para fluxos críticos, contra um build de produção e um Supabase real.
 * Sem E2E_EMAIL/E2E_PASSWORD os testes são pulados (CI não tem segredo).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node node_modules/next/dist/bin/next start -p 3100",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
