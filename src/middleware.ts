import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isOpsGatePath, opsInternalPath } from "@/lib/ops-path";

/** Always public — policy, auth, crawler files. */
const PUBLIC_EXACT = new Set([
  "/login",
  "/register",
  "/privacy",
  "/terms",
  "/about",
  "/contact",
  "/how-adsense-works",
  "/search",
  "/friends",
  "/discover",
  "/shop",
  "/robots.txt",
  "/sitemap.xml",
  "/ads.txt",
]);

/** Always private — account, wallet, compose, DMs. */
const PRIVATE_PREFIXES = [
  "/messages",
  "/calls",
  "/groups",
  "/earn",
  "/create",
  "/saved",
  "/drafts",
  "/onboarding",
  "/settings",
  "/profile",
  "/shop/manage",
  "/shop/setup",
  "/shop/checkout",
  "/shop/orders",
];

function isPublic(path: string) {
  if (PUBLIC_EXACT.has(path)) return true;
  if (path.startsWith("/api/auth")) return true;
  if (path.startsWith("/_next")) return true;

  if (PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return false;

  // Public content — Google AdSense / Googlebot must reach these without login.
  if (path.startsWith("/p/")) return true;
  if (path.startsWith("/u/")) return true;
  if (path.startsWith("/shop/")) return true;

  return false;
}

function opsHeaders(req: NextRequest, internal: string) {
  const headers = new Headers(req.headers);
  headers.set("x-ops-path", internal === "/ops" ? "/" : internal.slice("/ops".length) || "/");
  return headers;
}

function lockOps(res: NextResponse) {
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Frame-Options", "DENY");
  return res;
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Internal ops routes are never reachable by URL — only via the secret gate rewrite.
  if (path === "/ops" || path.startsWith("/ops/")) {
    return lockOps(new NextResponse("Not Found", { status: 404, headers: { "content-type": "text/plain" } }));
  }

  if (isOpsGatePath(path)) {
    const internal = opsInternalPath(path);
    if (!internal) {
      return lockOps(new NextResponse("Not Found", { status: 404, headers: { "content-type": "text/plain" } }));
    }
    const url = req.nextUrl.clone();
    url.pathname = internal;
    return lockOps(
      NextResponse.rewrite(url, {
        request: { headers: opsHeaders(req, internal) },
      }),
    );
  }

  if (path.startsWith("/api") && !path.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (
    path === "/" ||
    path === "/home" ||
    path === "/watch" ||
    path.startsWith("/watch/") ||
    path === "/live" ||
    path.startsWith("/live/") ||
    path === "/blogs" ||
    path.startsWith("/blogs/") ||
    path.startsWith("/article/")
  ) {
    const token = req.cookies.get("cp_token")?.value;
    if (!token) {
      const login = new URL("/login", req.url);
      login.searchParams.set("next", "/messages");
      return NextResponse.redirect(login);
    }
    return NextResponse.redirect(new URL("/messages", req.url));
  }

  if (isPublic(path)) {
    const token = req.cookies.get("cp_token")?.value;
    if (token && (path === "/login" || path === "/register")) {
      const prefetch =
        req.headers.get("Next-Router-Prefetch") === "1" ||
        req.headers.get("next-router-prefetch") === "1" ||
        req.headers.get("Purpose") === "prefetch" ||
        req.headers.get("Sec-Purpose") === "prefetch";
      if (prefetch) return NextResponse.next();
      const next = req.nextUrl.searchParams.get("next") || "/messages";
      const dest =
        next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") && !next.startsWith("/register")
          ? next
          : "/messages";
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return NextResponse.next();
  }

  const token = req.cookies.get("cp_token")?.value;
  if (!token) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/upload|api/media|videos/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|mov|m4v)$).*)",
  ],
};
