import * as cheerio from "cheerio";
import { assertPublicHttpUrl } from "./security";

export type ImageClassification =
  | "on_model"
  | "flat_product"
  | "editorial"
  | "logo"
  | "unknown";

export type RecommendedPipeline = "model_swap" | "tryon";

export type ProductImageCandidate = {
  url: string;
  width: number | null;
  height: number | null;
  rank: number;
  classification: ImageClassification;
  score: number;
};

const ON_MODEL_TERMS = [
  "model",
  "on-model",
  "on model",
  "worn",
  "wearing",
  "outfit",
  "lookbook",
  "lifestyle",
  "editorial",
  "pdp-model",
  "styled",
];

const FLAT_PRODUCT_TERMS = [
  "flat",
  "flatlay",
  "flat-lay",
  "packshot",
  "product-only",
  "product only",
  "hanger",
  "still",
  "ghost",
];

const LOGO_TERMS = ["logo", "icon", "sprite", "placeholder", "favicon"];

export async function analyzeProductImages(input: {
  html: string;
  sourceUrl: string;
}) {
  const $ = cheerio.load(input.html);
  const sourceUrl = new URL(input.sourceUrl);
  const seen = new Set<string>();
  const candidates: ProductImageCandidate[] = [];

  const addCandidate = async (rawUrl: string | undefined, context: string) => {
    if (seen.size >= 80) return;

    const absoluteUrl = normalizeImageUrl(rawUrl, sourceUrl);
    if (!absoluteUrl || seen.has(absoluteUrl)) return;

    try {
      const publicUrl = (await assertPublicHttpUrl(absoluteUrl)).toString();
      seen.add(publicUrl);
      const lowerContext = `${context} ${publicUrl}`.toLowerCase();
      const width = parseDimension(context, "width");
      const height = parseDimension(context, "height");
      const classification = classifyImage(lowerContext);
      const score = scoreCandidate({
        width,
        height,
        classification,
        context: lowerContext,
      });

      candidates.push({
        url: publicUrl,
        width,
        height,
        rank: 0,
        classification,
        score,
      });
    } catch {
      // Invalid or private URLs are ignored; page-level URL validation already
      // protects the fetch path.
    }
  };

  await addCandidate(
    $('meta[property="og:image"]').attr("content"),
    "og image primary"
  );
  await addCandidate(
    $('meta[name="twitter:image"]').attr("content"),
    "twitter image primary"
  );

  const productImageSelectors = [
    '[data-testid*="product"] img',
    '[data-testid*="image"] img',
    ".product-image img",
    ".pdp-image img",
    "#product-image img",
    ".gallery-image img",
    "picture img",
    "img",
  ];

  for (const img of $(productImageSelectors.join(",")).toArray()) {
    if (seen.size >= 80) break;

    const element = $(img);
    const src =
      element.attr("src") ||
      element.attr("data-src") ||
      element.attr("data-original") ||
      element.attr("data-zoom-image") ||
      element.attr("srcset")?.split(",").pop()?.trim().split(/\s+/)[0];
    const parent = element.parent();
    const context = [
      element.attr("alt"),
      element.attr("class"),
      element.attr("id"),
      element.attr("data-testid"),
      element.attr("width"),
      element.attr("height"),
      parent.attr("class"),
      parent.attr("data-testid"),
      `width:${element.attr("width") || ""}`,
      `height:${element.attr("height") || ""}`,
    ]
      .filter(Boolean)
      .join(" ");

    await addCandidate(src, context);
  }

  const ranked = candidates
    .filter((candidate) => candidate.classification !== "logo")
    .sort((a, b) => b.score - a.score)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  const selectedImage = ranked[0] || null;
  const recommendedPipeline =
    selectedImage &&
    (selectedImage.classification === "on_model" ||
      selectedImage.classification === "editorial")
      ? "model_swap"
      : "tryon";

  return {
    candidates: ranked,
    selectedImage,
    recommendedPipeline: recommendedPipeline as RecommendedPipeline,
  };
}

export function classifyImage(context: string): ImageClassification {
  if (LOGO_TERMS.some((term) => context.includes(term))) return "logo";
  if (ON_MODEL_TERMS.some((term) => context.includes(term))) {
    return context.includes("editorial") || context.includes("lookbook")
      ? "editorial"
      : "on_model";
  }
  if (FLAT_PRODUCT_TERMS.some((term) => context.includes(term))) {
    return "flat_product";
  }
  return "unknown";
}

function scoreCandidate(input: {
  width: number | null;
  height: number | null;
  classification: ImageClassification;
  context: string;
}) {
  const area = (input.width || 0) * (input.height || 0);
  const dimensionScore = Math.min(area / 1000, 800);
  const classificationScore: Record<ImageClassification, number> = {
    on_model: 900,
    editorial: 850,
    flat_product: 500,
    unknown: 300,
    logo: -1000,
  };
  const primaryBonus =
    input.context.includes("og image") || input.context.includes("primary")
      ? 120
      : 0;

  return classificationScore[input.classification] + dimensionScore + primaryBonus;
}

function normalizeImageUrl(rawUrl: string | undefined, baseUrl: URL) {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return new URL(trimmed, baseUrl).toString();
}

function parseDimension(context: string, key: "width" | "height") {
  const match = context.match(new RegExp(`${key}:?["']?\\s*(\\d{2,5})`, "i"));
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}
