import type { Look, TryOn } from "@/lib/db";

export function publicResultStatus(data: Look | TryOn) {
  return {
    id: data.id,
    pipeline: data.pipeline,
    status: data.status,
    result_url: data.result_url,
    ...("video_url" in data ? { video_url: data.video_url } : {}),
    error_message: data.error_message,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}
