import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { createClient } from "@shared/lib/supabase/client";
import { Hypodata } from "./types";
import { SendCard } from "./SendCard";
import { SendQrPanel } from "./SendQrPanel";
import { ContactsTab } from "./ContactsTab";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { LuCamera, LuLink2, LuUsers } from "react-icons/lu";

interface SendTabProps {
  recipient: Hypodata | null;
}

export function SendTab({ recipient }: SendTabProps) {
  const { userData } = useAuth();
  const { exchangeRate } = useControlVariables();
  const [toSendData, setToSendData] = useState<Hypodata | null>(recipient);
  const [tcoinAmount, setTcoinAmount] = useState("");
  const [cadAmount, setCadAmount] = useState("");
  const [explorerLink, setExplorerLink] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(!recipient);
  const [showContacts, setShowContacts] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [payLink, setPayLink] = useState("");

  const { sendMoney } = useSendMoney({
    senderId: userData?.cubidData?.id,
    receiverId: toSendData?.id ?? null,
  });
  const { balance } = useTokenBalance(
    userData?.cubidData?.wallet_address || ""
  );
  useEffect(() => {
    setToSendData(recipient);
    if (recipient) {
      setCameraOpen(false);
    }
  }, [recipient]);

  const handleTcoinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.]/g, "");
    setTcoinAmount(raw);
    const num = parseFloat(raw) || 0;
    setCadAmount((num * exchangeRate).toString());
  };

  const handleCadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.]/g, "");
    setCadAmount(raw);
    const num = parseFloat(raw) || 0;
    setTcoinAmount((num / exchangeRate).toString());
  };

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

  const handlePayLink = async () => {
    const decoded = extractAndDecodeBase64(payLink);
    const { nano_id, qrTcoinAmount } = decoded ?? {};
    if (!nano_id) {
      toast.error("Invalid pay link");
      return;
    }
    try {
      const supabase = createClient();
      const { data: userDataFromSupabaseTable, error } = await supabase
        .from("users")
        .select("*")
        .match({ user_identifier: nano_id });
      if (error) throw error;
      setToSendData(userDataFromSupabaseTable?.[0]);
      if (qrTcoinAmount) {
        setTcoinAmount(qrTcoinAmount);
        const num = parseFloat(qrTcoinAmount) || 0;
        setCadAmount((num * exchangeRate).toString());
      }
      setShowLinkInput(false);
      setPayLink("");
    } catch (err) {
      console.error("handlePayLink error", err);
      toast.error("Failed to process link");
    }
  };

  return (
    <div className="space-y-4">
      {cameraOpen && !showContacts && (
        <>
          <SendQrPanel
            setToSendData={(d) => {
              setToSendData(d);
              setCameraOpen(false);
            }}
            setTcoin={setTcoinAmount}
            setCad={setCadAmount}
            onComplete={() => setCameraOpen(false)}
          />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => { setShowContacts(true); setCameraOpen(false); }}>
              <LuUsers className="mr-2 h-4 w-4" /> Select Contact
            </Button>
            <Button className="flex-1" onClick={() => { setShowLinkInput(true); setCameraOpen(false); }}>
              <LuLink2 className="mr-2 h-4 w-4" /> Paste Link
            </Button>
          </div>
        </>
      )}
      {showContacts && (
        <>
          <ContactsTab
            onSend={(contact) => {
              setToSendData(contact);
              setShowContacts(false);
            }}
          />
          <Button className="w-full mt-2" onClick={() => { setShowContacts(false); setCameraOpen(true); }}>
            <LuCamera className="mr-2 h-4 w-4" /> Scan QR Code
          </Button>
        </>
      )}
      {showLinkInput && (
        <div className="space-y-2">
          <Input
            placeholder="Paste pay link"
            value={payLink}
            onChange={(e) => setPayLink(e.target.value)}
          />
          <Button className="w-full" onClick={handlePayLink}>
            Load Link
          </Button>
        </div>
      )}
      {!cameraOpen && !showContacts && !showLinkInput && (
        <Button className="w-full" onClick={() => setCameraOpen(true)}>
          <LuCamera className="mr-2 h-4 w-4" /> Open Camera
        </Button>
      )}
      <SendCard
        toSendData={toSendData}
        setToSendData={setToSendData}
        tcoinAmount={tcoinAmount}
        cadAmount={cadAmount}
        handleTcoinChange={handleTcoinChange}
        handleCadChange={handleCadChange}
        explorerLink={explorerLink}
        setExplorerLink={setExplorerLink}
        setTcoin={setTcoinAmount}
        setCad={setCadAmount}
        sendMoney={sendMoney}
        userBalance={balance}
      />
    </div>
  );
}
