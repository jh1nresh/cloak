import { getDropProduct } from "@/lib/drop-products";
import type { TryOnResult } from "@/lib/tryon/provider";

export type MockTryOnResult = TryOnResult & {
  disclaimer: string;
};

export async function createMockTryOn(productId: string): Promise<MockTryOnResult | null> {
  const startedAt = Date.now();
  const product = getDropProduct(productId);

  if (!product) return null;

  return {
    provider: "mock",
    imageUrl: product.mockResultImageUrl,
    latencyMs: Date.now() - startedAt,
    disclaimer:
      "Demo preview only. This mock does not estimate size, garment physics, or body measurements.",
  };
}
