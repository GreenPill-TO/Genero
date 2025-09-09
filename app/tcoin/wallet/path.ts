export function walletRelativePath(pathname: string): string {
  const path = pathname.replace(/^\/tcoin\/wallet/, "") || "/"
  return path !== "/" ? path.replace(/\/$/, "") : path
}

