export type CooldownEvaluation = {
  eligible: boolean;
  reason?: "start_cooldown" | "complete_cooldown" | "start_and_complete_cooldown";
  nextEligibleAt?: Date;
};

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function evaluateCooldown(options: {
  now?: Date;
  lastStartedAt?: Date | null;
  lastCompletedAt?: Date | null;
  cooldownMs?: number;
}): CooldownEvaluation {
  const now = options.now ?? new Date();
  const cooldownMs = options.cooldownMs ?? FIVE_MINUTES_MS;

  const nextStart = options.lastStartedAt
    ? new Date(options.lastStartedAt.getTime() + cooldownMs)
    : new Date(0);
  const nextComplete = options.lastCompletedAt
    ? new Date(options.lastCompletedAt.getTime() + cooldownMs)
    : new Date(0);

  const startReady = now.getTime() >= nextStart.getTime();
  const completeReady = now.getTime() >= nextComplete.getTime();

  if (startReady && completeReady) {
    return { eligible: true };
  }

  const nextEligibleAt =
    nextStart.getTime() > nextComplete.getTime() ? nextStart : nextComplete;

  if (!startReady && !completeReady) {
    return {
      eligible: false,
      reason: "start_and_complete_cooldown",
      nextEligibleAt,
    };
  }

  return {
    eligible: false,
    reason: startReady ? "complete_cooldown" : "start_cooldown",
    nextEligibleAt,
  };
}
