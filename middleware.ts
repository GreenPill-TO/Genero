// middleware.ts
import { updateSession } from "@shared/lib/supabase/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // First, handle session updates
  const response = await updateSession(request);

  const citycoin = process.env.NEXT_PUBLIC_CITYCOIN || "tcoin";
  const appEnv = process.env.NEXT_PUBLIC_APP_NAME || "sparechange";

  // Log to verify variables
  console.log("Middleware variables:", { citycoin, appEnv });

  const url = request.nextUrl.clone();

  // Ignore requests to static files, API routes, and other assets
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/public") ||
    url.pathname.startsWith("/favicon.ico") ||
    /\.(.*)$/.test(url.pathname)
  ) {
    // If updateSession returns a response, return it; otherwise, continue
    return response ? response : NextResponse.next();
  }

  // Rewrite the root path to the appropriate app
  if (url.pathname === "/") {
    url.pathname = `/${citycoin}/${appEnv}`;
  } else {
    url.pathname = `/${citycoin}/${appEnv}${url.pathname}`;
  }

  // Return the rewritten response, including any headers from updateSession
  return response
    ? NextResponse.rewrite(url, { headers: response.headers })
    : NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|map)$).*)",
  ],
};
