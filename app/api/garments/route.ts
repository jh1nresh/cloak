import { NextRequest, NextResponse } from "next/server";
import { checkRequestRateLimit } from "@/lib/rate-limit";
import { getServiceSupabase } from "@/lib/supabase";

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
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("garments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Garments feed error:", error);
    return NextResponse.json(
      { error: "Failed to load garments" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { garments: data || [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}
