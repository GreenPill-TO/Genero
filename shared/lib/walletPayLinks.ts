// Pay-link QR/share flows intentionally use the www host by default; that is the
// accepted wallet-link contract for this feature even though some marketing pages
// still publish bare-domain canonicals elsewhere in the app.
const DEFAULT_WALLET_PUBLIC_BASE_URL = "https://www.tcoin.me";

function decodeBase64Utf8(value: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64").toString("utf8");
  }

  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

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

    const decodedData = decodeBase64Utf8(base64Data);
    return JSON.parse(decodedData) as Record<string, unknown>;
  } catch {
    return null;
  }
}
