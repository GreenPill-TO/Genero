const DEFAULT_WALLET_PUBLIC_BASE_URL = "https://www.tcoin.me";

export function resolveWalletPublicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL?.trim().replace(/\/$/, "") ||
    DEFAULT_WALLET_PUBLIC_BASE_URL
  );
}

export function buildWalletPayUrl(token: string): string {
  return `${resolveWalletPublicBaseUrl()}/pay/${encodeURIComponent(token)}`;
}

export function extractWalletPayToken(value: string): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length >= 2 && segments[0] === "pay") {
      return decodeURIComponent(segments[1] ?? "").trim() || null;
    }
  } catch {
    return null;
  }

  return null;
}

export function decodeLegacyWalletPayPayload(value: string): Record<string, unknown> | null {
  try {
    const url = new URL(value);
    const base64Data = url.searchParams.get("pay");
    if (!base64Data) {
      throw new Error("No Base64 data found in URL.");
    }

    const decodedData = decodeURIComponent(escape(atob(base64Data)));
    return JSON.parse(decodedData) as Record<string, unknown>;
  } catch {
    return null;
  }
}
