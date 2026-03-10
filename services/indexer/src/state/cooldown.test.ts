import { describe, expect, it } from "vitest";
import { evaluateCooldown } from "./cooldown";

describe("evaluateCooldown", () => {
  const now = new Date("2026-03-09T12:00:00.000Z");

  it("allows runs when both gates are open", () => {
    const result = evaluateCooldown({
      now,
      lastStartedAt: new Date("2026-03-09T11:50:00.000Z"),
      lastCompletedAt: new Date("2026-03-09T11:50:00.000Z"),
      cooldownMs: 5 * 60 * 1000,
    });

    expect(result.eligible).toBe(true);
  });

  it("blocks when start cooldown is active", () => {
    const result = evaluateCooldown({
      now,
      lastStartedAt: new Date("2026-03-09T11:58:00.000Z"),
      lastCompletedAt: new Date("2026-03-09T11:40:00.000Z"),
      cooldownMs: 5 * 60 * 1000,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("start_cooldown");
    expect(result.nextEligibleAt?.toISOString()).toBe("2026-03-09T12:03:00.000Z");
  });

  it("blocks when complete cooldown is active", () => {
    const result = evaluateCooldown({
      now,
      lastStartedAt: new Date("2026-03-09T11:40:00.000Z"),
      lastCompletedAt: new Date("2026-03-09T11:58:00.000Z"),
      cooldownMs: 5 * 60 * 1000,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("complete_cooldown");
    expect(result.nextEligibleAt?.toISOString()).toBe("2026-03-09T12:03:00.000Z");
  });
});
