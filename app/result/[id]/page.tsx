"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LoadingSpinner from "@/components/LoadingSpinner";

interface TryOnResult {
  id: string;
  result_url: string;
  created_at: string;
}

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res = await fetch(`/api/tryon/${id}`);
        if (!res.ok) {
          throw new Error("Failed to load result");
        }
        const data = await res.json();
        setResult(data);
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Could not load your try-on result.");
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [id]);

  const handleSave = async () => {
    if (!result?.result_url) return;

    try {
      const response = await fetch(result.result_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cloak-tryon-${id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/share/${id}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch (err) {
      console.error("Copy error:", err);
    }
  };

  if (loading) {
    return (
      <main className="min-h-dvh bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </main>
    );
  }

  if (error || !result) {
    return (
      <main className="min-h-dvh bg-background px-6 py-8 flex flex-col items-center justify-center">
        <p className="text-gray-500 mb-4">{error || "Result not found"}</p>
        <button onClick={() => router.push("/tryon")} className="btn-primary">
          Try Again
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background flex flex-col">
      <div className="flex-1 relative">
        <Image
          src={result.result_url}
          alt="Your try-on result"
          fill
          className="object-contain bg-gray-100"
          priority
        />
      </div>

      <div className="p-6 bg-white border-t space-y-3">
        <button onClick={handleSave} className="btn-primary w-full flex items-center justify-center gap-2">
          <span>Save Photo</span>
        </button>

        <button onClick={handleShare} className="btn-secondary w-full flex items-center justify-center gap-2">
          <span>Share</span>
        </button>

        <button
          onClick={() => router.push("/tryon")}
          className="btn-outline w-full"
        >
          Try Another
        </button>
      </div>

      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-primary text-white px-4 py-2 rounded-full text-sm shadow-lg">
          Link copied to clipboard!
        </div>
      )}
    </main>
  );
}
