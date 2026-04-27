import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import {
  assertPublicHttpUrl,
  checkRateLimit,
  fetchPublicUrl,
  getClientIp,
  InputValidationError,
  MAX_SCRAPE_HTML_BYTES,
  readTextWithLimit,
} from "@/lib/security";

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(getClientIp(request), {
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

    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const response = await fetchPublicUrl(url, {
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
    const $ = cheerio.load(html);

    let imageUrl: string | null = null;

    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      imageUrl = ogImage;
    }

    if (!imageUrl) {
      const twitterImage = $('meta[name="twitter:image"]').attr("content");
      if (twitterImage) {
        imageUrl = twitterImage;
      }
    }

    if (!imageUrl) {
      const productImage = $(
        '[data-testid="product-image"], .product-image img, .pdp-image img, #product-image img, .gallery-image img'
      )
        .first()
        .attr("src");
      if (productImage) {
        imageUrl = productImage;
      }
    }

    if (!imageUrl) {
      const images = $("img").toArray();
      let largestImage = { url: "", size: 0 };

      for (const img of images) {
        const src = $(img).attr("src") || $(img).attr("data-src");
        const width = parseInt($(img).attr("width") || "0");
        const height = parseInt($(img).attr("height") || "0");
        const size = width * height;

        if (src && size > largestImage.size && !src.includes("logo") && !src.includes("icon")) {
          largestImage = { url: src, size };
        }
      }

      if (largestImage.url) {
        imageUrl = largestImage.url;
      }
    }

    if (!imageUrl) {
      const firstLargeImage = $('img[width], img[height]')
        .filter((_, el) => {
          const w = parseInt($(el).attr("width") || "0");
          const h = parseInt($(el).attr("height") || "0");
          return w > 200 || h > 200;
        })
        .first()
        .attr("src");

      if (firstLargeImage) {
        imageUrl = firstLargeImage;
      }
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Could not find product image" },
        { status: 400 }
      );
    }

    if (imageUrl.startsWith("//")) {
      imageUrl = "https:" + imageUrl;
    } else if (imageUrl.startsWith("/")) {
      const urlObj = new URL(url);
      imageUrl = urlObj.origin + imageUrl;
    }

    const publicImageUrl = await assertPublicHttpUrl(imageUrl);

    return NextResponse.json({ imageUrl: publicImageUrl.toString() });
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
