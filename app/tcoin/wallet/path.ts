export function walletRelativePath(pathname: string): string {
  return pathname.replace(/^\/tcoin\/wallet/, "") || "/"
}

