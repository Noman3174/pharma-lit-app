import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Minimal valid middleware (no-op)
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

// Optional: limit paths if you want (example below)
// export const config = { matcher: ["/app/:path*"] };