"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    const avatarUrl = localStorage.getItem("avatarUrl");

    if (userId && avatarUrl) {
      router.replace("/tryon");
    } else {
      router.replace("/onboarding");
    }
  }, [router]);

  return (
    <main className="min-h-dvh bg-background flex flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary mb-2">Cloak</h1>
        <p className="text-gray-500 mb-8">Virtual Try-On</p>
        <LoadingSpinner size="lg" />
      </div>
    </main>
  );
}
