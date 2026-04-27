/* eslint-disable @next/next/no-img-element */

import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getServiceSupabase } from "@/lib/supabase";
import type { TryOn } from "@/lib/database.types";

interface Props {
  params: Promise<{ id: string }>;
}

async function getTryOn(id: string): Promise<TryOn | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("tryons")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as TryOn;
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
      <main className="min-h-dvh bg-primary text-white">
        <div className="flex min-h-dvh items-center justify-center px-5 text-center">
          <div className="w-full max-w-sm border border-white/15 bg-white/10 p-6 backdrop-blur">
            <p className="text-sm font-semibold">
              Result unavailable
            </p>
            <p className="mt-2 text-sm text-white/65">
              This try-on result is not ready to share.
            </p>
            <Link
              href="/onboarding"
              className="mt-5 flex h-12 w-full items-center justify-center bg-white px-5 text-sm font-semibold text-primary"
            >
              Create Your Own
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-primary text-white">
      <img
        src={tryon.result_url}
        alt="Virtual try-on result"
        className="absolute inset-0 h-full w-full object-contain p-4 pb-28 pt-16"
      />

      <header className="absolute left-0 right-0 top-0 z-10 px-5 py-5">
        <p className="text-xs font-semibold uppercase text-white/55">Cloak</p>
        <p className="mt-1 text-lg font-semibold">Shared try-on</p>
      </header>

      <section className="absolute bottom-0 left-0 right-0 z-10 border-t border-white/10 bg-primary/88 px-5 pb-5 pt-4 backdrop-blur-xl">
        <p className="text-sm font-semibold">Make it yours</p>
        <p className="mt-1 text-sm text-white/65">
          Create your own fit feed from a single photo.
        </p>
        <Link
          href="/onboarding"
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 bg-white px-5 text-sm font-semibold text-primary"
        >
          Try This Look
          <ArrowRight size={18} />
        </Link>
      </section>
    </main>
  );
}
