import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-background text-primary">
      <header className="border-b border-line bg-panel">
        <nav className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold">
            <ArrowLeft size={17} aria-hidden="true" />
            Gallery
          </Link>
          <p className="text-sm font-black uppercase tracking-[0.14em]">Cloak</p>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="border border-line bg-panel p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <ShieldCheck size={24} aria-hidden="true" />
            <p className="section-title">Privacy and consent</p>
          </div>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            Uploads are explicit and preview-scoped in this V0.
          </h1>
          <div className="mt-6 grid gap-4 text-sm leading-7 text-muted">
            <p>
              Cloak&apos;s drop storefront uses uploaded photos only when the shopper
              selects a file and presses generate. This V0 calls a mock preview provider,
              so no paid AI provider receives the image from this storefront flow.
            </p>
            <p>
              There is no account, cart, payment, or order persistence in the storefront.
              Product checkout links leave Cloak and open a Shopify placeholder URL.
            </p>
            <p>
              The generated preview is a demo comparison. It does not guarantee size,
              body measurements, garment physics, or real-world fit.
            </p>
          </div>
          <Link href="/" className="btn-primary mt-7">
            Back to drop
          </Link>
        </div>
      </section>
    </main>
  );
}
