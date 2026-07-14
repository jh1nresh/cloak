/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { DropProduct } from "@/lib/drop-products";

type ProductCardProps = {
  product: DropProduct;
};

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="group border border-line bg-panel">
      <Link href={`/products/${product.id}`} className="block">
        <div className="aspect-[4/5] overflow-hidden bg-stone-100">
          <img
            src={product.imageUrl}
            alt={product.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
          />
        </div>
      </Link>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              {product.brand}
            </p>
            <Link
              href={`/products/${product.id}`}
              className="mt-1 block text-sm font-semibold text-primary sm:text-base"
            >
              {product.title}
            </Link>
          </div>
          <p className="shrink-0 text-sm font-semibold text-primary">{product.price}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="border border-line px-2 py-1 text-[11px] font-semibold uppercase text-muted">
            {product.color}
          </span>
          <Link
            href={`/products/${product.id}`}
            className="inline-flex h-9 items-center justify-center gap-2 bg-primary px-3 text-xs font-semibold text-white transition hover:bg-black"
          >
            <Sparkles size={15} aria-hidden="true" />
            Try it on
          </Link>
        </div>
      </div>
    </article>
  );
}
