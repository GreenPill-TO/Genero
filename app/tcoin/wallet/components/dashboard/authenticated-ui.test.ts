import { describe, expect, it } from "vitest";
import {
  walletActionButtonClass,
  walletActionRowClass,
  walletChoiceCardClass,
  walletInteractiveSurfaceClass,
  walletMetricTileClass,
  walletPanelClass,
  walletPanelMutedClass,
  walletRailPageClass,
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

  it("flattens static shells on phone widths before restoring cards on larger screens", () => {
    expect(walletPanelClass).toContain("rounded-none");
    expect(walletPanelClass).toContain("border-b");
    expect(walletPanelClass).toContain("sm:rounded-[28px]");
    expect(walletPanelMutedClass).toContain("border-t");
    expect(walletPanelMutedClass).toContain("sm:rounded-[24px]");
    expect(walletMetricTileClass).toContain("border-t");
    expect(walletMetricTileClass).toContain("sm:rounded-[20px]");
  });

  it("defines a shared desktop rail offset contract for sidebar pages", () => {
    expect(walletRailPageClass).toContain("lg:pl-[9.5rem]");
    expect(walletRailPageClass).toContain("xl:pl-[10.5rem]");
    expect(walletRailPageClass).toContain("lg:max-w-[calc(90rem+8.25rem)]");
    expect(walletRailPageClass).toContain("min-[1850px]:pl-[11rem]");
  });
});
