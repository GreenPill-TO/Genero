"use client";
import React, { useEffect, useRef, useState } from "react";
import useEscapeKey from "@shared/hooks/useEscapeKey";

interface QrScanModalProps {
  closeModal: () => void;
}

const QrScanModal = ({ closeModal }: QrScanModalProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEscapeKey(closeModal);

  useEffect(() => {
    const enableCamera = async () => {
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
        } else {
          setError("Camera not supported.");
        }
      } catch (err) {
        setError("Camera access denied.");
      }
    };
    enableCamera();
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="mt-2 p-0">
      <div className="space-y-4">
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : (
          <video ref={videoRef} className="w-full h-64 bg-gray-100 rounded-md" />
        )}
      </div>
    </div>
  );
};

export { QrScanModal };
