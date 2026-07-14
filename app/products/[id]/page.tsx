import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TryOnStudio from "@/components/drop/TryOnStudio";
import { dropProducts, getDropProduct } from "@/lib/drop-products";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return dropProducts.map((product) => ({ id: product.id }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = getDropProduct(id);

  if (!product) return {};

  return {
    title: `${product.title} - Cloak`,
    description: `${product.brand} ${product.title}. Upload one photo and preview the look before checkout.`,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = getDropProduct(id);

  if (!product) notFound();

  return <TryOnStudio product={product} />;
}
