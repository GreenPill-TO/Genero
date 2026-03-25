// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useAuth } from '@shared/api/hooks/useAuth';
import { toast } from 'react-toastify';
import { useControlVariables } from '@shared/hooks/useGetLatestExchangeRate';
import {
  connectWalletContact,
  lookupWalletUserByIdentifier,
} from '@shared/lib/edge/walletOperationsClient';

export interface QrScanModalProps {
  /** Callback to close the modal */
  closeModal: () => void;
  setToSendData?: any;
  setTcoin?: (value: string) => void;
  setCad?: (value: string) => void;
}

function extractDecimalFromString(str: string): number {
  const match = str.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

export const QrScanModal: React.FC<QrScanModalProps> = ({
  closeModal,
  setToSendData,
  setTcoin,
  setCad
}: any) => {
  // State to track the current facing mode
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  // Optionally show a loading indicator until the scanner is mounted
  const [loading, setLoading] = useState(true);
  const { userData } = useAuth();
  const { exchangeRate } = useControlVariables()

  // Check if multiple video input devices exist.
  useEffect(() => {
    const checkDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((device) => device.kind === 'videoinput');
        setHasMultipleCameras(videoInputs.length > 1);
      } catch (error) {
        console.error('Error enumerating devices:', error);
      }
    };

    checkDevices();
  }, []);

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

  function extractAndDecodeBase64(url: string) {
    try {
      const urlObj = new URL(url);
      const base64Data = urlObj.searchParams.get("pay");
      if (!base64Data) throw new Error("No Base64 data found in URL.");

      // Decode Base64 data
      const decodedData = decodeURIComponent(escape(atob(base64Data)));
      return JSON.parse(decodedData); // Assuming the data is in JSON format
    } catch (error) {
      console.error("Error decoding Base64:", error);
      return null;
    }
  }

  // Called whenever a QR code is successfully scanned.
  const handleScan = useCallback(async (data: any) => {
    const { nano_id, ...rest } = extractAndDecodeBase64(data?.[0]?.rawValue);
    console.log({ rest });
    toast.success("Scanned User Successfully");
    if (nano_id) {
      const lookup = await lookupWalletUserByIdentifier({ identifier: nano_id });
      if (lookup.user?.id) {
        await connectWalletContact({ connectedUserId: lookup.user.id, state: "new" });
      }
      setToSendData(lookup.user ?? null);
      if (rest?.qrTcoinAmount) {
        setTcoin?.(rest?.qrTcoinAmount);
        setCad?.(String(extractDecimalFromString(rest?.qrTcoinAmount) * exchangeRate));
      }
    }

    closeModal();
  }, [closeModal, exchangeRate, setCad, setTcoin, setToSendData]);

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
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [facingMode]);

  return (
    <div className="p-4">
      <div className="relative">
        {loading && (
          <p className="absolute z-10 text-gray-700">Loading camera...</p>
        )}
        <Scanner
          onScan={handleScan}
          onError={handleError}
          // Pass the camera constraints – flipping the camera is as simple as toggling the facingMode value.
          constraints={{ facingMode }}
          // Style to ensure the video fills the container.
          style={{ width: '100%', height: '100%' } as any}
          className="object-cover"
        />
        {hasMultipleCameras && (
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
