import { NextRequest, NextResponse } from "next/server";
import { uploadWithWatermark } from "@/lib/cloudinary";
import { getFashnOutputImage, getFashnTryOnStatus } from "@/lib/fashn";
import { checkRequestRateLimit } from "@/lib/rate-limit";
import { getServiceSupabase } from "@/lib/supabase";

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

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("tryons")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
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
      const { data: failedData } = await supabase
        .from("tryons")
        .update({
          status: "failed",
          error_message: fashnStatus.error || "Try-on generation failed",
        })
        .eq("id", id)
        .select("*")
        .single();

      return noStoreJson(failedData || {
        ...data,
        status: "failed",
        error_message: fashnStatus.error || "Try-on generation failed",
      });
    }

    if (fashnStatus.status !== "completed") {
      return noStoreJson(data);
    }

    const { data: lockedData, error: lockError } = await supabase
      .from("tryons")
      .update({ status: "finalizing" })
      .eq("id", id)
      .eq("status", "processing")
      .is("result_url", null)
      .select("*")
      .single();

    if (lockError || !lockedData) {
      const { data: latestData } = await supabase
        .from("tryons")
        .select("*")
        .eq("id", id)
        .single();

      return noStoreJson(latestData || data);
    }

    try {
      const outputImageUrl = getFashnOutputImage(fashnStatus);
      const watermarkedUrl = await uploadWithWatermark(outputImageUrl, id);
      const { data: completedData, error: updateError } = await supabase
        .from("tryons")
        .update({
          result_url: watermarkedUrl,
          status: "completed",
          error_message: null,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (updateError || !completedData) {
        throw updateError || new Error("Failed to save completed try-on");
      }

      return noStoreJson(completedData);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to finalize try-on";
      const { data: failedData } = await supabase
        .from("tryons")
        .update({
          status: "failed",
          error_message: message,
        })
        .eq("id", id)
        .select("*")
        .single();

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
