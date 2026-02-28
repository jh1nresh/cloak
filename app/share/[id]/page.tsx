import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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

  if (!tryon) {
    return {
      title: "Try-on not found | Cloak",
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cloak.app";

  return {
    title: "Check out my virtual try-on! | Cloak",
    description: "See how this looks on me with Cloak virtual try-on. Try it yourself!",
    openGraph: {
      title: "Check out my virtual try-on!",
      description: "See how this looks on me with Cloak virtual try-on. Try it yourself!",
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
      title: "Check out my virtual try-on!",
      description: "See how this looks on me with Cloak virtual try-on. Try it yourself!",
      images: [tryon.result_url],
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { id } = await params;
  const tryon = await getTryOn(id);

  if (!tryon) {
    return (
      <main className="min-h-dvh bg-background px-6 py-8 flex flex-col items-center justify-center">
        <h1 className="text-xl font-bold text-primary mb-2">Not Found</h1>
        <p className="text-gray-500 mb-6">This try-on result doesn&apos;t exist.</p>
        <Link href="/onboarding" className="btn-primary">
          Create Your Own
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background flex flex-col">
      <div className="flex-1 relative">
        <Image
          src={tryon.result_url}
          alt="Virtual try-on result"
          fill
          className="object-contain bg-gray-100"
          priority
        />
      </div>

      <div className="p-6 bg-white border-t space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-primary mb-1">
            Like this look?
          </h1>
          <p className="text-gray-500 text-sm">
            Try it on yourself with Cloak
          </p>
        </div>

        <Link href="/onboarding" className="btn-primary w-full block text-center">
          Try this on yourself
        </Link>
      </div>
    </main>
  );
}
