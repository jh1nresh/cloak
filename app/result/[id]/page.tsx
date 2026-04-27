"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Download, RotateCcw, Share2, Sparkles } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";

interface TryOnResult {
  id: string;
  result_url: string | null;
  status: "queued" | "processing" | "finalizing" | "completed" | "failed";
  error_message: string | null;
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
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const fetchResult = async () => {
      try {
        const res = await fetch(`/api/tryon/${id}`);
        if (!res.ok) {
          throw new Error("Failed to load result");
        }

        const data = await res.json();
        if (cancelled) return;
        setResult(data);

        if (data.status === "failed") {
          setError(data.error_message || "Try-on failed. Please try again.");
          return;
        }

        if (data.status !== "completed") {
          timeoutId = setTimeout(fetchResult, 2500);
        }
      } catch (err) {
        console.error("Fetch error:", err);
        if (!cancelled) setError("Could not load your try-on result.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchResult();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
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
      if (navigator.share) {
        await navigator.share({ title: "Cloak try-on", url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Share error:", err);
      }
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-primary">
        <LoadingSpinner size="lg" />
      </main>
    );
  }

  if (error || !result) {
    return (
      <main className="min-h-dvh bg-primary text-white">
        <div className="flex min-h-dvh items-center justify-center px-5 text-center">
          <div className="w-full max-w-sm border border-white/15 bg-white/10 p-6 backdrop-blur">
            <p className="text-sm font-semibold">
              Result unavailable
            </p>
            <p className="mt-2 text-sm text-white/65">
              {error || "This try-on result was not found."}
            </p>
            <button
              onClick={() => router.push("/tryon")}
              className="mt-5 flex h-12 w-full items-center justify-center bg-white px-5 text-sm font-semibold text-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (result.status !== "completed" || !result.result_url) {
    return (
      <main className="min-h-dvh bg-primary text-white">
        <div className="flex min-h-dvh items-center justify-center px-5 text-center">
          <div className="w-full max-w-sm border border-white/15 bg-white/10 p-6 backdrop-blur">
            <div className="mx-auto flex h-14 w-14 items-center justify-center border border-white/20 bg-white/10">
              <Sparkles size={22} className="text-accent" />
            </div>
            <div className="mt-6 flex justify-center">
              <LoadingSpinner size="md" />
            </div>
            <p className="mt-5 text-sm font-semibold">
              Creating your look
            </p>
            <p className="mt-2 text-sm leading-5 text-white/65">
              Stay here while the next look lands.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-primary text-white">
      <img
        src={result.result_url}
        alt="Your try-on result"
        className="absolute inset-0 h-full w-full object-contain p-4 pb-28 pt-16"
      />

      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-5 py-5">
        <div>
          <p className="text-xs font-semibold uppercase text-white/55">Cloak</p>
          <p className="mt-1 text-lg font-semibold">Try-on result</p>
        </div>
        <button
          onClick={() => router.push("/tryon")}
          className="flex h-11 w-11 items-center justify-center border border-white/20 bg-black/30 backdrop-blur"
          aria-label="Try another"
        >
          <RotateCcw size={18} />
        </button>
      </header>

      <aside className="absolute right-4 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-4">
        <button
          onClick={handleSave}
          className="flex h-12 w-12 items-center justify-center border border-white/20 bg-black/30 backdrop-blur"
          aria-label="Save photo"
        >
            <Download size={18} />
        </button>
        <button
          onClick={handleShare}
          className="flex h-12 w-12 items-center justify-center border border-white/20 bg-black/30 backdrop-blur"
          aria-label="Share"
        >
            <Share2 size={18} />
        </button>
      </aside>

      <section className="absolute bottom-0 left-0 right-0 z-10 border-t border-white/10 bg-primary/88 px-5 pb-5 pt-4 backdrop-blur-xl">
        <p className="text-sm font-semibold">Your look is ready</p>
        <p className="mt-1 text-sm text-white/65">
          Save it, share it, or keep swiping into another piece.
        </p>
        <button
          onClick={() => router.push("/tryon")}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 bg-white px-5 text-sm font-semibold text-primary"
        >
          <RotateCcw size={18} />
          Try Another
        </button>
      </section>

      {showToast && (
        <div className="fixed bottom-32 left-1/2 z-20 -translate-x-1/2 border border-white/15 bg-white px-4 py-2 text-sm font-semibold text-primary shadow-lg">
          Link copied
        </div>
      )}
    </main>
  );
}
