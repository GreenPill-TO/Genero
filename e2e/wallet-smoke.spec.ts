import { expect, test } from "@playwright/test";

const stableRoutes = [
  "/tcoin/wallet",
  "/tcoin/wallet/resources",
  "/tcoin/wallet/contact",
  "/tcoin/wallet/merchants",
  "/tcoin/wallet/ecosystem",
  "/tcoin/wallet/welcome",
  "/tcoin/wallet/dashboard",
  "/tcoin/contracts",
] as const;

const runtimeErrorText = /Application error|Unhandled Runtime Error|Internal Server Error|500\b/i;

for (const route of stableRoutes) {
  test(`loads ${route} without a runtime shell failure`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });

    expect(response, `${route} should return an HTTP response`).not.toBeNull();
    expect(response?.status(), `${route} should return 2xx`).toBeGreaterThanOrEqual(200);
    expect(response?.status(), `${route} should return 2xx`).toBeLessThan(300);

    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

    const currentPath = new URL(page.url()).pathname.replace(/\/$/, "");
    expect(currentPath || "/", `${route} should not collapse to a different route`).toBe(route);

    const bodyText = (await page.locator("body").innerText()).trim();
    expect(bodyText.length, `${route} should render visible body content`).toBeGreaterThan(0);
    expect(bodyText, `${route} should not render a Next.js/runtime error`).not.toMatch(runtimeErrorText);
  });
}
