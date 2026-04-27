import { describe, expect, it } from "vitest";
import {
  assertPublicHttpUrl,
  assertValidImageBytes,
  assertValidImageDataUrl,
  InputValidationError,
} from "../lib/security";

describe("security helpers", () => {
  it("rejects local and private URLs", async () => {
    await expect(assertPublicHttpUrl("http://localhost:3000")).rejects.toThrow(
      InputValidationError
    );
    await expect(assertPublicHttpUrl("http://127.0.0.1")).rejects.toThrow(
      InputValidationError
    );
    await expect(assertPublicHttpUrl("http://10.0.0.1")).rejects.toThrow(
      InputValidationError
    );
    await expect(assertPublicHttpUrl("http://169.254.169.254")).rejects.toThrow(
      InputValidationError
    );
  });

  it("rejects unsupported URL protocols and credentials", async () => {
    await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toThrow(
      InputValidationError
    );
    await expect(
      assertPublicHttpUrl("https://user:pass@example.com")
    ).rejects.toThrow(InputValidationError);
  });

  it("allows public http URLs without fetching them", async () => {
    await expect(assertPublicHttpUrl("https://93.184.216.34/image.jpg")).resolves
      .toBeInstanceOf(URL);
  });

  it("validates image data URL content against declared type", () => {
    const pngDataUrl = "data:image/png;base64,iVBORw0KGgo=";

    expect(() => assertValidImageDataUrl(pngDataUrl)).not.toThrow();
    expect(() =>
      assertValidImageDataUrl("data:image/jpeg;base64,iVBORw0KGgo=")
    ).toThrow(InputValidationError);
  });

  it("validates raw image bytes against declared type", () => {
    const jpegBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);

    expect(() => assertValidImageBytes(jpegBytes, "image/jpeg")).not.toThrow();
    expect(() => assertValidImageBytes(pngBytes, "image/jpeg")).toThrow(
      InputValidationError
    );
  });
});
