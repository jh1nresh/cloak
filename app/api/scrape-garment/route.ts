import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { checkRequestRateLimit } from "@/lib/rate-limit";
import {
  createSavedItem,
  getUserById,
  insertItemImages,
  upsertGarment,
} from "@/lib/db";
import { analyzeProductImages } from "@/lib/product-analysis";
import {
  assertPublicHttpUrl,
  fetchPublicUrl,
  InputValidationError,
  MAX_SCRAPE_HTML_BYTES,
  readTextWithLimit,
} from "@/lib/security";

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRequestRateLimit(request, {
      keyPrefix: "scrape-garment",
      maxRequests: 30,
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

    const { url, userId } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (userId && typeof userId !== "string") {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    if (userId) {
      const user = await getUserById(userId);
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
    }

    const sourceUrl = (await assertPublicHttpUrl(url)).toString();
    const sourceUrlObj = new URL(sourceUrl);
    const response = await fetchPublicUrl(sourceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch the page" },
        { status: 400 }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.toLowerCase().includes("text/html")) {
      return NextResponse.json(
        { error: "URL did not return HTML" },
        { status: 400 }
      );
    }

    const html = await readTextWithLimit(response, MAX_SCRAPE_HTML_BYTES);
    const analysis = await analyzeProductImages({ html, sourceUrl });
    const selectedImage = analysis.selectedImage;

    if (!selectedImage) {
      return NextResponse.json(
        { error: "Could not find product image" },
        { status: 400 }
      );
    }

    const publicImageUrl = await assertPublicHttpUrl(selectedImage.url);
    const $ = cheerio.load(html);
    const title = cleanText(
      $('meta[property="og:title"]').attr("content") ||
        $('meta[name="twitter:title"]').attr("content") ||
        $("title").first().text()
    );
    const brand = cleanText(
      $('meta[property="og:site_name"]').attr("content") ||
        $('[itemprop="brand"]').first().text() ||
        sourceUrlObj.hostname.replace(/^www\./, "")
    );
    const price = cleanText(
      $('meta[property="product:price:amount"]').attr("content") ||
        $('[itemprop="price"]').first().attr("content") ||
        $('[itemprop="price"]').first().text()
    );

    const garment = await upsertGarment({
      sourceUrl,
      imageUrl: publicImageUrl.toString(),
      title,
      brand,
      price,
      domain: sourceUrlObj.hostname.replace(/^www\./, ""),
      imageClassification: selectedImage.classification,
      recommendedPipeline: analysis.recommendedPipeline,
    });

    if (!garment) {
      return NextResponse.json(
        { error: "Failed to save garment" },
        { status: 500 }
      );
    }

    let savedItem = null;
    let itemImages = null;
    if (userId) {
      savedItem = await createSavedItem({
        userId,
        sourceType: "url",
        sourceUrl,
        sourceDomain: sourceUrlObj.hostname.replace(/^www\./, ""),
        title,
        brand,
        price,
        status: "ready",
      });

      if (savedItem) {
        itemImages = await insertItemImages(
          savedItem.id,
          analysis.candidates.slice(0, 12).map((candidate) => ({
            imageUrl: candidate.url,
            width: candidate.width,
            height: candidate.height,
            rank: candidate.rank,
            classification: candidate.classification,
            selectedForGeneration: candidate.url === selectedImage.url,
          }))
        );
      }
    }

    return NextResponse.json({
      imageUrl: garment.image_url,
      garment,
      savedItem,
      itemImages,
      selectedImage,
      recommendedPipeline: analysis.recommendedPipeline,
    });
  } catch (error) {
    if (error instanceof InputValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: "Failed to scrape product page" },
      { status: 500 }
    );
  }
}

function cleanText(value: string | undefined) {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || null;
}
