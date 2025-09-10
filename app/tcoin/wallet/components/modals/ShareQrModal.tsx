"use client";
import React from "react";
import { Button } from "@shared/components/ui/Button";
import { toast } from "react-toastify";
import useEscapeKey from "@shared/hooks/useEscapeKey";

interface ShareQrModalProps {
  closeModal: () => void;
}

const ShareQrModal = ({ closeModal }: ShareQrModalProps) => {
  useEscapeKey(closeModal);
  return (
    <div className="mt-2 p-0">
      <div className="space-y-4">
        <Button className="w-full">Share via Email</Button>
        <Button className="w-full">Share via SMS</Button>
        <Button
          className="w-full"
          onClick={() => {
            navigator.clipboard
              .writeText("https://example.com/qr-code-link")
              .then(() => {
                toast.success("The QR code link has been copied to your clipboard.");
              })
              .catch((err) => {
                console.error("Failed to copy: ", err);
              });
          }}
        >
          Copy Link
        </Button>
      </div>
    </div>
  );
};

export { ShareQrModal };
