const walletCitySlug = (process.env.NEXT_PUBLIC_CITYCOIN ?? "tcoin").trim().toLowerCase();
const walletAppSlug = (process.env.NEXT_PUBLIC_APP_NAME ?? "wallet").trim().toLowerCase();
const walletRoutePrefix = `/${walletCitySlug}/${walletAppSlug}`;

const publicWalletPaths = new Set(["/", "/resources", "/contact", "/ecosystem", "/merchants"]);
const unauthenticatedWalletPreviewPaths = new Set(["/dashboard", "/welcome"]);

function trimTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export function normalizeWalletPathname(pathname: string | null | undefined) {
  if (!pathname) {
    return null;
  }

  const normalizedPathname = trimTrailingSlash(pathname);

  if (normalizedPathname === walletRoutePrefix) {
    return "/";
  }

  if (normalizedPathname.startsWith(`${walletRoutePrefix}/`)) {
    return normalizedPathname.slice(walletRoutePrefix.length);
  }

  return normalizedPathname;
}

export function isPublicWalletPath(pathname: string | null | undefined) {
  const normalizedPathname = normalizeWalletPathname(pathname);

  if (!normalizedPathname) {
    return false;
  }

  return publicWalletPaths.has(normalizedPathname) || normalizedPathname.startsWith("/pay/");
}

export function isWalletPreviewPath(pathname: string | null | undefined) {
  const normalizedPathname = normalizeWalletPathname(pathname);

  if (!normalizedPathname) {
    return false;
  }

  return unauthenticatedWalletPreviewPaths.has(normalizedPathname);
}
