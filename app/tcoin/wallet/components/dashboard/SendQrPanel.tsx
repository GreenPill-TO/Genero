import React, { useEffect, useState, useCallback } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useAuth } from "@shared/api/hooks/useAuth";
import { createClient } from "@shared/lib/supabase/client";
import { toast } from "react-toastify";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { Hypodata } from "./types";

function extractDecimalFromString(str: string): number {
  const match = str.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

interface Props {
  setToSendData: (data: Hypodata) => void;
  setTcoin: (val: string) => void;
  setCad: (val: string) => void;
  onComplete: () => void;
}

export function SendQrPanel({ setToSendData, setTcoin, setCad, onComplete }: Props) {
  const { userData } = useAuth();
  const { exchangeRate } = useControlVariables();
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultipleCameras(devices.some((d) => d.kind === "videoinput"));
      } catch (error) {
        console.error("Error enumerating devices:", error);
      }
    };
    checkDevices();
  }, []);

  const extractAndDecodeBase64 = (url: string) => {
    try {
      const urlObj = new URL(url);
      const base64Data = urlObj.searchParams.get("pay");
      if (!base64Data) throw new Error("No Base64 data found in URL.");
      const decodedData = decodeURIComponent(escape(atob(base64Data)));
      return JSON.parse(decodedData);
    } catch (error) {
      console.error("Error decoding Base64:", error);
      return null;
    }
  };

  const handleScan = useCallback(
    async (data: any) => {
      const decoded = extractAndDecodeBase64(data?.[0]?.rawValue);
      const { nano_id, ...rest } = decoded ?? {};
      const supabase = createClient();
      toast.success("Scanned User Successfully");
      if (nano_id) {
        const { data: userDataFromSupabaseTable } = await supabase
          .from("users")
          .select("*")
          .match({ user_identifier: nano_id });
        await supabase.from("connections").insert({
          owner_user_id: (userData as any)?.cubidData?.id,
          connected_user_id: userDataFromSupabaseTable?.[0]?.id,
          state: "new",
        });
        await supabase.from("connections").insert({
          connected_user_id: (userData as any)?.cubidData?.id,
          owner_user_id: userDataFromSupabaseTable?.[0]?.id,
          state: "new",
        });
        setToSendData(userDataFromSupabaseTable?.[0]);
        if (rest?.qrTcoinAmount) {
          setTcoin(rest.qrTcoinAmount);
          setCad(extractDecimalFromString(rest.qrTcoinAmount) * exchangeRate);
        }
      }
      onComplete();
    },
    [exchangeRate, onComplete, setCad, setTcoin, setToSendData, userData]
  );

  const handleError = useCallback((error: any) => {
    console.error("QR Scanner error:", error);
  }, []);

  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    setLoading(true);
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [facingMode]);

  return (
    <div className="p-4" data-testid="send-scan-panel">
      <div className="relative">
        {loading && <p className="absolute z-10 text-gray-700">Loading camera...</p>}
        <Scanner
          onScan={handleScan}
          onError={handleError}
          constraints={{ facingMode }}
          style={{ width: "100%", height: "100%" } as any}
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
      </div>
    </div>
  );
}

export default SendQrPanel;
