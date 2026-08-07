import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { submitDecartVton } from "@/lib/decart";
import {
  getGarmentById,
  getSavedItemById,
  getUserById,
  insertMotionLook,
  updateLook,
} from "@/lib/db";
import { checkRequestRateLimit } from "@/lib/rate-limit";
import {
  fetchPublicUrl,
  InputValidationError,
  MAX_GARMENT_DATA_URL_BYTES,
} from "@/lib/security";

/// Submits a motion try-on against the user's stored body capture. Returns as
/// soon as the provider accepts the job — generation is never awaited here.
export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRequestRateLimit(request, {
      keyPrefix: "looks-motion",
      maxRequests: 6,
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

    const { userId, garmentId, garmentImageUrl, savedItemId, prompt } =
      await request.json();

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (
      (garmentId && typeof garmentId !== "string") ||
      (garmentImageUrl && typeof garmentImageUrl !== "string") ||
      (savedItemId && typeof savedItemId !== "string") ||
      (prompt && typeof prompt !== "string")
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (!garmentId && !garmentImageUrl) {
      return NextResponse.json(
        { error: "Garment image is required" },
        { status: 400 }
      );
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Distinct from a generic failure: the client routes this to capture.
    if (!user.body_video_url) {
      return NextResponse.json(
        {
          error: "body_video_missing",
          detail: "Record a body video before generating a motion look.",
        },
        { status: 409 }
      );
    }

    if (savedItemId) {
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

    let garmentUrl = garmentImageUrl || null;
    if (garmentId) {
      const garment = await getGarmentById(garmentId);
      if (!garment) {
        return NextResponse.json(
          { error: "Garment not found" },
          { status: 404 }
        );
      }
      garmentUrl = garment.image_url;
    }

    if (!garmentUrl) {
      return NextResponse.json(
        { error: "Garment image is required" },
        { status: 400 }
      );
    }

    // Decart takes both sides as file uploads, so each is pulled server-side.
    // The garment URL is attacker-influenced and goes through the SSRF guard.
    const [garment, bodyVideo] = await Promise.all([
      fetchBlob(garmentUrl, MAX_GARMENT_DATA_URL_BYTES, true),
      fetchBlob(user.body_video_url, 200 * 1024 * 1024, false),
    ]);

    const lookId = randomUUID();
    const look = await insertMotionLook({
      id: lookId,
      userId,
      savedItemId: savedItemId || null,
      sourceImageId: null,
      provider: "decart",
      providerJobId: null,
    });

    if (!look) {
      return NextResponse.json(
        { error: "Failed to create motion look" },
        { status: 500 }
      );
    }

    let jobId: string;
    try {
      jobId = await submitDecartVton({
        video: bodyVideo,
        garment,
        prompt: prompt || undefined,
      });
    } catch (error) {
      await updateLook(lookId, {
        status: "failed",
        error_message:
          error instanceof Error
            ? error.message
            : "Failed to submit motion look",
      });
      throw error;
    }

    const updated = await updateLook(lookId, {
      provider_job_id: jobId,
      status: "processing",
      error_message: null,
    });

    return NextResponse.json({
      id: lookId,
      lookId,
      pipeline: "motion",
      status: updated?.status ?? "processing",
    });
  } catch (error) {
    if (error instanceof InputValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Motion look API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function fetchBlob(url: string, maxBytes: number, guarded: boolean) {
  const response = guarded ? await fetchPublicUrl(url) : await fetch(url);

  if (!response.ok) {
    throw new InputValidationError(`Could not read source asset (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > maxBytes) {
    throw new InputValidationError("Source asset is too large", 413);
  }

  return new Blob([buffer]);
}
