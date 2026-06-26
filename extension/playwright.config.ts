import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const extensionRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: path.join(extensionRoot, "e2e"),
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    trace: "retain-on-failure",
  },
});
