import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "./lib/adminAuth";

export function middleware(req: NextRequest) {
  if (!isAuthorized(req.headers.get("authorization"), process.env.ADMIN_PASSWORD)) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Sirtaki admin"', "X-Robots-Tag": "noindex" },
    });
  }
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

export const config = { matcher: ["/admin/:path*"] };
