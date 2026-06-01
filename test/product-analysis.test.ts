import { describe, expect, it } from "vitest";
import { classifyImage } from "../lib/product-analysis";

describe("product image classification", () => {
  it("detects on-model and editorial imagery", () => {
    expect(classifyImage("pdp model wearing wool blazer")).toBe("on_model");
    expect(classifyImage("spring lookbook editorial image")).toBe("editorial");
  });

  it("detects flat product and logo imagery", () => {
    expect(classifyImage("flat-lay product-only packshot")).toBe(
      "flat_product"
    );
    expect(classifyImage("brand logo sprite")).toBe("logo");
  });

  it("falls back to unknown when context is weak", () => {
    expect(classifyImage("image 01 gallery")).toBe("unknown");
  });
});
