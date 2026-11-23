import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function run(contents: string, local: boolean) {
  const dir = mkdtempSync("/Volumes/MiniBot/scratch/tcoin-profile-test-");
  directories.push(dir);
  const profile = join(dir, local ? ".env.local-supabase-local" : ".env.test-profile");
  const marker = join(dir, "started");
  writeFileSync(profile, contents);
  const env: NodeJS.ProcessEnv = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://inherited.example.supabase.co" };
  for (const key of ["SLOT_SESSION", "SLOT_DIR", "SLOT_SCOPE", "SLOT_TOKEN_FILE"]) delete env[key];
  const result = spawnSync(process.execPath, ["--import", "tsx", resolve("scripts/run-with-env-profile.ts"), profile, "--",
    process.execPath, "-e", `require('node:fs').writeFileSync(${JSON.stringify(marker)}, process.env.TEST_PROFILE_VALUE || 'started')`],
  { encoding: "utf8", env });
  return { result, marker };
}

describe("explicit environment profile loading", () => {
  it("parses whitespace before quoted values without including literal quotes", () => {
    const { result, marker } = run('TEST_PROFILE_VALUE=   "quoted value"\n', false);
    expect(result.status).toBe(0);
    expect(existsSync(marker)).toBe(true);
    expect(readFileSync(marker, "utf8")).toBe("quoted value");
    expect(result.stderr).not.toContain("Env profile not found");
  });

  it("rejects inherited remote targets when local URL is omitted", () => {
    const { result, marker } = run("NEXT_PUBLIC_APP_ENVIRONMENT=local\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test-key\n", true);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("explicitly define NEXT_PUBLIC_SUPABASE_URL");
    expect(existsSync(marker)).toBe(false);
  });

  it("rejects non-loopback targets before asking for runtime admission", () => {
    const { result, marker } = run("NEXT_PUBLIC_SUPABASE_URL=https://remote.example.supabase.co\nNEXT_PUBLIC_APP_ENVIRONMENT=local\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test-key\n", true);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("plain loopback");
    expect(existsSync(marker)).toBe(false);
  });

  it("does not start a local app command without an owned active session", () => {
    const { result, marker } = run("NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:62321\nNEXT_PUBLIC_APP_ENVIRONMENT=local\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test-key\n", true);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("exact active Supabase lease");
    expect(existsSync(marker)).toBe(false);
  });
});
