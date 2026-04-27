"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, RotateCcw, Ruler, Upload, Weight } from "lucide-react";
import CameraCapture from "@/components/CameraCapture";
import LoadingSpinner from "@/components/LoadingSpinner";

type Step = "photo" | "details" | "creating";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("photo");
  const [showCamera, setShowCamera] = useState(false);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoCapture = (imageData: string) => {
    setPhotoData(imageData);
    setShowCamera(false);
    setStep("details");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoData(event.target?.result as string);
      setStep("details");
    };
    reader.readAsDataURL(file);
  };

  const handleCreateAvatar = async () => {
    if (!photoData) return;

    setStep("creating");
    setError(null);

    try {
      const formData = new FormData();
      const blob = await (await fetch(photoData)).blob();
      formData.append("photo", blob, "avatar.jpg");
      if (height) formData.append("height", height);
      if (weight) formData.append("weight", weight);

      const res = await fetch("/api/avatar", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create avatar");
      }

      const data = await res.json();
      localStorage.setItem("userId", data.userId);
      localStorage.setItem("avatarUrl", data.avatarUrl);
      router.push("/tryon");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed. Please try again.");
      setStep("details");
    }
  };

  if (showCamera) {
    return (
      <CameraCapture
        onCapture={handlePhotoCapture}
        onCancel={() => setShowCamera(false)}
      />
    );
  }

  return (
    <main className="min-h-dvh overflow-hidden bg-[#161310] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(184,117,107,0.28),transparent_34%),linear-gradient(180deg,#211c18_0%,#151210_58%,#0d0b0a_100%)]" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-5 pt-6">
        <header className="mb-7 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
              Cloak
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Fit profile
            </h1>
          </div>
          <div className="flex h-12 w-12 items-center justify-center border border-white/15 bg-white/[0.08] text-sm font-semibold backdrop-blur">
            CL
          </div>
        </header>

        {step === "photo" && (
          <section className="flex flex-1 flex-col">
            <div className="mb-5 overflow-hidden border border-white/12 bg-white/[0.06] p-3 shadow-[0_26px_80px_rgba(0,0,0,0.36)] backdrop-blur-xl">
              <div className="relative aspect-[4/5] overflow-hidden border border-white/10 bg-[linear-gradient(155deg,#f6eee5_0%,#c8b6a9_44%,#3f332d_100%)]">
                <div className="absolute inset-x-6 top-6 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">
                  <span>Fit frame</span>
                  <span>01</span>
                </div>
                <div className="absolute inset-x-12 bottom-9 top-24 rounded-t-full border border-black/15 bg-black/10" />
                <div className="absolute left-1/2 top-20 h-16 w-16 -translate-x-1/2 rounded-full border border-black/15 bg-[#eadfd6]" />
                <div className="absolute bottom-8 left-1/2 h-40 w-28 -translate-x-1/2 rounded-t-[48px] border border-black/15 bg-[#1d1815]" />
                <div className="absolute inset-x-5 bottom-5 flex justify-between">
                  <div className="h-16 w-14 border border-black/10 bg-white/35" />
                  <div className="h-16 w-14 border border-black/10 bg-white/35" />
                </div>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-3 gap-2">
              {["Front", "Bright", "Full body"].map((label) => (
                <div
                  key={label}
                  className="border border-white/10 bg-white/[0.06] px-3 py-3 text-center text-xs font-semibold text-white/68"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="mt-auto grid gap-3">
              <button
                onClick={() => setShowCamera(true)}
                className="inline-flex h-[52px] items-center justify-center gap-2 bg-white px-5 text-sm font-semibold text-[#171412] transition active:scale-[0.99]"
              >
                <Camera size={18} />
                Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-[52px] items-center justify-center gap-2 border border-white/15 bg-white/[0.06] px-5 text-sm font-semibold text-white backdrop-blur transition active:scale-[0.99]"
              >
                <Upload size={18} />
                Upload Photo
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </section>
        )}

        {step === "details" && photoData && (
          <section className="flex flex-1 flex-col">
            <div className="mb-5 overflow-hidden border border-white/12 bg-white/[0.06] p-3 shadow-[0_26px_80px_rgba(0,0,0,0.36)] backdrop-blur-xl">
              <div className="relative aspect-[4/5] overflow-hidden bg-stone-100">
                <img
                  src={photoData}
                  alt="Your profile"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_52%,rgba(0,0,0,0.42)_100%)]" />
                <p className="absolute bottom-4 left-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/72">
                  Profile image
                </p>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3">
              <label className="border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                <span className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/48">
                  <Ruler size={15} />
                  Height
                </span>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="170"
                  className="h-10 w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-white/18"
                />
                <span className="text-xs text-white/45">cm</span>
              </label>
              <label className="border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                <span className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/48">
                  <Weight size={15} />
                  Weight
                </span>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="65"
                  className="h-10 w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-white/18"
                />
                <span className="text-xs text-white/45">kg</span>
              </label>
            </div>

            {error && (
              <p className="mb-4 border border-red-300/35 bg-red-950/40 px-3 py-2 text-sm text-red-50">
                {error}
              </p>
            )}

            <div className="mt-auto grid gap-3">
              <button
                onClick={handleCreateAvatar}
                className="inline-flex h-[52px] items-center justify-center gap-2 bg-white px-5 text-sm font-semibold text-[#171412] transition active:scale-[0.99]"
              >
                Create Profile
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => {
                  setPhotoData(null);
                  setStep("photo");
                }}
                className="inline-flex h-[52px] items-center justify-center gap-2 border border-white/15 bg-white/[0.06] px-5 text-sm font-semibold text-white backdrop-blur"
              >
                <RotateCcw size={17} />
                Retake
              </button>
            </div>
          </section>
        )}

        {step === "creating" && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center border border-white/12 bg-white/[0.06] backdrop-blur">
              <LoadingSpinner size="lg" />
            </div>
            <p className="text-sm font-semibold text-white">
              Creating profile
            </p>
            <p className="mt-1 max-w-56 text-sm text-white/52">
              Saving your fit image.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
