"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LoadingSpinner from "@/components/LoadingSpinner";

type InputMode = "url" | "upload";

export default function TryOnPage() {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [productUrl, setProductUrl] = useState("");
  const [garmentImageUrl, setGarmentImageUrl] = useState<string | null>(null);
  const [garmentImageBase64, setGarmentImageBase64] = useState<string | null>(null);
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    const storedAvatarUrl = localStorage.getItem("avatarUrl");

    if (!storedUserId || !storedAvatarUrl) {
      router.push("/onboarding");
      return;
    }

    setUserId(storedUserId);
    setAvatarUrl(storedAvatarUrl);
  }, [router]);

  const handleScrapeUrl = async () => {
    if (!productUrl.trim()) return;

    setIsScrapingUrl(true);
    setError(null);
    setGarmentImageUrl(null);
    setGarmentImageBase64(null);

    try {
      const res = await fetch("/api/scrape-garment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: productUrl }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch product image");
      }

      const data = await res.json();
      setGarmentImageUrl(data.imageUrl);
    } catch (err) {
      console.error("Scrape error:", err);
      setError("Could not fetch product image. Try uploading instead.");
    } finally {
      setIsScrapingUrl(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(null);
      setGarmentImageUrl(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setGarmentImageBase64(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTryOn = async () => {
    if (!avatarUrl || (!garmentImageUrl && !garmentImageBase64)) return;

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          avatarUrl,
          garmentImageUrl,
          garmentImageBase64,
        }),
      });

      if (!res.ok) {
        throw new Error("Try-on failed");
      }

      const data = await res.json();
      router.push(`/result/${data.tryonId}`);
    } catch (err) {
      console.error("Try-on error:", err);
      setError("Try-on failed. Please try again.");
      setIsProcessing(false);
    }
  };

  const hasGarmentImage = garmentImageUrl || garmentImageBase64;
  const garmentPreviewSrc = garmentImageBase64 || garmentImageUrl;

  if (!avatarUrl) {
    return (
      <main className="min-h-dvh bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </main>
    );
  }

  if (isProcessing) {
    return (
      <main className="min-h-dvh bg-background px-6 py-8 flex flex-col items-center justify-center">
        <LoadingSpinner size="lg" />
        <p className="mt-6 text-gray-500 text-center">
          Creating your try-on image...
        </p>
        <p className="mt-2 text-gray-400 text-sm text-center">
          This may take 20-30 seconds
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background px-6 py-8 flex flex-col">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-primary">Try On</h1>
          <button
            onClick={() => router.push("/onboarding")}
            className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-accent hover:border-primary transition-colors"
          >
            <Image src={avatarUrl} alt="Your avatar" fill className="object-cover" />
          </button>
        </div>

        <div className="card mb-6">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                setInputMode("url");
                setGarmentImageBase64(null);
              }}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                inputMode === "url"
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              Paste URL
            </button>
            <button
              onClick={() => {
                setInputMode("upload");
                setGarmentImageUrl(null);
              }}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
                inputMode === "upload"
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              Upload
            </button>
          </div>

          {inputMode === "url" && (
            <div className="space-y-3">
              <input
                type="url"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="Paste product page URL..."
                className="input"
              />
              <button
                onClick={handleScrapeUrl}
                disabled={!productUrl.trim() || isScrapingUrl}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                {isScrapingUrl ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Fetching...</span>
                  </>
                ) : (
                  "Fetch Product Image"
                )}
              </button>
            </div>
          )}

          {inputMode === "upload" && (
            <div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center hover:border-accent transition-colors"
              >
                <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-gray-500 text-sm">Upload photo or screenshot</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}
        </div>

        {hasGarmentImage && garmentPreviewSrc && (
          <div className="card mb-6">
            <p className="text-sm text-gray-500 mb-3">Garment Preview</p>
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100">
              <Image
                src={garmentPreviewSrc}
                alt="Garment"
                fill
                className="object-contain"
              />
            </div>
            <button
              onClick={() => {
                setGarmentImageUrl(null);
                setGarmentImageBase64(null);
                setProductUrl("");
              }}
              className="mt-3 text-sm text-gray-500 underline"
            >
              Remove
            </button>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
        )}

        <div className="mt-auto">
          <button
            onClick={handleTryOn}
            disabled={!hasGarmentImage}
            className="btn-primary w-full"
          >
            Try It On
          </button>
        </div>
      </div>
    </main>
  );
}
