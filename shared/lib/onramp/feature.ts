export function isBuyTcoinCheckoutEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_BUY_TCOIN_CHECKOUT_V1 ?? "false").trim().toLowerCase() === "true";
}
