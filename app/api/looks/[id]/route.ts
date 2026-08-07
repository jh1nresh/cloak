import { NextRequest, NextResponse } from "next/server";
import { uploadVideo } from "@/lib/cloudinary";
import { getLookById, lockLookForFinalizing, updateLook } from "@/lib/db";
import { fetchDecartResultVideo, getDecartJobStatus } from "@/lib/decart";
import { checkRequestRateLimit } from "@/lib/rate-limit";

/// Poll for one look. Non-motion looks are returned as stored — their status
/// is driven by the try-on route.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimit = await checkRequestRateLimit(request, {
      keyPrefix: "look-status",
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

    const { id } = await params;
    const look = await getLookById(id);

    if (!look) {
      return NextResponse.json({ error: "Look not found" }, { status: 404 });
    }

    if (
      look.pipeline !== "motion" ||
      look.status !== "processing" ||
      look.video_url ||
      !look.provider_job_id
    ) {
      return noStoreJson(look);
    }

    const job = await getDecartJobStatus(look.provider_job_id);

    if (job.status === "failed") {
      const message = job.error || "Motion generation failed";
      const failed = await updateLook(id, {
        status: "failed",
        error_message: message,
      });

      return noStoreJson(
        failed || { ...look, status: "failed", error_message: message }
      );
    }

    if (job.status !== "completed") {
      return noStoreJson(look);
    }

    // Claim the look so two concurrent polls cannot both upload the result.
    const locked = await lockLookForFinalizing(id);
    if (!locked) {
      return noStoreJson((await getLookById(id)) || look);
    }

    try {
      const video = await fetchDecartResultVideo(look.provider_job_id, job);
      const uploaded = await uploadVideo(video, "cloak/looks", id);

      const completed = await updateLook(id, {
        status: "completed",
        video_url: uploaded.url,
        // Poster frame doubles as the still result, so the feed grid and any
        // legacy still consumer keep working unchanged.
        result_url: uploaded.posterUrl,
        error_message: null,
      });

      if (!completed) {
        throw new Error("Failed to save completed look");
      }

      return noStoreJson(completed);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to finalize look";
      const failed = await updateLook(id, {
        status: "failed",
        error_message: message,
      });

      return noStoreJson(
        failed || { ...locked, status: "failed", error_message: message }
      );
    }
  } catch (error) {
    console.error("Get look error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function noStoreJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...init?.headers, "Cache-Control": "no-store" },
  });
}
