import { describe, expect, it } from "vitest";
import { publicPaths } from "./ContentLayout";

describe("ContentLayout public paths", () => {
  it("does not include /dashboard", () => {
    expect(publicPaths).not.toContain("/dashboard");
  });
});
