import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { checkRequestRateLimit } from "@/lib/rate-limit";
import { uploadImage } from "@/lib/cloudinary";
import { createUser } from "@/lib/db";
import {
  assertAllowedContentLength,
  assertValidImageBytes,
  assertValidImageFile,
  InputValidationError,
  MAX_AVATAR_BYTES,
} from "@/lib/security";

const MAX_AVATAR_REQUEST_BYTES = MAX_AVATAR_BYTES + 512 * 1024;

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRequestRateLimit(request, {
      keyPrefix: "avatar",
      maxRequests: 12,
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

    assertAllowedContentLength(request, MAX_AVATAR_REQUEST_BYTES);

    const formData = await request.formData();
    const photo = formData.get("photo") as File;
    const height = formData.get("height") as string | null;
    const weight = formData.get("weight") as string | null;

    if (!photo || !(photo instanceof File)) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 });
    }

    assertValidImageFile(photo);

    const heightCm = parseOptionalNumber(height, 80, 250);
    const weightKg = parseOptionalNumber(weight, 25, 350);

    const userId = randomUUID();

    const arrayBuffer = await photo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    assertValidImageBytes(buffer, photo.type);

    const avatarUrl = await uploadImage(
      buffer,
      "cloak/avatars",
      userId,
      photo.type
    );
    const user = await createUser({
      id: userId,
      avatarUrl,
      heightCm,
      weightKg,
    });

    if (!user) {
      return NextResponse.json(
        { error: "Failed to save user data" },
        { status: 500 }
      );
    }

    return NextResponse.json({ userId, avatarUrl });
  } catch (error) {
    if (error instanceof InputValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Avatar API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function parseOptionalNumber(
  value: string | null,
  min: number,
  max: number
) {
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new InputValidationError(`Number must be between ${min} and ${max}`);
  }

  return parsed;
}
