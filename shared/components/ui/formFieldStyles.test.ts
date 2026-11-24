import { describe, expect, it } from "vitest";
import {
  authModalEmailFieldClass,
  fileInputFieldClass,
  inputFieldClass,
  nativeFieldClass,
  otpDigitFieldClass,
  reactSelectFieldShellClass,
  textareaFieldClass,
} from "./formFieldStyles";

describe("formFieldStyles", () => {
  it("keeps shared field surfaces visually distinct from surrounding panels", () => {
    for (const className of [
      inputFieldClass,
      textareaFieldClass,
      nativeFieldClass,
      reactSelectFieldShellClass,
      fileInputFieldClass,
    ]) {
      expect(className).toContain("bg-slate-50/92");
      expect(className).toContain("dark:bg-slate-950/55");
    }
  });

  it("keeps OTP surfaces independent of the shared dark field and authenticated-shell overrides", () => {
    const classes = otpDigitFieldClass.split(/\s+/);
    expect(classes).toContain("bg-white");
    expect(classes).toContain("text-slate-950");
    expect(classes).not.toContain("wallet-auth-input");
    expect(classes.filter((name) => name.startsWith("dark:bg-"))).toEqual(["dark:bg-slate-100"]);
  });

  it("keeps auth modal email and OTP fields on a light surface in dark mode", () => {
    expect(authModalEmailFieldClass).toContain("dark:bg-slate-100");
    expect(authModalEmailFieldClass).toContain("dark:text-slate-950");
    expect(otpDigitFieldClass).toContain("dark:bg-slate-100");
    expect(otpDigitFieldClass).toContain("dark:text-slate-950");
  });
});
