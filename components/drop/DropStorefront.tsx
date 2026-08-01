"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";
import ProductCard from "@/components/drop/ProductCard";
import type { DropProduct } from "@/lib/drop-products";

type DropStorefrontProps = {
  products: DropProduct[];
};

const categoryOptions = [
  { label: "All", value: "all" },
  { label: "Dresses", value: "dress" },
  { label: "Tops", value: "top" },
  { label: "Skirts", value: "skirt" },
  { label: "Jackets", value: "jacket" },
  { label: "Sets", value: "set" },
] as const;

export default function DropStorefront({ products }: DropStorefrontProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categoryOptions)[number]["value"]>("all");

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory = category === "all" || product.category === category;
      const searchable = [
        product.title,
        product.brand,
        product.color,
        product.category,
        product.fitNote,
        ...product.tags,
      ]
        .join(" ")
        .toLowerCase();

      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [category, products, query]);

  return (
    <main className="min-h-dvh bg-background text-primary">
      <header className="sticky top-0 z-20 border-b border-line bg-panel/95 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-black uppercase tracking-[0.14em]">
            Cloak
          </Link>
          <div className="hidden items-center gap-2 md:flex">
            <a className="btn-outline h-9 px-3 text-xs" href="#gallery">
              Gallery
            </a>
            <a className="btn-outline h-9 px-3 text-xs" href="#how">
              How it works
            </a>
            <Link className="btn-outline h-9 px-3 text-xs" href="/privacy">
              Privacy
            </Link>
          </div>
          <a
            className="inline-flex h-9 items-center justify-center gap-2 border border-primary bg-primary px-3 text-xs font-semibold text-white"
            href="#gallery"
          >
            <ShoppingBag size={15} aria-hidden="true" />
            Checkout
          </a>
        </nav>
      </header>

      <section className="border-b border-line">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 md:grid-cols-[1fr_0.92fr] md:py-8 lg:px-8">
          <div className="flex min-h-[520px] flex-col justify-between border border-line bg-panel p-5 sm:p-7">
            <div className="flex flex-wrap gap-2">
              <span className="border border-line bg-white px-3 py-1 text-xs font-semibold uppercase text-muted">
                Women&apos;s drop 01
              </span>
              <span className="border border-[#781f38] bg-[#781f38] px-3 py-1 text-xs font-semibold uppercase text-white">
                Demo try-on
              </span>
            </div>
            <div className="max-w-2xl">
              <h1 className="font-serif text-5xl leading-[0.95] text-primary sm:text-6xl lg:text-7xl">
                Try the drop before you buy.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
                Upload one photo. Preview the look. Checkout only when it feels right.
              </p>
            </div>
            <div className="grid gap-3 border-t border-line pt-4 text-sm text-muted sm:grid-cols-3">
              <div>
                <p className="font-semibold text-primary">01 Browse</p>
                <p className="mt-1">Filter a small women&apos;s fashion drop.</p>
              </div>
              <div>
                <p className="font-semibold text-primary">02 Preview</p>
                <p className="mt-1">Upload a photo and generate a mock try-on.</p>
              </div>
              <div>
                <p className="font-semibold text-primary">03 Buy</p>
                <p className="mt-1">Leave for Shopify only after the preview.</p>
              </div>
            </div>
          </div>
          <div className="grid min-h-[520px] grid-cols-2 gap-3">
            {products.slice(0, 4).map((product, index) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className={`group relative overflow-hidden border border-line bg-stone-100 ${
                  index === 0 ? "row-span-2" : ""
                }`}
              >
                <img
                  src={product.imageUrl}
                  alt={product.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
                />
                <span className="absolute bottom-3 left-3 bg-panel px-2 py-1 text-[11px] font-semibold uppercase text-primary">
                  {product.color}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="gallery" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-title">Gallery</p>
            <h2 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">
              Save, skip, or try a piece on yourself.
            </h2>
          </div>
          <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[520px]">
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                size={18}
                aria-hidden="true"
              />
              <input
                className="input pl-10"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search color, category, fit, tag"
                type="search"
              />
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categoryOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCategory(item.value)}
                  className={`h-9 shrink-0 border px-3 text-xs font-semibold uppercase transition ${
                    category === item.value
                      ? "border-primary bg-primary text-white"
                      : "border-line bg-panel text-muted hover:border-primary"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="mt-6 border border-line bg-panel p-8 text-center text-sm text-muted">
            No pieces match that filter.
          </div>
        ) : null}
      </section>

      <section id="how" className="border-y border-line bg-[#231f1d] text-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 md:grid-cols-3 lg:px-8">
          <div className="flex gap-3">
            <Sparkles className="mt-1 shrink-0 text-[#e4516f]" size={20} aria-hidden="true" />
            <div>
              <h3 className="font-semibold">Mock first, real later</h3>
              <p className="mt-2 text-sm leading-6 text-white/70">
                This V0 shows the shopping flow without calling a paid AI provider.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <ShieldCheck className="mt-1 shrink-0 text-[#e4516f]" size={20} aria-hidden="true" />
            <div>
              <h3 className="font-semibold">Explicit upload</h3>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Photos are selected by the shopper and used only for the preview request.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <ShoppingBag className="mt-1 shrink-0 text-[#e4516f]" size={20} aria-hidden="true" />
            <div>
              <h3 className="font-semibold">Shopify boundary</h3>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Checkout links leave Cloak. No cart, payment, order, or inventory logic here.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
