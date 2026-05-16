import { describe, expect, it } from "vitest";
import { buttonVariants } from "./Button";

describe("buttonVariants", () => {
  it("keeps outline buttons visibly control-like at rest", () => {
    const outlineClasses = buttonVariants({ variant: "outline" });

    expect(outlineClasses).toContain("text-foreground");
    expect(outlineClasses).toContain("ring-primary/10");
  });
});
