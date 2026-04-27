"use client";

import { useRef, useState, useCallback } from "react";
import { Camera, RotateCcw, X } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 720, height: 1280 },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        setError(null);
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Unable to access camera. Please allow camera permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL("image/jpeg", 0.9);
        stopCamera();
        onCapture(imageData);
      }
    }
  }, [stopCamera, onCapture]);

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          onLoadedMetadata={() => videoRef.current?.play()}
        />
        <canvas ref={canvasRef} className="hidden" />

        {!isStreaming && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black p-6">
            <button
              onClick={startCamera}
              className="inline-flex h-12 items-center justify-center gap-2 bg-white px-5 text-sm font-semibold text-primary"
            >
              <Camera size={18} />
              Start Camera
            </button>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/95 p-6">
            <div className="w-full max-w-xs border border-white/20 bg-white p-5 text-center text-primary">
              <p className="text-sm leading-5">{error}</p>
              <button
                onClick={startCamera}
                className="mt-4 inline-flex h-11 items-center justify-center gap-2 bg-primary px-4 text-sm font-semibold text-white"
              >
                <RotateCcw size={17} />
                Retry
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-8 bg-black px-6 py-5">
        <button
          onClick={handleCancel}
          className="inline-flex h-12 w-12 items-center justify-center border border-white/20 text-white"
          aria-label="Cancel"
        >
          <X size={20} />
        </button>
        {isStreaming && (
          <button
            onClick={capturePhoto}
            className="h-16 w-16 rounded-full border-4 border-white bg-white/20 ring-2 ring-white/50 transition active:scale-95"
            aria-label="Capture photo"
          />
        )}
        <div className="h-12 w-12" />
      </div>
    </div>
  );
}
