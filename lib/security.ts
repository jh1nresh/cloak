import dns from "node:dns/promises";
import net from "node:net";
import type { NextRequest } from "next/server";

type RateLimitOptions = {
  keyPrefix: string;
  maxRequests: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

export const MAX_AVATAR_BYTES = 8 * 1024 * 1024;
export const MAX_GARMENT_DATA_URL_BYTES = 10 * 1024 * 1024;
export const MAX_SCRAPE_HTML_BYTES = 2 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export class InputValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "InputValidationError";
    this.status = status;
  }
}

export function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export function checkRateLimit(key: string, options: RateLimitOptions) {
  const now = Date.now();
  const bucketKey = `${options.keyPrefix}:${key}`;
  const existing = rateLimitBuckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(bucketKey, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return { ok: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= options.maxRequests) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

export function assertAllowedContentLength(
  request: NextRequest,
  maxBytes: number
) {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return;

  const bytes = Number(contentLength);
  if (!Number.isFinite(bytes) || bytes > maxBytes) {
    throw new InputValidationError(`Request body exceeds ${maxBytes} bytes`, 413);
  }
}

export function assertValidImageFile(file: File, maxBytes = MAX_AVATAR_BYTES) {
  if (!file.size || file.size > maxBytes) {
    throw new InputValidationError(`Image must be smaller than ${maxBytes} bytes`, 413);
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new InputValidationError("Unsupported image type");
  }
}

export function assertValidImageBytes(bytes: Uint8Array, contentType: string) {
  const valid =
    (contentType === "image/jpeg" && isJpeg(bytes)) ||
    (contentType === "image/png" && isPng(bytes)) ||
    (contentType === "image/webp" && isWebp(bytes)) ||
    ((contentType === "image/heic" || contentType === "image/heif") &&
      isHeif(bytes));

  if (!valid) {
    throw new InputValidationError("Image contents do not match the declared type");
  }
}

export function assertValidImageDataUrl(
  dataUrl: string,
  maxBytes = MAX_GARMENT_DATA_URL_BYTES
) {
  const match = dataUrl.match(/^data:([^;,]+);base64,([a-zA-Z0-9+/=\s]+)$/);
  if (!match) {
    throw new InputValidationError("Invalid image data URL");
  }

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new InputValidationError("Unsupported image type");
  }

  const base64 = match[2].replace(/\s/g, "");
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > maxBytes) {
    throw new InputValidationError(`Image must be smaller than ${maxBytes} bytes`, 413);
  }

  assertValidImageBytes(Buffer.from(base64, "base64"), mimeType);
}

export async function assertPublicHttpUrl(input: string) {
  if (input.length > 2048) {
    throw new InputValidationError("URL is too long");
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new InputValidationError("Invalid URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new InputValidationError("Only http and https URLs are allowed");
  }

  if (url.username || url.password) {
    throw new InputValidationError("URLs with credentials are not allowed");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new InputValidationError("Local URLs are not allowed");
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = net.isIP(hostname)
      ? [{ address: hostname }]
      : await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new InputValidationError("URL host could not be resolved");
  }

  if (!addresses.length) {
    throw new InputValidationError("URL host could not be resolved");
  }

  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      throw new InputValidationError("URL resolves to a private or reserved address");
    }
  }

  return url;
}

export async function fetchPublicUrl(
  input: string,
  init: RequestInit = {},
  maxRedirects = 3
) {
  let url = await assertPublicHttpUrl(input);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        ...init,
        redirect: "manual",
        signal: controller.signal,
      });

      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.has("location")
      ) {
        if (redirectCount === maxRedirects) {
          throw new InputValidationError("Too many redirects");
        }

        url = await assertPublicHttpUrl(
          new URL(response.headers.get("location") || "", url).toString()
        );
        continue;
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new InputValidationError("Too many redirects");
}

export async function readTextWithLimit(response: Response, maxBytes: number) {
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).length > maxBytes) {
      throw new InputValidationError("Response body is too large", 413);
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      reader.cancel().catch(() => undefined);
      throw new InputValidationError("Response body is too large", 413);
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

function isBlockedAddress(address: string) {
  const version = net.isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version === 6) return isBlockedIpv6(address);
  return true;
}

function isBlockedIpv4(address: string) {
  const octets = address.split(".").map(Number);
  const [a, b, c] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isBlockedIpv6(address: string) {
  const normalized = address.toLowerCase();

  if (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }

  if (normalized.startsWith("::ffff:")) {
    return isBlockedIpv4(normalized.replace("::ffff:", ""));
  }

  return false;
}

function isJpeg(bytes: Uint8Array) {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array) {
  return (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function isWebp(bytes: Uint8Array) {
  return (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

function isHeif(bytes: Uint8Array) {
  const box = String.fromCharCode(...bytes.slice(4, 8));
  const brand = String.fromCharCode(...bytes.slice(8, 12));
  return (
    box === "ftyp" &&
    ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)
  );
}
