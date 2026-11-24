#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : process.env.GITHUB_BASE_REF;
const dryRun = args.includes("--dry-run");

if (!base || !["dev", "main"].includes(base)) {
  console.error("Usage: node .github/scripts/pr-version-bump.mjs --base <dev|main> [--dry-run]");
  process.exit(1);
}

function git(args, fallback = "") {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return fallback;
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

function bump(version) {
  const parts = String(version || "0.0.0").split(".").map((part) => Number.parseInt(part, 10));
  const minor = Number.isFinite(parts[1]) ? parts[1] : 0;
  const patch = Number.isFinite(parts[2]) ? parts[2] : 0;
  if (base === "main") return `0.${minor + 1}.0`;
  return `0.${minor}.${patch + 1}`;
}

function baseJson(file) {
  const fromGit = git(["show", `origin/${base}:${file}`], "");
  if (!fromGit) return null;
  try {
    return JSON.parse(fromGit);
  } catch {
    return null;
  }
}

function packageCandidates() {
  const changed = git(["diff", "--name-only", `origin/${base}...HEAD`], "")
    .split("\n")
    .filter(Boolean);
  const candidates = new Set();
  for (const file of changed) {
    const appMatch = file.match(/^apps\/([^/]+)\//);
    if (appMatch && fs.existsSync(path.join("apps", appMatch[1], "package.json"))) {
      candidates.add(path.join("apps", appMatch[1], "package.json"));
    }
    if (file.startsWith("app/") && fs.existsSync(path.join("app", "package.json"))) {
      candidates.add(path.join("app", "package.json"));
    }
  }
  if (candidates.size === 0 && fs.existsSync("package.json")) candidates.add("package.json");
  if (candidates.size === 0 && fs.existsSync(path.join("app", "package.json"))) candidates.add(path.join("app", "package.json"));
  return [...candidates];
}

function updatePackage(file) {
  const current = readJson(file);
  const basePkg = baseJson(file) || current;
  const nextVersion = bump(basePkg.version);
  if (current.version === nextVersion) {
    console.log(`${file} already at ${nextVersion}`);
    return;
  }
  console.log(`${file}: ${current.version || "(none)"} -> ${nextVersion}`);
  if (!dryRun) {
    current.version = nextVersion;
    writeJson(file, current);
  }

  const lockFile = path.join(path.dirname(file), "package-lock.json");
  if (fs.existsSync(lockFile)) {
    const lock = readJson(lockFile);
    if (lock.name === current.name || path.dirname(file) !== ".") lock.version = nextVersion;
    if (lock.packages && lock.packages[""]) lock.packages[""].version = nextVersion;
    if (!dryRun) writeJson(lockFile, lock);
  }
}

const candidates = packageCandidates();
if (candidates.length === 0) {
  console.error("No package.json candidate found for version bump.");
  process.exit(1);
}

for (const candidate of candidates) updatePackage(candidate);
