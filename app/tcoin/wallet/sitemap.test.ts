/** @vitest-environment node */
import sitemap from "./sitemap";
import { describe, expect, it } from "vitest";

describe("sitemap", () => {
  it("includes ecosystem page", () => {
    const entries = sitemap();
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: "https://tcoin.me/ecosystem" }),
      ]),
    );
  });
});
