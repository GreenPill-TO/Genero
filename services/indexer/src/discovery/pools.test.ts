import { describe, expect, it } from "vitest";
import { hasTokenOverlap } from "./pools";

describe("hasTokenOverlap", () => {
  it("returns true when pool tokens intersect city tokens", () => {
    expect(
      hasTokenOverlap(
        ["0x00000000000000000000000000000000000000AA"],
        ["0x00000000000000000000000000000000000000aa", "0x00000000000000000000000000000000000000bb"]
      )
    ).toBe(true);
  });

  it("returns false when there is no intersection", () => {
    expect(
      hasTokenOverlap(
        ["0x00000000000000000000000000000000000000AA"],
        ["0x00000000000000000000000000000000000000bb"]
      )
    ).toBe(false);
  });
});
