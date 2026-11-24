import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import { compileString } from "sass";
import tailwindcss from "tailwindcss";
import walletConfig from "../app/tcoin/wallet/tailwind.config";
import { otpDigitFieldClass } from "../shared/components/ui/formFieldStyles";

// No app server, credentials, OTP delivery or database is involved in this fixture.
// Compile the actual wallet stylesheet so authenticated-shell overrides are exercised.
export async function buildOtpFieldFixture() {
  const root = process.cwd();
  const source = readFileSync(path.join(root, "app/tcoin/wallet/styles/app.scss"), "utf8")
    .replace('@import "@shared/styles/globals.scss";', readFileSync(path.join(root, "shared/styles/globals.scss"), "utf8"));
  const compiled = compileString(source, { logger: { warn() {}, debug() {} } }).css;
  const css = (await postcss([tailwindcss({
    ...walletConfig,
    content: [{ raw: `<input class="${otpDigitFieldClass}">`, extension: "html" }],
  })]).process(compiled, { from: undefined })).css;
  return { css, fieldClass: otpDigitFieldClass };
}

export function otpFieldMarkup(fieldClass: string, authenticatedShell: boolean) {
  return `<main class="${authenticatedShell ? "wallet-auth-shell" : ""}">
    <h1>Local OTP contrast fixture</h1>
    <p>Static sample digits; no authentication request is sent.</p>
    <label>Empty digit <input aria-label="Empty digit" class="${fieldClass}" maxlength="1"></label>
    <label>Entered digit <input aria-label="Entered digit" class="${fieldClass}" maxlength="1" value="7"></label>
  </main>`;
}
