const FASHN_API_URL = "https://api.fashn.ai/v1";

export type FashnStatus =
  | "starting"
  | "in_queue"
  | "processing"
  | "completed"
  | "failed";

export type FashnStatusResponse = {
  status: FashnStatus;
  output?: string | string[];
  error?: string;
};

export async function submitFashnTryOn(
  modelImage: string,
  garmentImage: string
) {
  const apiKey = getFashnApiKey();

  const response = await fetch(`${FASHN_API_URL}/run`, {
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
        mode: "performance",
        output_format: "jpeg",
        moderation_level: "permissive",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fashn submit failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  if (!data.id || typeof data.id !== "string") {
    throw new Error("No prediction ID returned");
  }

  return data.id;
}

export async function getFashnTryOnStatus(id: string) {
  const apiKey = getFashnApiKey();

  const response = await fetch(`${FASHN_API_URL}/status/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fashn status failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as FashnStatusResponse;
}

export function getFashnOutputImage(data: FashnStatusResponse) {
  if (Array.isArray(data.output) && data.output[0]) return data.output[0];
  if (typeof data.output === "string") return data.output;
  throw new Error("Unexpected Fashn output format");
}

function getFashnApiKey() {
  const apiKey = process.env.FASHN_API_KEY;
  if (!apiKey) throw new Error("FASHN_API_KEY not configured");
  return apiKey;
}
