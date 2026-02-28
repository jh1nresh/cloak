import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const photo = formData.get("photo") as File;
    const height = formData.get("height") as string | null;
    const weight = formData.get("weight") as string | null;

    if (!photo) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const userId = uuidv4();
    const fileName = `${userId}/avatar.jpg`;

    const arrayBuffer = await photo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("Attempting upload to bucket 'avatars', file:", fileName, "size:", buffer.length);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    console.log("Upload result:", { uploadData, uploadError });

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
      height_cm: height ? parseInt(height) : null,
      weight_kg: weight ? parseInt(weight) : null,
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
    console.error("Avatar API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
