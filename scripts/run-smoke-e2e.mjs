#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const hasRemoteTarget = typeof process.env.SMOKE_BASE_URL === "string" && process.env.SMOKE_BASE_URL.trim().length > 0;
const shouldSkipBuild = process.env.SMOKE_SKIP_BUILD === "1" || process.env.SMOKE_SKIP_BUILD === "true";

if (!hasRemoteTarget && !shouldSkipBuild) {
  run("pnpm", ["build"]);
}

run("pnpm", ["exec", "playwright", "test", "-c", "playwright.smoke.config.ts"]);
