import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "./lib/adminAuth";
import { SESSION_COOKIE, verifySessionToken } from "./lib/adminSession";

export async function middleware(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  const { pathname, search } = req.nextUrl;
  const ok =
    pathname === "/admin/login" ||
    isAuthorized(req.headers.get("authorization"), password) ||
    (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, password));
  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const res = NextResponse.redirect(url);
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

export const config = { matcher: ["/admin/:path*"] };
