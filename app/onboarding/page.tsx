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
    <main className="app-shell">
      <div className="screen">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="section-title">Cloak</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Your fit profile
            </h1>
          </div>
          <div className="flex h-12 w-12 items-center justify-center border border-line bg-panel text-sm font-semibold">
            CL
          </div>
        </header>

        {step === "photo" && (
          <section className="flex flex-1 flex-col">
            <div className="surface mb-4 overflow-hidden">
              <div className="aspect-[4/5] bg-[linear-gradient(145deg,#fffdf9,#ece3da)] p-5">
                <div className="flex h-full flex-col justify-between border border-line bg-white/45 p-4">
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      Start with one clear portrait
                    </p>
                    <p className="mt-1 text-sm leading-5 text-muted">
                      Use a fitted outfit and keep your full body in frame.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-20 border border-line bg-panel" />
                    <div className="h-28 border border-primary bg-white" />
                    <div className="h-20 border border-line bg-panel" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <button
                onClick={() => setShowCamera(true)}
                className="btn-primary w-full"
              >
                <Camera size={18} />
                Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-outline w-full"
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
            <div className="surface mb-5 overflow-hidden">
              <div className="relative aspect-[4/5] bg-stone-100">
                <img
                  src={photoData}
                  alt="Your profile"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3">
              <label className="panel p-3">
                <span className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-muted">
                  <Ruler size={15} />
                  Height
                </span>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="170"
                  className="h-10 w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-stone-300"
                />
                <span className="text-xs text-muted">cm</span>
              </label>
              <label className="panel p-3">
                <span className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-muted">
                  <Weight size={15} />
                  Weight
                </span>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="65"
                  className="h-10 w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-stone-300"
                />
                <span className="text-xs text-muted">kg</span>
              </label>
            </div>

            {error && (
              <p className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="mt-auto grid gap-3">
              <button onClick={handleCreateAvatar} className="btn-primary w-full">
                Create Profile
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => {
                  setPhotoData(null);
                  setStep("photo");
                }}
                className="btn-outline w-full"
              >
                <RotateCcw size={17} />
                Retake
              </button>
            </div>
          </section>
        )}

        {step === "creating" && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-5 text-sm font-semibold text-primary">
              Creating profile
            </p>
            <p className="mt-1 max-w-56 text-sm text-muted">
              Saving your portrait for try-on.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
