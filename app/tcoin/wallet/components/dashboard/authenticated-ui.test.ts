import { describe, expect, it } from "vitest";
import {
  walletActionButtonClass,
  walletActionRowClass,
  walletChoiceCardClass,
  walletInteractiveSurfaceClass,
  walletMetricTileClass,
  walletPanelMutedClass,
} from "./authenticated-ui";

describe("authenticated interaction language", () => {
  it("gives interactive wallet surfaces a persistent affordance treatment", () => {
    expect(walletInteractiveSurfaceClass).toContain("cursor-pointer");
    expect(walletInteractiveSurfaceClass).toContain("ring-teal-500/12");
    expect(walletInteractiveSurfaceClass).toContain("before:bg-teal-600/40");
    expect(walletActionRowClass).toContain("cursor-pointer");
    expect(walletChoiceCardClass).toContain("cursor-pointer");
    expect(walletActionButtonClass).toContain("ring-teal-500/10");
  });

  it("keeps static wallet panels visually quieter than interactive surfaces", () => {
    expect(walletPanelMutedClass).not.toContain("cursor-pointer");
    expect(walletPanelMutedClass).not.toContain("before:bg-teal-600/40");
    expect(walletMetricTileClass).not.toContain("cursor-pointer");
    expect(walletMetricTileClass).not.toContain("before:bg-teal-600/40");
  });
});
