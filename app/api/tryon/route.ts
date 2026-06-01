import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { submitFashnModelSwap, submitFashnTryOn } from "@/lib/fashn";
import {
  getGarmentById,
  getSavedItemById,
  getUserById,
  insertLook,
  insertTryOn,
  updateTryOn,
} from "@/lib/db";
import { checkRequestRateLimit } from "@/lib/rate-limit";
import {
  assertAllowedContentLength,
  assertPublicHttpUrl,
  assertValidImageDataUrl,
  InputValidationError,
  MAX_GARMENT_DATA_URL_BYTES,
} from "@/lib/security";

const MAX_TRYON_REQUEST_BYTES = MAX_GARMENT_DATA_URL_BYTES + 512 * 1024;

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRequestRateLimit(request, {
      keyPrefix: "tryon",
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

    assertAllowedContentLength(request, MAX_TRYON_REQUEST_BYTES);

    const {
      userId,
      avatarUrl,
      garmentId,
      garmentImageUrl,
      garmentImageBase64,
      savedItemId,
    } = await request.json();

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (!avatarUrl || typeof avatarUrl !== "string") {
      return NextResponse.json(
        { error: "Avatar URL is required" },
        { status: 400 }
      );
    }

    if (
      (garmentId && typeof garmentId !== "string") ||
      (garmentImageUrl && typeof garmentImageUrl !== "string") ||
      (garmentImageBase64 && typeof garmentImageBase64 !== "string") ||
      (savedItemId && typeof savedItemId !== "string")
    ) {
      return NextResponse.json(
        { error: "Invalid garment image" },
        { status: 400 }
      );
    }

    if (!garmentId && !garmentImageUrl && !garmentImageBase64) {
      return NextResponse.json(
        { error: "Garment image is required" },
        { status: 400 }
      );
    }

    await assertPublicHttpUrl(avatarUrl);
    if (garmentImageBase64) {
      assertValidImageDataUrl(garmentImageBase64);
    }

    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.avatar_url !== avatarUrl) {
      return NextResponse.json(
        { error: "Avatar does not belong to user" },
        { status: 403 }
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

    let storedGarmentId: string | null = null;
    let storedGarmentUrl: string | null = garmentImageUrl || null;
    let pipeline: "model_swap" | "tryon" = "tryon";

    if (garmentId) {
      const garment = await getGarmentById(garmentId);

      if (!garment) {
        return NextResponse.json(
          { error: "Garment not found" },
          { status: 404 }
        );
      }

      storedGarmentId = garment.id;
      storedGarmentUrl = garment.image_url;
      pipeline = garment.recommended_pipeline;
    }

    if (storedGarmentUrl) {
      await assertPublicHttpUrl(storedGarmentUrl);
    }

    const garmentImage = garmentImageBase64 || storedGarmentUrl;
    if (!garmentImage) {
      return NextResponse.json(
        { error: "Garment image is required" },
        { status: 400 }
      );
    }

    const tryonId = randomUUID();
    const insertedTryOn = await insertTryOn({
      id: tryonId,
      userId,
      garmentId: storedGarmentId,
      garmentUrl: storedGarmentUrl,
      pipeline,
      savedItemId: savedItemId || null,
      sourceImageUrl: storedGarmentUrl,
    });

    if (!insertedTryOn) {
      return NextResponse.json(
        { error: "Failed to create try-on job" },
        { status: 500 }
      );
    }

    let predictionId: string;
    try {
      predictionId =
        pipeline === "model_swap" && storedGarmentUrl
          ? await submitFashnModelSwap(storedGarmentUrl, avatarUrl)
          : await submitFashnTryOn(avatarUrl, garmentImage);
    } catch (error) {
      await updateTryOn(tryonId, {
        status: "failed",
        error_message:
          error instanceof Error ? error.message : "Failed to submit try-on",
      });

      throw error;
    }

    const updatedTryOn = await updateTryOn(tryonId, {
      status: "processing",
      fashn_prediction_id: predictionId,
      error_message: null,
    });

    if (!updatedTryOn) {
      return NextResponse.json(
        { error: "Failed to save try-on job" },
        { status: 500 }
      );
    }

    let lookId: string | null = randomUUID();
    try {
      await insertLook({
        id: lookId,
        userId,
        savedItemId: savedItemId || null,
        sourceImageId: null,
        tryonId,
        pipeline,
        provider: "fashn",
        providerJobId: predictionId,
      });
    } catch (error) {
      console.error("Look insert failed:", error);
      lookId = null;
    }

    return NextResponse.json({
      id: tryonId,
      tryonId,
      lookId,
      pipeline,
      status: "processing",
    });
  } catch (error) {
    if (error instanceof InputValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Try-on API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
