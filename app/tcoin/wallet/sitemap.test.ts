/** @vitest-environment node */
import sitemap from "./sitemap";
import { describe, expect, it } from "vitest";

describe("sitemap", () => {
  it("includes public discovery pages", () => {
    const entries = sitemap();
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: "https://tcoin.me/merchants" }),
        expect.objectContaining({ url: "https://tcoin.me/ecosystem" }),
      ]),
    );
  });
});
