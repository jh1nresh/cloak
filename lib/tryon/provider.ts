export type TryOnRequest = {
  userImage: File | Blob;
  productId: string;
  garmentImageUrl: string;
};

export type TryOnResult = {
  imageUrl: string;
  provider: "mock" | "fal" | "replicate" | "custom";
  latencyMs: number;
};
