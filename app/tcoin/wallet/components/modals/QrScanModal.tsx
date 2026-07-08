// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { toast } from 'react-toastify';
import { useControlVariables } from '@shared/hooks/useGetLatestExchangeRate';
import { useCameraAvailability } from "@shared/hooks/useCameraAvailability";
import { resolvePaymentRequestLink } from '@shared/lib/edge/paymentRequestLinksClient';
import {
  connectWalletContact,
  lookupWalletUserByIdentifier,
} from '@shared/lib/edge/walletOperationsClient';
import {
  decodeLegacyWalletPayPayload,
  extractWalletPayToken,
} from '@shared/lib/walletPayLinks';
import type { PaymentRequestLinkResolution } from '@shared/lib/edge/paymentRequestLinks';

export interface QrScanModalProps {
  /** Callback to close the modal */
  closeModal: () => void;
  setToSendData?: any;
  setTcoin?: (value: string) => void;
  setCad?: (value: string) => void;
  onResolvedPaymentLink?: (link: PaymentRequestLinkResolution) => void;
  onResolvedLegacyPayload?: () => void;
}

function extractDecimalFromString(str: string): number {
  const match = str.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

export const QrScanModal: React.FC<QrScanModalProps> = ({
  closeModal,
  setToSendData,
  setTcoin,
  setCad,
  onResolvedPaymentLink,
  onResolvedLegacyPayload,
}: any) => {
  // State to track the current facing mode
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  // Optionally show a loading indicator until the scanner is mounted
  const [loading, setLoading] = useState(true);
  const { hasCamera, hasMultipleCameras, isCheckingCamera } = useCameraAvailability();
  const { exchangeRate } = useControlVariables()

  // Listen for the Escape key to close the modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeModal]);

  // Called whenever a QR code is successfully scanned.
  const handleScan = useCallback(async (data: any) => {
    const rawValue = data?.[0]?.rawValue;
    if (typeof rawValue !== "string" || rawValue.trim() === "") {
      toast.error("We couldn't read that QR code.");
      return;
    }

    const paymentToken = extractWalletPayToken(rawValue);

    try {
      if (paymentToken) {
        const { link } = await resolvePaymentRequestLink(paymentToken);
        if (link.state !== "ready") {
          toast.error("That pay link is no longer available.");
          closeModal();
          return;
        }

        if (link.recipient?.id) {
          await connectWalletContact({ connectedUserId: link.recipient.id, state: "new" });
        }

        onResolvedPaymentLink?.(link);
        toast.success("Scanned pay link successfully");
        closeModal();
        return;
      }

      const decoded = decodeLegacyWalletPayPayload(rawValue);
      const nanoId =
        typeof decoded?.nano_id === "string" && decoded.nano_id.trim()
          ? decoded.nano_id.trim()
          : null;

      if (!nanoId) {
        toast.error("Invalid QR code");
        return;
      }

      const lookup = await lookupWalletUserByIdentifier(
        { userIdentifier: nanoId },
        { citySlug: "tcoin" }
      );
      if (lookup.user?.id) {
        await connectWalletContact({ connectedUserId: lookup.user.id, state: "new" });
      }
      setToSendData(lookup.user ?? null);
      if (decoded?.qrTcoinAmount) {
        setTcoin?.(decoded.qrTcoinAmount as string);
        setCad?.(String(extractDecimalFromString(decoded.qrTcoinAmount as string) * exchangeRate));
      }
      onResolvedLegacyPayload?.();
      toast.success("Scanned User Successfully");
      closeModal();
    } catch (error) {
      console.error("Failed to process scanned QR code:", error);
      toast.error("Failed to process this QR code.");
    }
  }, [
    closeModal,
    exchangeRate,
    onResolvedLegacyPayload,
    onResolvedPaymentLink,
    setCad,
    setTcoin,
    setToSendData,
  ]);

  // Called on any scanning error.
  const handleError = useCallback((error: any) => {
    console.error('QR Scanner error:', error);
  }, []);

  // Toggle between front and rear cameras.
  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    // Set loading true so that any change in stream displays the indicator.
    setLoading(true);
  };

  // Once the component mounts, assume the scanner is ready after a short delay.
  useEffect(() => {
    if (!hasCamera) {
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [facingMode, hasCamera]);

  return (
    <div className="p-4">
      <div className="relative">
        {loading && hasCamera && (
          <p className="absolute z-10 text-gray-700">Loading camera...</p>
        )}
        {!hasCamera && !isCheckingCamera ? (
          <div className="rounded-lg border border-gray-300 bg-gray-50 p-6 text-sm text-gray-700">
            This device does not report an available camera, so QR scanning is unavailable here.
          </div>
        ) : (
          <Scanner
            onScan={handleScan}
            onError={handleError}
            constraints={{ facingMode }}
            style={{ width: '100%', height: '100%' } as any}
            className="object-cover"
          />
        )}
        {hasCamera && hasMultipleCameras && (
          <button
            onClick={handleFlipCamera}
            className="absolute bottom-2 right-2 bg-black text-white border rounded p-1 text-sm"
            title="Flip camera"
          >
            Flip Camera
          </button>
        )}
        <button
          onClick={closeModal}
          className="absolute top-2 right-2 bg-black text-white border rounded p-1 text-sm"
          title="Close"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default QrScanModal;
