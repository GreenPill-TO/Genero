// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useAuth } from '@shared/api/hooks/useAuth';
import { createClient } from '@shared/lib/supabase/client';
import { toast } from 'react-toastify';

export interface QrScanModalProps {
  /** Callback to close the modal */
  closeModal: () => void;
  setToSendData: any
}

/**
 * A QR scanning modal that uses the @yudiel/react-qr-scanner library.
 * It handles camera stream setup, scanning, and camera flipping if multiple cameras are available.
 */
export const QrScanModal: React.FC<QrScanModalProps> = ({
  closeModal,
  setToSendData,
  setTcoin
}) => {
  // State to track the current facing mode
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  // Optionally show a loading indicator until the scanner is mounted
  const [loading, setLoading] = useState(true);
  const { userData } = useAuth()

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

  // Called whenever a QR code is successfully scanned.
  const handleScan = useCallback(async (data: any) => {
    console.log(JSON.parse(data?.[0]?.rawValue));
    const { user_id } = JSON.parse(data?.[0]?.rawValue)
    const supabase = createClient()
    toast.success("Scanned User Successfully")
    if (user_id) {
      await supabase.from("connections").insert({
        owner_user_id: (userData as any)?.cubidData?.id,
        connected_user_id: user_id,
        state: "new"
      })
      const { data: userDataFromSupabaseTable } = await supabase.from("users").select("*").match({
        id: user_id
      })
      setToSendData(userDataFromSupabaseTable?.[0])
      if(JSON.parse(data?.[0]?.rawValue)?.tcoinAmount){
        setTcoin(JSON.parse(data?.[0]?.rawValue)?.tcoinAmount)
      }
    }

    closeModal()
  }, [closeModal]);

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
  // (If the library exposes an event for this, you can use that instead.)
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
          style={{ width: '100%', height: '100%' }}
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
