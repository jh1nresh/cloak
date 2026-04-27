import type { NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import {
  checkRateLimit,
  getClientIp,
  type RateLimitOptions,
} from "@/lib/security";

type RateLimitResult = {
  ok: boolean;
  retryAfterSeconds: number;
};

export async function checkRequestRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const clientIp = getClientIp(request);
  const key = `${options.keyPrefix}:${clientIp}`;

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_max_requests: options.maxRequests,
      p_window_seconds: Math.ceil(options.windowMs / 1000),
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : null;
    if (!row) throw new Error("Rate limit RPC returned no rows");

    return {
      ok: row.allowed,
      retryAfterSeconds: row.retry_after_seconds,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      return checkRateLimit(clientIp, options);
    }

    console.error("Rate limit check failed:", error);
    return { ok: false, retryAfterSeconds: 60 };
  }
}
