import { describe, expect, it } from "vitest";
import {
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
});
