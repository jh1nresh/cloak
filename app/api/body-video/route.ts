import { NextRequest, NextResponse } from "next/server";
import { uploadVideo } from "@/lib/cloudinary";
import { getUserById, setUserBodyVideo } from "@/lib/db";
import { checkRequestRateLimit } from "@/lib/rate-limit";
import {
  assertAllowedContentLength,
  assertValidVideoBytes,
  assertValidVideoFile,
  InputValidationError,
  MAX_BODY_VIDEO_BYTES,
} from "@/lib/security";

const MAX_BODY_VIDEO_REQUEST_BYTES = MAX_BODY_VIDEO_BYTES + 512 * 1024;

/// The body capture is recorded once and reused as the subject input for every
/// motion look, so this route is deliberately low-volume.
export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRequestRateLimit(request, {
      keyPrefix: "body-video",
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

    assertAllowedContentLength(request, MAX_BODY_VIDEO_REQUEST_BYTES);

    const formData = await request.formData();
    const userId = formData.get("userId");
    const video = formData.get("video");

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (!video || !(video instanceof File)) {
      return NextResponse.json({ error: "No video provided" }, { status: 400 });
    }

    assertValidVideoFile(video);

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await video.arrayBuffer());
    assertValidVideoBytes(buffer);

    const uploaded = await uploadVideo(buffer, "cloak/body-videos", userId);
    const updated = await setUserBodyVideo(userId, {
      videoUrl: uploaded.url,
      posterUrl: uploaded.posterUrl,
      durationMs: uploaded.durationMs,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to save body video" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      bodyVideoUrl: updated.body_video_url,
      posterUrl: updated.body_video_poster_url,
      durationMs: updated.body_video_duration_ms,
    });
  } catch (error) {
    if (error instanceof InputValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Body video API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
