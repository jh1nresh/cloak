import { describe, expect, it } from "vitest";
import {
  assertValidVideoBytes,
  assertValidVideoFile,
  InputValidationError,
  MAX_BODY_VIDEO_BYTES,
} from "../lib/security";
import { posterFrameUrl } from "../lib/cloudinary";

function mp4Bytes(brand = "isom") {
  // 4-byte size box, then the `ftyp` marker at offset 4.
  return new Uint8Array([
    0, 0, 0, 24,
    0x66, 0x74, 0x79, 0x70,
    ...Buffer.from(brand, "ascii"),
    0, 0, 0, 0,
    0, 0, 0, 0,
  ]);
}

function videoFile(type: string, size: number) {
  return {
    type,
    size,
  } as File;
}

describe("body video validation", () => {
  it("accepts mp4 and quicktime within the size cap", () => {
    expect(() => assertValidVideoFile(videoFile("video/mp4", 1024))).not.toThrow();
    expect(() =>
      assertValidVideoFile(videoFile("video/quicktime", 1024))
    ).not.toThrow();
  });

  it("rejects non-video and oversized uploads", () => {
    expect(() => assertValidVideoFile(videoFile("image/jpeg", 1024))).toThrow(
      InputValidationError
    );
    expect(() => assertValidVideoFile(videoFile("video/webm", 1024))).toThrow(
      InputValidationError
    );
    expect(() => assertValidVideoFile(videoFile("video/mp4", 0))).toThrow(
      InputValidationError
    );
    expect(() =>
      assertValidVideoFile(videoFile("video/mp4", MAX_BODY_VIDEO_BYTES + 1))
    ).toThrow(InputValidationError);
  });

  it("requires an ftyp box so a renamed file cannot pass as video", () => {
    expect(() => assertValidVideoBytes(mp4Bytes())).not.toThrow();
    expect(() => assertValidVideoBytes(mp4Bytes("qt  "))).not.toThrow();

    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(() => assertValidVideoBytes(jpeg)).toThrow(InputValidationError);
    expect(() => assertValidVideoBytes(new Uint8Array([0, 1, 2]))).toThrow(
      InputValidationError
    );
  });
});

describe("poster frames", () => {
  it("derives a still from a stored video without a second generation", () => {
    expect(posterFrameUrl("https://res.cloudinary.com/x/video/upload/v1/a.mp4"))
      .toBe("https://res.cloudinary.com/x/video/upload/v1/a.jpg");
    expect(posterFrameUrl("https://res.cloudinary.com/x/v1/b.MOV")).toBe(
      "https://res.cloudinary.com/x/v1/b.jpg"
    );
  });

  it("leaves a URL without a known video extension alone", () => {
    expect(posterFrameUrl("https://res.cloudinary.com/x/v1/c")).toBe(
      "https://res.cloudinary.com/x/v1/c"
    );
  });
});
