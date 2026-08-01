import { NextRequest, NextResponse } from "next/server";
import { createMockTryOn } from "@/lib/tryon/mock-provider";
import {
  assertAllowedContentLength,
  assertValidImageFile,
  InputValidationError,
} from "@/lib/security";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_PHOTO_BYTES + 512 * 1024;

export async function POST(request: NextRequest) {
  try {
    assertAllowedContentLength(request, MAX_REQUEST_BYTES);

    const formData = await request.formData();
    const productId = formData.get("productId");
    const photo = formData.get("photo");

    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { error: "Product is required" },
        { status: 400 }
      );
    }

    if (!photo || !(photo instanceof File)) {
      return NextResponse.json({ error: "Photo is required" }, { status: 400 });
    }

    assertValidImageFile(photo, MAX_PHOTO_BYTES);

    const result = await createMockTryOn(productId);

    if (!result) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InputValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Drop try-on API error:", error);
    return NextResponse.json(
      { error: "Unable to create preview" },
      { status: 500 }
    );
  }
}
