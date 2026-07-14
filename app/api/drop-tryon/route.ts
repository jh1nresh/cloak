import { NextRequest, NextResponse } from "next/server";
import { createMockTryOn } from "@/lib/tryon/mock-provider";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const productId = formData.get("productId");
  const photo = formData.get("photo");

  if (!productId || typeof productId !== "string") {
    return NextResponse.json({ error: "Product is required" }, { status: 400 });
  }

  if (!photo || !(photo instanceof File)) {
    return NextResponse.json({ error: "Photo is required" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(photo.type)) {
    return NextResponse.json(
      { error: "Upload a JPG, PNG, WebP, HEIC, or HEIF image" },
      { status: 415 }
    );
  }

  if (photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { error: "Photo must be 8MB or smaller" },
      { status: 413 }
    );
  }

  const result = await createMockTryOn(productId);

  if (!result) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
