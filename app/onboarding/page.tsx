"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoData(event.target?.result as string);
        setStep("details");
      };
      reader.readAsDataURL(file);
    }
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
    return <CameraCapture onCapture={handlePhotoCapture} onCancel={() => setShowCamera(false)} />;
  }

  return (
    <main className="min-h-dvh bg-background px-6 py-8 flex flex-col">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary">Cloak</h1>
          <p className="text-sm text-gray-400 mt-1">Try on the world</p>
        </div>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-primary mb-1">
            {step === "photo" ? "Create Your Avatar" : step === "details" ? "Almost There" : "Creating Avatar"}
          </h2>
          <p className="text-gray-500 text-sm">
            {step === "photo" ? "Take a photo or upload one to get started" : step === "details" ? "Add details for better size recommendations" : "Setting up your virtual try-on experience..."}
          </p>
        </div>

        {step === "photo" && (
          <div className="flex-1 flex flex-col gap-4">
            <button onClick={() => setShowCamera(true)} className="card flex flex-col items-center justify-center py-12 hover:shadow-md transition-shadow">
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="font-medium text-primary">Take a Photo</span>
              <span className="text-sm text-gray-400 mt-1">Use your camera</span>
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="card flex flex-col items-center justify-center py-12 hover:shadow-md transition-shadow">
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="font-medium text-primary">Upload Photo</span>
              <span className="text-sm text-gray-400 mt-1">Choose from gallery</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </div>
        )}

        {step === "details" && photoData && (
          <div className="flex-1 flex flex-col">
            <div className="flex justify-center mb-8">
              <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-accent">
                <Image src={photoData} alt="Your photo" fill className="object-cover" />
              </div>
            </div>
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Height (cm) — Optional</label>
                <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="170" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Weight (kg) — Optional</label>
                <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="65" className="input" />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
            <div className="mt-auto space-y-3">
              <button onClick={handleCreateAvatar} className="btn-primary w-full">Create My Avatar →</button>
              <button onClick={() => { setPhotoData(null); setStep("photo"); }} className="btn-outline w-full">Retake Photo</button>
            </div>
          </div>
        )}

        {step === "creating" && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-gray-500">Creating your avatar...</p>
          </div>
        )}
      </div>
    </main>
  );
}
