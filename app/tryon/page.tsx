"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  ExternalLink,
  ImagePlus,
  Link2,
  Loader2,
  Play,
  RefreshCw,
  Shirt,
  UserRound,
  X,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";

type InputMode = "url" | "upload";

type FeedGarment = {
  id: string | null;
  image_url: string;
  title: string | null;
  brand: string | null;
  price: string | null;
  source_url: string | null;
  domain: string | null;
  isLocal?: boolean;
};

export default function TryOnPage() {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [garments, setGarments] = useState<FeedGarment[]>([]);
  const [localGarment, setLocalGarment] = useState<FeedGarment | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [productUrl, setProductUrl] = useState("");
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const feedItems = useMemo(
    () => (localGarment ? [localGarment, ...garments] : garments),
    [localGarment, garments]
  );
  const activeGarment = feedItems[activeIndex] || feedItems[0] || null;

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

  useEffect(() => {
    let cancelled = false;

    const loadGarments = async () => {
      try {
        const res = await fetch("/api/garments?limit=30");
        if (!res.ok) throw new Error("Failed to load garments");
        const data = await res.json();
        if (!cancelled) setGarments(data.garments || []);
      } catch (err) {
        console.error("Garments feed error:", err);
      } finally {
        if (!cancelled) setIsLoadingFeed(false);
      }
    };

    loadGarments();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sharedUrl = new URLSearchParams(window.location.search).get("url");
    if (!sharedUrl) return;

    setProductUrl(sharedUrl);
    setInputMode("url");
    scrapeUrl(sharedUrl);
    window.history.replaceState(null, "", "/tryon");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToTop = () => {
    setActiveIndex(0);
    requestAnimationFrame(() => {
      feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const scrapeUrl = async (urlToScrape = productUrl) => {
    if (!urlToScrape.trim()) return;

    setIsScrapingUrl(true);
    setError(null);
    setLocalGarment(null);

    try {
      const res = await fetch("/api/scrape-garment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlToScrape }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch product image");
      }

      const data = await res.json();
      const garment = data.garment as FeedGarment;
      setGarments((current) => [
        garment,
        ...current.filter((item) => item.id !== garment.id),
      ]);
      scrollToTop();
    } catch (err) {
      console.error("Scrape error:", err);
      setError("Could not import that item. Upload a screenshot instead.");
    } finally {
      setIsScrapingUrl(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setInputMode("upload");

    const reader = new FileReader();
    reader.onload = (event) => {
      setLocalGarment({
        id: null,
        image_url: event.target?.result as string,
        title: file.name.replace(/\.[^.]+$/, ""),
        brand: "Uploaded",
        price: null,
        source_url: null,
        domain: null,
        isLocal: true,
      });
      scrollToTop();
    };
    reader.readAsDataURL(file);
  };

  const handleTryOn = async () => {
    if (!avatarUrl || !activeGarment) return;

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          avatarUrl,
          garmentId: activeGarment.id,
          garmentImageUrl: activeGarment.isLocal ? null : activeGarment.image_url,
          garmentImageBase64: activeGarment.isLocal ? activeGarment.image_url : null,
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

  const handleFeedScroll = () => {
    const element = feedRef.current;
    if (!element) return;

    const nextIndex = Math.round(element.scrollTop / element.clientHeight);
    setActiveIndex(Math.min(Math.max(nextIndex, 0), Math.max(feedItems.length - 1, 0)));
  };

  if (!avatarUrl) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-primary">
        <LoadingSpinner size="lg" />
      </main>
    );
  }

  if (isProcessing) {
    return (
      <main className="min-h-dvh bg-primary text-white">
        <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-5 text-sm font-semibold">Starting try-on</p>
          <p className="mt-1 max-w-60 text-sm text-white/65">
            Opening your result as soon as the job is ready.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-primary text-white">
      <section
        ref={feedRef}
        onScroll={handleFeedScroll}
        className="h-dvh snap-y snap-mandatory overflow-y-auto overscroll-contain"
      >
        {isLoadingFeed && !feedItems.length ? (
          <FeedPlaceholder loading />
        ) : feedItems.length ? (
          feedItems.map((garment) => (
            <article
              key={garment.id || garment.image_url}
              className="relative flex h-dvh snap-start items-center justify-center"
            >
              <img
                src={garment.image_url}
                alt={garment.title || "Garment"}
                className="h-full w-full object-contain p-8 pb-56 pt-24"
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(23,20,18,0.72)_0%,transparent_24%,transparent_55%,rgba(23,20,18,0.9)_100%)]" />
            </article>
          ))
        ) : (
          <FeedPlaceholder />
        )}
      </section>

      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-5 py-5">
        <div>
          <p className="text-xs font-semibold uppercase text-white/55">Cloak</p>
          <p className="mt-1 text-lg font-semibold">Fit feed</p>
        </div>
        <button
          onClick={() => router.push("/onboarding")}
          className="relative h-12 w-12 overflow-hidden border border-white/25 bg-white/10"
          aria-label="Change profile"
        >
          <img
            src={avatarUrl}
            alt="Your fit photo"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </button>
      </header>

      <aside className="absolute right-4 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-4">
        <button
          onClick={() => router.push("/onboarding")}
          className="flex h-12 w-12 items-center justify-center border border-white/20 bg-black/30 backdrop-blur"
          aria-label="Fit photo"
        >
          <UserRound size={20} />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex h-12 w-12 items-center justify-center border border-white/20 bg-black/30 backdrop-blur"
          aria-label="Upload garment"
        >
          <ImagePlus size={20} />
        </button>
        {activeGarment?.source_url && (
          <a
            href={activeGarment.source_url}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 w-12 items-center justify-center border border-white/20 bg-black/30 backdrop-blur"
            aria-label="Open product"
          >
            <ExternalLink size={20} />
          </a>
        )}
        {localGarment && (
          <button
            onClick={() => {
              setLocalGarment(null);
              setActiveIndex(0);
            }}
            className="flex h-12 w-12 items-center justify-center border border-white/20 bg-black/30 backdrop-blur"
            aria-label="Clear upload"
          >
            <X size={20} />
          </button>
        )}
      </aside>

      <section className="absolute bottom-0 left-0 right-0 z-10 border-t border-white/10 bg-primary/88 px-5 pb-5 pt-4 backdrop-blur-xl">
        <div className="mb-3">
          <p className="max-w-[calc(100%-4rem)] truncate text-sm font-semibold">
            {activeGarment?.title || "Add an item to the feed"}
          </p>
          <p className="mt-1 text-xs text-white/55">
            {[activeGarment?.brand, activeGarment?.price || activeGarment?.domain]
              .filter(Boolean)
              .join(" / ") || "Paste a product URL or upload a screenshot"}
          </p>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setInputMode("url")}
            className={`flex h-10 flex-1 items-center justify-center gap-2 border text-sm font-semibold ${
              inputMode === "url"
                ? "border-white bg-white text-primary"
                : "border-white/15 bg-white/5 text-white/75"
            }`}
          >
            <Link2 size={16} />
            URL
          </button>
          <button
            onClick={() => {
              setInputMode("upload");
              fileInputRef.current?.click();
            }}
            className={`flex h-10 flex-1 items-center justify-center gap-2 border text-sm font-semibold ${
              inputMode === "upload"
                ? "border-white bg-white text-primary"
                : "border-white/15 bg-white/5 text-white/75"
            }`}
          >
            <ImagePlus size={16} />
            Upload
          </button>
        </div>

        {inputMode === "url" && (
          <div className="mb-3 flex gap-2">
            <input
              type="url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="Paste product URL"
              className="h-12 min-w-0 flex-1 border border-white/15 bg-white px-4 text-sm text-primary outline-none placeholder:text-stone-400"
            />
            <button
              onClick={() => scrapeUrl()}
              disabled={!productUrl.trim() || isScrapingUrl}
              className="flex h-12 w-12 shrink-0 items-center justify-center bg-white text-primary disabled:opacity-40"
              aria-label="Import product"
            >
              {isScrapingUrl ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ArrowUp size={18} />
              )}
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {error && (
          <p className="mb-3 border border-red-300/40 bg-red-950/45 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        )}

        <button
          onClick={handleTryOn}
          disabled={!activeGarment}
          className="flex h-12 w-full items-center justify-center gap-2 bg-white px-5 text-sm font-semibold text-primary transition disabled:opacity-40"
        >
          {activeGarment ? <Play size={18} /> : <RefreshCw size={17} />}
          {activeGarment ? "Try This On" : "Add a Garment"}
        </button>
      </section>
    </main>
  );
}

function FeedPlaceholder({ loading = false }: { loading?: boolean }) {
  return (
    <article className="relative flex h-dvh snap-start flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_35%,#443833,#171412_62%)] px-8 pb-48 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center border border-white/20 bg-white/10">
        {loading ? <LoadingSpinner size="md" /> : <Shirt size={32} />}
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">
        {loading ? "Loading fit feed" : "Swipe into your next look"}
      </h1>
      <p className="mt-3 max-w-72 text-sm leading-6 text-white/65">
        {loading
          ? "Pulling saved garments into Cloak."
          : "Paste a product URL or upload a garment to start the feed."}
      </p>
    </article>
  );
}
