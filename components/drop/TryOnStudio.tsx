"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  ImagePlus,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { DropProduct } from "@/lib/drop-products";
import type { TryOnResult } from "@/lib/tryon/provider";

type TryOnStudioProps = {
  product: DropProduct;
};

type MockResult = TryOnResult & {
  disclaimer: string;
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export default function TryOnStudio({ product }: TryOnStudioProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [result, setResult] = useState<MockResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setResult(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Upload a JPG, PNG, WebP, HEIC, or HEIF image.");
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setError("Photo must be 8MB or smaller.");
      return;
    }

    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const generatePreview = async () => {
    if (!photo) {
      setError("Upload one photo before generating a preview.");
      return;
    }

    if (!hasConsent) {
      setError("Confirm the preview consent before submitting your photo.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("productId", product.id);
      formData.append("photo", photo);

      const response = await fetch("/api/drop-tryon", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Preview failed.");
      }

      setResult(payload as MockResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const resetPhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <main className="min-h-dvh bg-background text-primary">
      <header className="border-b border-line bg-panel">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold">
            <ArrowLeft size={17} aria-hidden="true" />
            Gallery
          </Link>
          <p className="text-sm font-black uppercase tracking-[0.14em]">Cloak</p>
          <Link href="/privacy" className="text-sm font-semibold text-muted hover:text-primary">
            Privacy
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(380px,0.58fr)] lg:px-8">
        <div className="grid gap-3 sm:grid-cols-[1fr_0.72fr]">
          <div className="border border-line bg-panel">
            <div className="aspect-[4/5] overflow-hidden bg-stone-100">
              <img
                src={product.imageUrl}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="border border-line bg-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                {product.brand}
              </p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight">{product.title}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="border border-line px-2 py-1 text-xs font-semibold uppercase text-muted">
                  {product.color}
                </span>
                <span className="border border-line px-2 py-1 text-xs font-semibold uppercase text-muted">
                  {product.category}
                </span>
                <span className="text-sm font-semibold">{product.price}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted">{product.fitNote}</p>
            </div>
            <div className="grid flex-1 gap-3 border border-line bg-panel p-3">
              <div className="aspect-[4/5] overflow-hidden bg-stone-100">
                <img
                  src={product.garmentImageUrl}
                  alt={`${product.title} garment view`}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {product.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-[#231f1d] px-2 py-1 text-[11px] font-semibold uppercase text-white"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="border border-line bg-panel p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-title">Try-on studio</p>
              <h2 className="mt-2 text-2xl font-semibold">Model becomes you</h2>
            </div>
            <span className="border border-[#781f38] bg-[#781f38] px-2 py-1 text-[11px] font-semibold uppercase text-white">
              Demo
            </span>
          </div>

          <div className="mt-5 border border-dashed border-line bg-white p-3">
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={handlePhotoChange}
            />
            {photoPreview ? (
              <div className="grid gap-3">
                <div className="aspect-[4/5] overflow-hidden bg-stone-100">
                  <img src={photoPreview} alt="Uploaded try-on photo" className="h-full w-full object-cover" />
                </div>
                <button type="button" className="btn-outline w-full" onClick={resetPhoto}>
                  <RefreshCw size={17} aria-hidden="true" />
                  Try another photo
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 bg-[#f3f0ea] text-center"
              >
                <ImagePlus size={30} aria-hidden="true" />
                <span className="text-sm font-semibold">Upload one photo</span>
                <span className="max-w-[260px] text-xs leading-5 text-muted">
                  JPG, PNG, WebP, HEIC, or HEIF. 8MB max.
                </span>
              </button>
            )}
          </div>

          <label className="mt-4 flex gap-3 border border-line bg-white p-3 text-sm leading-6 text-muted">
            <input
              type="checkbox"
              checked={hasConsent}
              onChange={(event) => setHasConsent(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span>
              Use this photo only to generate this preview. I understand this demo does not
              estimate size, fit, or body measurements.
            </span>
          </label>

          {error ? (
            <p className="mt-3 border border-[#b42318] bg-[#fff7f6] p-3 text-sm font-semibold text-[#8a1f15]">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            className="btn-primary mt-4 w-full"
            disabled={isGenerating}
            onClick={generatePreview}
          >
            {isGenerating ? (
              <Loader2 className="animate-spin" size={18} aria-hidden="true" />
            ) : (
              <Sparkles size={18} aria-hidden="true" />
            )}
            {isGenerating ? "Generating mock preview" : "Generate mock try-on"}
          </button>

          {result ? (
            <section className="mt-5 border-t border-line pt-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck size={17} aria-hidden="true" />
                Mock comparison ready
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <CompareImage label="Original" src={product.imageUrl} alt={product.title} />
                {photoPreview ? (
                  <CompareImage label="Your photo" src={photoPreview} alt="Uploaded try-on photo" />
                ) : null}
                <CompareImage
                  label="Garment"
                  src={product.garmentImageUrl}
                  alt={`${product.title} garment`}
                />
                <CompareImage label="Try-on" src={result.imageUrl} alt="Mock try-on result" />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">{result.disclaimer}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <a
                  href={product.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary w-full"
                >
                  Buy with Shopify
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
                <Link href="/" className="btn-outline w-full">
                  Try another
                </Link>
              </div>
            </section>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

type CompareImageProps = {
  label: string;
  src: string;
  alt: string;
};

function CompareImage({ label, src, alt }: CompareImageProps) {
  return (
    <figure className="border border-line bg-white">
      <div className="aspect-[3/4] overflow-hidden bg-stone-100">
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      </div>
      <figcaption className="border-t border-line px-2 py-1 text-[11px] font-semibold uppercase text-muted">
        {label}
      </figcaption>
    </figure>
  );
}
