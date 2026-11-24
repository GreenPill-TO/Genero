import { expect, test } from "@playwright/test";
import { buildOtpFieldFixture, otpFieldMarkup } from "./otp-field-fixture";

let fixture: Awaited<ReturnType<typeof buildOtpFieldFixture>>;
test.beforeAll(async () => { fixture = await buildOtpFieldFixture(); });

for (const dark of [false, true]) {
  for (const authenticatedShell of [false, true]) {
    test(`OTP contrast in ${dark ? "dark" : "light"} ${authenticatedShell ? "authenticated shell" : "public modal"}`, async ({ page }) => {
      await page.route("**/*", (route) => route.abort());
      await page.setContent(`<html class="${dark ? "dark" : ""}"><head><style>${fixture.css}</style></head><body>${otpFieldMarkup(fixture.fieldClass, authenticatedShell)}</body></html>`);
      const empty = page.getByRole("textbox", { name: "Empty digit", exact: true });
      const entered = page.getByRole("textbox", { name: "Entered digit", exact: true });
      await expect(empty).toHaveValue("");
      await expect(entered).toHaveValue("7");

      for (const focused of [false, true]) {
        if (focused) await empty.press("Tab");
        for (const field of [empty, entered]) {
          const colours = await field.evaluate((element) => {
            const style = getComputedStyle(element);
            return { foreground: style.color, background: style.backgroundColor, shadow: style.boxShadow };
          });
          expect(colours.foreground).toBe("rgb(2, 6, 23)");
          expect(colours.background).toBe(dark ? "rgb(241, 245, 249)" : "rgb(255, 255, 255)");
          const luminance = (rgb: number[]) => rgb.map((channel) => channel / 255)
            .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
            .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
          const contrast = (luminance(dark ? [241, 245, 249] : [255, 255, 255]) + 0.05) / (luminance([2, 6, 23]) + 0.05);
          expect(contrast).toBeGreaterThanOrEqual(4.5);
        }
        if (focused) {
          await expect(entered).toBeFocused();
          expect(await entered.evaluate((element) => getComputedStyle(element).boxShadow)).toContain("0px 0px 0px 1px");
        }
      }
    });
  }
}
