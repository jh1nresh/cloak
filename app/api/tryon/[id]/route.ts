import { NextRequest, NextResponse } from "next/server";
import { uploadWithWatermark } from "@/lib/cloudinary";
import {
  getTryOnById,
  lockTryOnForFinalizing,
  updateLookByTryOnId,
  updateTryOn,
} from "@/lib/db";
import { getFashnOutputImage, getFashnTryOnStatus } from "@/lib/fashn";
import { checkRequestRateLimit } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimit = await checkRequestRateLimit(request, {
      keyPrefix: "tryon-status",
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

    const data = await getTryOnById(id);

    if (!data) {
      return NextResponse.json(
        { error: "Try-on not found" },
        { status: 404 }
      );
    }

    if (
      data.status !== "processing" ||
      data.result_url ||
      !data.fashn_prediction_id
    ) {
      return noStoreJson(data);
    }

    const fashnStatus = await getFashnTryOnStatus(data.fashn_prediction_id);

    if (fashnStatus.status === "failed") {
      const failedData = await updateTryOn(id, {
        status: "failed",
        error_message: fashnStatus.error || "Try-on generation failed",
      });
      await updateLookByTryOnId(id, {
        status: "failed",
        error_message: fashnStatus.error || "Try-on generation failed",
      }).catch((error) => console.error("Look failure update failed:", error));

      return noStoreJson(failedData || {
        ...data,
        status: "failed",
        error_message: fashnStatus.error || "Try-on generation failed",
      });
    }

    if (fashnStatus.status !== "completed") {
      return noStoreJson(data);
    }

    const lockedData = await lockTryOnForFinalizing(id);

    if (!lockedData) {
      const latestData = await getTryOnById(id);

      return noStoreJson(latestData || data);
    }

    try {
      const outputImageUrl = getFashnOutputImage(fashnStatus);
      const watermarkedUrl = await uploadWithWatermark(outputImageUrl, id);
      const completedData = await updateTryOn(id, {
        result_url: watermarkedUrl,
        status: "completed",
        error_message: null,
      });
      await updateLookByTryOnId(id, {
        result_url: watermarkedUrl,
        status: "completed",
        error_message: null,
      }).catch((error) => console.error("Look completion update failed:", error));

      if (!completedData) {
        throw new Error("Failed to save completed try-on");
      }

      return noStoreJson(completedData);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to finalize try-on";
      const failedData = await updateTryOn(id, {
        status: "failed",
        error_message: message,
      });
      await updateLookByTryOnId(id, {
        status: "failed",
        error_message: message,
      }).catch((error) => console.error("Look finalization update failed:", error));

      return noStoreJson(failedData || {
        ...lockedData,
        status: "failed",
        error_message: message,
      });
    }
  } catch (error) {
    console.error("Get try-on error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function noStoreJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...init?.headers,
      "Cache-Control": "no-store",
    },
  });
}
