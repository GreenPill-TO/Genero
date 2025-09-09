import { describe, expect, it } from "vitest";
import { publicPaths } from "./ContentLayout";

describe("ContentLayout public paths", () => {
  it("includes /dashboard", () => {
    expect(publicPaths).toContain("/dashboard");
  });
});
