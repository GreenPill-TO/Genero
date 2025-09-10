"use client";
import React from "react";
import useEscapeKey from "@shared/hooks/useEscapeKey";

interface TopUpModalProps {
  closeModal: () => void;
}

const TopUpModal = ({ closeModal }: TopUpModalProps) => {
  useEscapeKey(closeModal);
  return (
    <div className="mt-2 p-0">
      <div className="space-y-4">
        <p>
          <strong>Destination email:</strong> topup@tcoin.me
        </p>
        <p>
          <strong>Reference number:</strong> {Math.random().toString(36).substring(2, 10).toUpperCase()}
        </p>
        <p className="text-sm text-gray-500">
          Note: You must send the eTransfer from a bank account with the same owner as this TCOIN account. The balance will show up within 24 hours.
        </p>
      </div>
    </div>
  );
};

export { TopUpModal };
