import { defineConfig } from "@playwright/test";
import smokeConfig from "./playwright.smoke.config";

export default defineConfig({
  ...smokeConfig,
  testMatch: "otp-field-contrast.spec.ts",
  webServer: undefined,
  workers: 1,
});
