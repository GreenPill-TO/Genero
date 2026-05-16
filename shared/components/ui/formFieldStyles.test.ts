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
      otpDigitFieldClass,
    ]) {
      expect(className).toContain("bg-slate-50/92");
      expect(className).toContain("dark:bg-slate-950/55");
    }
  });

  it("keeps auth modal email and OTP fields on a light surface in dark mode", () => {
    expect(authModalEmailFieldClass).toContain("dark:bg-slate-100");
    expect(authModalEmailFieldClass).toContain("dark:text-slate-950");
    expect(otpDigitFieldClass).toContain("dark:bg-slate-100");
    expect(otpDigitFieldClass).toContain("dark:text-slate-950");
  });
});
