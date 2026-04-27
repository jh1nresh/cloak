import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import {
  assertAllowedContentLength,
  assertValidImageBytes,
  assertValidImageFile,
  checkRateLimit,
  getClientIp,
  InputValidationError,
  MAX_AVATAR_BYTES,
} from "@/lib/security";

const MAX_AVATAR_REQUEST_BYTES = MAX_AVATAR_BYTES + 512 * 1024;

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(getClientIp(request), {
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

    const supabase = getServiceSupabase();
    const userId = uuidv4();
    const fileName = `${userId}/avatar${extensionForContentType(photo.type)}`;

    const arrayBuffer = await photo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    assertValidImageBytes(buffer, photo.type);

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, buffer, {
        contentType: photo.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error full:", JSON.stringify(uploadError));
      return NextResponse.json(
        { error: "Failed to upload avatar", detail: uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    const avatarUrl = urlData.publicUrl;

    const { error: dbError } = await supabase.from("users").insert({
      id: userId,
      avatar_url: avatarUrl,
      height_cm: heightCm,
      weight_kg: weightKg,
    });

    if (dbError) {
      console.error("Database error:", dbError);
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

function extensionForContentType(contentType: string) {
  switch (contentType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/heic":
      return ".heic";
    case "image/heif":
      return ".heif";
    default:
      return ".jpg";
  }
}
