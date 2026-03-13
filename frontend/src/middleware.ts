import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login"];
const IGNORED_PREFIXES = ["/_next", "/favicon.ico", "/api"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and API routes
  if (IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const hasToken = request.cookies.has("access_token");
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  // Authenticated user on login page -> redirect to dashboard
  if (isPublicPath && hasToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Unauthenticated user on protected page -> redirect to login
  if (!isPublicPath && !hasToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
