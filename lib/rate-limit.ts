import type { NextRequest } from "next/server";
import { checkPersistentRateLimit } from "@/lib/db";
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
    const row = await checkPersistentRateLimit({
      key,
      maxRequests: options.maxRequests,
      windowSeconds: Math.ceil(options.windowMs / 1000),
    });

    if (!row) throw new Error("Rate limit query returned no rows");

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
