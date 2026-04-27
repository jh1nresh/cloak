import { NextRequest, NextResponse } from "next/server";
import { checkRequestRateLimit } from "@/lib/rate-limit";
import { listGarments } from "@/lib/db";

export async function GET(request: NextRequest) {
  const rateLimit = await checkRequestRateLimit(request, {
    keyPrefix: "garments-feed",
    maxRequests: 120,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 24, 1), 50);

  try {
    const garments = await listGarments(limit);
    return NextResponse.json(
      { garments },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Garments feed error:", error);
    return NextResponse.json(
      { error: "Failed to load garments" },
      { status: 500 }
    );
  }
}
