import { NextRequest, NextResponse } from "next/server";
import {
  getSavedItemById,
  getUserById,
  insertTasteEvent,
  type TasteEventType,
} from "@/lib/db";
import { checkRequestRateLimit } from "@/lib/rate-limit";

const ALLOWED_EVENTS = new Set<TasteEventType>([
  "save",
  "skip",
  "buy_click",
  "share",
  "regenerate",
  "compare_original",
]);

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRequestRateLimit(request, {
      keyPrefix: "taste-events",
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

    const {
      userId,
      savedItemId,
      lookId,
      garmentId,
      tryonId,
      eventType,
      metadata,
    } = await request.json();

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (!eventType || !ALLOWED_EVENTS.has(eventType)) {
      return NextResponse.json(
        { error: "Invalid taste event" },
        { status: 400 }
      );
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (typeof savedItemId === "string") {
      const savedItem = await getSavedItemById(savedItemId);
      if (!savedItem) {
        return NextResponse.json(
          { error: "Saved item not found" },
          { status: 404 }
        );
      }

      if (savedItem.user_id !== userId) {
        return NextResponse.json(
          { error: "Saved item does not belong to user" },
          { status: 403 }
        );
      }
    }

    const event = await insertTasteEvent({
      userId,
      savedItemId: typeof savedItemId === "string" ? savedItemId : null,
      lookId: typeof lookId === "string" ? lookId : null,
      garmentId: typeof garmentId === "string" ? garmentId : null,
      tryonId: typeof tryonId === "string" ? tryonId : null,
      eventType,
      metadata: isObject(metadata) ? metadata : {},
    });

    if (!event) {
      return NextResponse.json(
        { error: "Failed to save taste event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id: event.id });
  } catch (error) {
    console.error("Taste event error:", error);
    return NextResponse.json(
      { error: "Failed to save taste event" },
      { status: 500 }
    );
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
