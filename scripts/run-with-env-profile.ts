import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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
    const value = stripWrappingQuotes(rawLine.slice(separatorIndex + 1));
    process.env[key] = value;
  }
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
  loadProfileEnv(profilePath);

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
