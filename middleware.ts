import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Edge middleware: rate limit + separate admin/user login walls
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;
const ipHits = new Map<string, number[]>();

function getIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    (req as unknown as { ip?: string }).ip ||
    "unknown");
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = ipHits.get(ip) ?? [];
  const fresh = arr.filter((t) => now - t < RATE_WINDOW_MS);
  fresh.push(now);
  ipHits.set(ip, fresh);
  if (ipHits.size > 5000) {
    const firstKey = ipHits.keys().next().value;
    if (firstKey) ipHits.delete(firstKey);
  }
  return fresh.length > RATE_MAX;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = getIp(req);

  if (isRateLimited(ip)) {
    return new NextResponse(JSON.stringify({ detail: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:") {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  const adminToken = req.cookies.get("itz_admin_token")?.value;
  const userToken = req.cookies.get("itz_user_token")?.value;

  // Admin wall: /admin -> require admin token, /admin/login is public
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname.startsWith("/admin/login")) {
      // already authenticated admin visiting login -> send to dashboard
      if (adminToken) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      }
      return res;
    }
    if (!adminToken) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    return res;
  }

  // User wall: allow trial guests on / (chat); gate only if trial exhausted
  // Trial enforcement is backend-side per-IP; middleware stays permissive for guests
  if (pathname === "/" || pathname === "") {
    return res;
  }
  if (pathname.startsWith("/login")) {
    if (userToken) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return res;
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/login/:path*", "/", "/api/:path*"],
};
