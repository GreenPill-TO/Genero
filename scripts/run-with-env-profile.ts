import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { loadEnvConfig } from "@next/env";

function stripWrappingQuotes(value: string) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }

  return value;
}

function loadProfileEnv(profilePath: string) {
  const profileContents = readFileSync(profilePath, "utf8");
  const definedKeys = new Set<string>();

  for (const rawLine of profileContents.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = rawLine.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = rawLine.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(rawLine.slice(separatorIndex + 1).trim());
    process.env[key] = value;
    definedKeys.add(key);
  }
  return definedKeys;
}

async function main() {
  const args = process.argv.slice(2);
  const separatorIndex = args.indexOf("--");

  if (separatorIndex <= 0 || separatorIndex === args.length - 1) {
    throw new Error(
      "Usage: tsx scripts/run-with-env-profile.ts <profile-file> -- <command> [args...]"
    );
  }

  const profileFile = args[0];
  const command = args[separatorIndex + 1];
  const commandArgs = args.slice(separatorIndex + 2);
  const profilePath = resolve(process.cwd(), profileFile);

  if (!existsSync(profilePath)) {
    throw new Error(`Env profile not found: ${profileFile}`);
  }

  loadEnvConfig(process.cwd());
  const profileKeys = loadProfileEnv(profilePath);
  if (basename(profilePath) === ".env.local-supabase-local") {
    for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_APP_ENVIRONMENT"]) {
      if (!profileKeys.has(key) || !process.env[key]?.trim()) {
        throw new Error(`Local profile must explicitly define ${key}; base/shell fallback is not allowed.`);
      }
    }
    const target = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (process.env.NEXT_PUBLIC_APP_ENVIRONMENT !== "local" || target.protocol !== "http:" ||
        !["127.0.0.1", "localhost"].includes(target.hostname) || target.username || target.password ||
        target.pathname !== "/" || target.search || target.hash) {
      throw new Error("Local profile must select a plain loopback HTTP API and APP_ENVIRONMENT=local.");
    }
    const admission = spawnSync("zsh", [resolve(process.cwd(), "scripts/start-local-supabase.sh"), "check"], {
      encoding: "utf8", env: { ...process.env },
    });
    if (admission.status !== 0) {
      throw new Error("Local profile requires this session's exact active Supabase lease; app command not started.");
    }
    const active = JSON.parse(admission.stdout) as { api_port?: number };
    if (target.port !== String(active.api_port)) {
      throw new Error("Local profile API port does not match the admitted independent session.");
    }
  }

  const child = spawn(command, commandArgs, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: { ...process.env },
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    throw error;
  });
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
