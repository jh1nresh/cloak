/* eslint-disable @next/next/no-img-element */

import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTryOnById, type TryOn } from "@/lib/db";

interface Props {
  params: Promise<{ id: string }>;
}

async function getTryOn(id: string): Promise<TryOn | null> {
  try {
    return await getTryOnById(id);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const tryon = await getTryOn(id);

  if (!tryon || tryon.status !== "completed" || !tryon.result_url) {
    return {
      title: "Try-on not found | Cloak",
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cloak.app";

  return {
    title: "Cloak try-on",
    description: "A virtual try-on created with Cloak.",
    openGraph: {
      title: "Cloak try-on",
      description: "A virtual try-on created with Cloak.",
      images: [
        {
          url: tryon.result_url,
          width: 1200,
          height: 630,
          alt: "Virtual try-on result",
        },
      ],
      type: "website",
      url: `${appUrl}/share/${id}`,
    },
    twitter: {
      card: "summary_large_image",
      title: "Cloak try-on",
      description: "A virtual try-on created with Cloak.",
      images: [tryon.result_url],
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { id } = await params;
  const tryon = await getTryOn(id);

  if (!tryon || tryon.status !== "completed" || !tryon.result_url) {
    return (
      <main className="min-h-dvh bg-[#151210] text-white">
        <div className="flex min-h-dvh items-center justify-center px-5 text-center">
          <div className="w-full max-w-sm border border-white/12 bg-white/[0.06] p-6 shadow-[0_26px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
            <p className="text-sm font-semibold">
              Result unavailable
            </p>
            <p className="mt-2 text-sm text-white/65">
              This try-on result is not ready to share.
            </p>
            <Link
              href="/onboarding"
              className="mt-5 flex h-12 w-full items-center justify-center bg-white px-5 text-sm font-semibold text-[#171412]"
            >
              Create Your Own
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#151210] text-white">
      <img
        src={tryon.result_url}
        alt="Virtual try-on result"
        className="absolute inset-0 h-full w-full object-contain p-4 pb-28 pt-16"
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(21,18,16,0.72)_0%,transparent_28%,transparent_60%,rgba(21,18,16,0.92)_100%)]" />

      <header className="absolute left-0 right-0 top-0 z-10 px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">Cloak</p>
        <p className="mt-1 text-lg font-semibold">Shared try-on</p>
      </header>

      <section className="absolute bottom-0 left-0 right-0 z-10 border-t border-white/10 bg-[#151210]/90 px-5 pb-5 pt-4 shadow-[0_-24px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl">
        <p className="text-sm font-semibold">Make it yours</p>
        <p className="mt-1 text-sm text-white/65">
          Create your own fit feed from a single photo.
        </p>
        <Link
          href="/onboarding"
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 bg-white px-5 text-sm font-semibold text-[#171412]"
        >
          Try This Look
          <ArrowRight size={18} />
        </Link>
      </section>
    </main>
  );
}
