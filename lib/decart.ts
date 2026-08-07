const DECART_API_URL = "https://api.decart.ai/v1";

/// Batch video try-on. There is no image-to-image VTON model — the subject
/// side must be video, which is why every look is generated against a stored
/// body capture rather than a still selfie.
const DECART_VTON_MODEL = "lucy-vton-3";

export type DecartStatus = "pending" | "processing" | "completed" | "failed";

export type DecartJobResponse = {
  status: DecartStatus;
  /// Present on completion for some models; otherwise read the content route.
  url?: string;
  error?: string;
};

/// Substitute-pattern prompt. Decart's guidance is to name the swap explicitly
/// and let the reference image carry colour, material, and fit.
const DEFAULT_VTON_PROMPT =
  "Substitute the current outfit with the garment from the reference image, matching its color, material, and fit.";

export async function submitDecartVton(input: {
  video: Blob;
  videoFilename?: string;
  garment: Blob;
  garmentFilename?: string;
  prompt?: string;
}): Promise<string> {
  const apiKey = getDecartApiKey();

  const form = new FormData();
  form.append("data", input.video, input.videoFilename ?? "body.mp4");
  form.append(
    "reference_image",
    input.garment,
    input.garmentFilename ?? "garment.jpg"
  );
  form.append("prompt", input.prompt ?? DEFAULT_VTON_PROMPT);

  const response = await fetch(`${DECART_API_URL}/jobs/${DECART_VTON_MODEL}`, {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Decart submit failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const jobId = data.job_id ?? data.id;
  if (!jobId || typeof jobId !== "string") {
    throw new Error("No Decart job ID returned");
  }

  return jobId;
}

export async function getDecartJobStatus(
  jobId: string
): Promise<DecartJobResponse> {
  const apiKey = getDecartApiKey();

  const response = await fetch(`${DECART_API_URL}/jobs/${jobId}`, {
    headers: { "x-api-key": apiKey },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Decart status failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as DecartJobResponse;
}

/// Returns the finished MP4. Prefers a direct URL when the job carries one and
/// falls back to the content route.
export async function fetchDecartResultVideo(
  jobId: string,
  job?: DecartJobResponse
): Promise<Buffer> {
  const apiKey = getDecartApiKey();

  if (job?.url) {
    const direct = await fetch(job.url);
    if (!direct.ok) {
      throw new Error(`Decart result fetch failed: ${direct.status}`);
    }
    return Buffer.from(await direct.arrayBuffer());
  }

  const response = await fetch(`${DECART_API_URL}/jobs/${jobId}/content`, {
    headers: { "x-api-key": apiKey },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Decart content failed: ${response.status} ${errorText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export function isDecartConfigured() {
  return Boolean(process.env.DECART_API_KEY);
}

function getDecartApiKey() {
  const apiKey = process.env.DECART_API_KEY;
  if (!apiKey) throw new Error("DECART_API_KEY not configured");
  return apiKey;
}
