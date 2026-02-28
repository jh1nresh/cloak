"use client";

import { useRef, useState, useCallback } from "react";

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
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex-1 relative">
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
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <button
              onClick={startCamera}
              className="btn-primary"
            >
              Start Camera
            </button>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black p-6">
            <div className="text-center text-white">
              <p className="mb-4">{error}</p>
              <button onClick={startCamera} className="btn-secondary">
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-black flex justify-center gap-4">
        <button
          onClick={handleCancel}
          className="px-6 py-3 text-white rounded-full"
        >
          Cancel
        </button>
        {isStreaming && (
          <button
            onClick={capturePhoto}
            className="w-16 h-16 rounded-full bg-white border-4 border-accent active:scale-95 transition-transform"
          />
        )}
      </div>
    </div>
  );
}
