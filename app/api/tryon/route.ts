import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { getServiceSupabase } from "@/lib/supabase";
import { uploadWithWatermark } from "@/lib/cloudinary";
import { v4 as uuidv4 } from "uuid";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: NextRequest) {
  try {
    const { userId, avatarUrl, garmentImageUrl, garmentImageBase64 } =
      await request.json();

    if (!avatarUrl) {
      return NextResponse.json(
        { error: "Avatar URL is required" },
        { status: 400 }
      );
    }

    if (!garmentImageUrl && !garmentImageBase64) {
      return NextResponse.json(
        { error: "Garment image is required" },
        { status: 400 }
      );
    }

    const garmImg = garmentImageBase64 || garmentImageUrl;

    const output = await replicate.run(
      "cuuupid/idm-vton:c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4",
      {
        input: {
          human_img: avatarUrl,
          garm_img: garmImg,
          garment_des: "clothing item",
          is_checked: true,
          is_checked_crop: false,
          denoise_steps: 30,
          seed: 42,
        },
      }
    );

    // Replicate SDK v1+ returns FileOutput objects, extract URL string
    let resultImageUrl: string;
    if (Array.isArray(output)) {
      const first = output[0];
      resultImageUrl = typeof first === "string" ? first : String(first);
    } else if (output && typeof output === "object" && "url" in output) {
      const urlMethod = (output as { url: () => string | URL }).url;
      const urlVal = typeof urlMethod === "function" ? urlMethod() : urlMethod;
      resultImageUrl = urlVal instanceof URL ? urlVal.href : String(urlVal);
    } else {
      resultImageUrl = String(output);
    }

    if (!resultImageUrl || resultImageUrl === "undefined") {
      return NextResponse.json(
        { error: "Try-on generation failed" },
        { status: 500 }
      );
    }

    const tryonId = uuidv4();

    const watermarkedUrl = await uploadWithWatermark(resultImageUrl, tryonId);

    const supabase = getServiceSupabase();
    const { error: dbError } = await supabase.from("tryons").insert({
      id: tryonId,
      user_id: userId || null,
      garment_url: garmentImageUrl || null,
      result_url: watermarkedUrl,
    });

    if (dbError) {
      console.error("Database error:", dbError);
    }

    return NextResponse.json({
      tryonId,
      resultImageUrl: watermarkedUrl,
    });
  } catch (error) {
    console.error("Try-on API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
