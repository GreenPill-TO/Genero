export function isBuyTcoinCheckoutEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_ENABLE_BUY_TCOIN_CHECKOUT ?? "false").trim().toLowerCase() === "true";
}
