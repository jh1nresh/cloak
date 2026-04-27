import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { uploadWithWatermark } from "@/lib/cloudinary";
import { v4 as uuidv4 } from "uuid";
import {
  assertAllowedContentLength,
  assertPublicHttpUrl,
  assertValidImageDataUrl,
  checkRateLimit,
  getClientIp,
  InputValidationError,
  MAX_GARMENT_DATA_URL_BYTES,
} from "@/lib/security";

const FASHN_API_URL = "https://api.fashn.ai/v1";
const MAX_TRYON_REQUEST_BYTES = MAX_GARMENT_DATA_URL_BYTES + 512 * 1024;

async function runFashnTryOn(
  modelImage: string,
  garmentImage: string
): Promise<string> {
  const apiKey = process.env.FASHN_API_KEY;
  if (!apiKey) throw new Error("FASHN_API_KEY not configured");

  // Submit job
  const submitRes = await fetch(`${FASHN_API_URL}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model_name: "tryon-v1.6",
      inputs: {
        model_image: modelImage,
        garment_image: garmentImage,
        category: "auto",
        mode: "performance", // 5s — fastest
        output_format: "jpeg",
        moderation_level: "permissive",
      },
    }),
  });

  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`Fashn submit failed: ${submitRes.status} ${err}`);
  }

  const { id } = await submitRes.json();
  if (!id) throw new Error("No prediction ID returned");

  // Poll until completed (max 60s)
  const maxAttempts = 30;
  const pollInterval = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const statusRes = await fetch(`${FASHN_API_URL}/status/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!statusRes.ok) continue;

    const data = await statusRes.json();

    if (data.status === "completed") {
      const output = data.output;
      if (Array.isArray(output) && output[0]) return output[0];
      if (typeof output === "string") return output;
      throw new Error("Unexpected output format");
    }

    if (data.status === "failed") {
      throw new Error(`Fashn failed: ${data.error || "unknown error"}`);
    }

    // starting | in_queue | processing → keep polling
  }

  throw new Error("Fashn timed out after 60s");
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(getClientIp(request), {
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

    const { userId, avatarUrl, garmentImageUrl, garmentImageBase64 } =
      await request.json();

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
      (garmentImageUrl && typeof garmentImageUrl !== "string") ||
      (garmentImageBase64 && typeof garmentImageBase64 !== "string")
    ) {
      return NextResponse.json(
        { error: "Invalid garment image" },
        { status: 400 }
      );
    }

    if (!garmentImageUrl && !garmentImageBase64) {
      return NextResponse.json(
        { error: "Garment image is required" },
        { status: 400 }
      );
    }

    await assertPublicHttpUrl(avatarUrl);
    if (garmentImageUrl) {
      await assertPublicHttpUrl(garmentImageUrl);
    }
    if (garmentImageBase64) {
      assertValidImageDataUrl(garmentImageBase64);
    }

    const supabase = getServiceSupabase();
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, avatar_url")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.avatar_url !== avatarUrl) {
      return NextResponse.json(
        { error: "Avatar does not belong to user" },
        { status: 403 }
      );
    }

    const garmentImage = garmentImageBase64 || garmentImageUrl;
    if (!garmentImage) {
      return NextResponse.json(
        { error: "Garment image is required" },
        { status: 400 }
      );
    }

    const resultImageUrl = await runFashnTryOn(avatarUrl, garmentImage);

    const tryonId = uuidv4();
    const watermarkedUrl = await uploadWithWatermark(resultImageUrl, tryonId);

    const { error: dbError } = await supabase.from("tryons").insert({
      id: tryonId,
      user_id: userId,
      garment_url: garmentImageUrl || null,
      result_url: watermarkedUrl,
    });

    if (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json(
        { error: "Failed to save try-on result" },
        { status: 500 }
      );
    }

    return NextResponse.json({ tryonId, resultImageUrl: watermarkedUrl });
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

// GET handler for fetching a single tryon result
export async function GET(request: NextRequest) {
  const id = request.nextUrl.pathname.split("/").pop();
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("tryons")
    .select("id, result_url, created_at")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
