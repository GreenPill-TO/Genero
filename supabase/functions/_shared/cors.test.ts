/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

const denoEnvValues = vi.hoisted(() => ({} as Record<string, string | undefined>));

vi.hoisted(() => {
  (globalThis as any).Deno = {
    env: {
      get(name: string) {
        return denoEnvValues[name];
      },
    },
  };
});

import { resolveCorsHeaders } from "./cors";

describe("edge CORS headers", () => {
  it("allows the known TCOIN Preview dev host without a custom Edge secret", () => {
    const headers = resolveCorsHeaders(
      new Request("https://project.supabase.co/functions/v1/user-settings/bootstrap", {
        headers: { origin: "https://tcoin-git-dev-cubid-team.vercel.app" },
      })
    );

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://tcoin-git-dev-cubid-team.vercel.app");
    expect(headers.Vary).toBe("Origin");
  });

  it("allows Vercel deployment-preview hosts for TCOIN and SpareChange", () => {
    for (const origin of [
      "https://tcoin-802yqav97-cubid-team.vercel.app",
      "https://tcoin-git-codex-preview-cubid-team.vercel.app",
      "https://tcoin-dev-git-dev-cubid-team.vercel.app",
      "https://tcoin-dev-802yqav97-cubid-team.vercel.app",
      "https://spare-change-802yqav97-cubid-team.vercel.app",
      "https://spare-change-git-codex-preview-cubid-team.vercel.app",
    ]) {
      const headers = resolveCorsHeaders(
        new Request("https://project.supabase.co/functions/v1/user-settings/bootstrap", {
          headers: { origin },
        })
      );

      expect(headers["Access-Control-Allow-Origin"]).toBe(origin);
      expect(headers.Vary).toBe("Origin");
    }
  });

  it("allows the owned TCOIN dev custom domain", () => {
    const headers = resolveCorsHeaders(
      new Request("https://project.supabase.co/functions/v1/user-settings/bootstrap", {
        headers: { origin: "https://dev.tcoin.me" },
      })
    );

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://dev.tcoin.me");
    expect(headers.Vary).toBe("Origin");
  });

  it("does not reflect arbitrary origins", () => {
    for (const origin of [
      "https://example.invalid",
      "https://tcoin-802yqav97-evil-team.vercel.app",
      "https://tcoin-802yqav97-cubid-team.vercel.app.evil.test",
      "https://tcoin-dev-802yqav97-evil-team.vercel.app",
      "http://tcoin-802yqav97-cubid-team.vercel.app",
      "http://dev.tcoin.me",
    ]) {
      const headers = resolveCorsHeaders(
        new Request("https://project.supabase.co/functions/v1/user-settings/bootstrap", {
          headers: { origin },
        })
      );

      expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    }
  });

  it("allows custom origins from runtime env", () => {
    denoEnvValues.USER_SETTINGS_ALLOWED_ORIGINS = "https://preview.example.test";

    const headers = resolveCorsHeaders(
      new Request("https://project.supabase.co/functions/v1/user-settings/bootstrap", {
        headers: { origin: "https://preview.example.test" },
      })
    );

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://preview.example.test");

    denoEnvValues.USER_SETTINGS_ALLOWED_ORIGINS = undefined;
  });
});
