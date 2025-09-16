import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { createClient } from "@shared/lib/supabase/client";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { useModal } from "@shared/contexts/ModalContext";
import { Hypodata } from "./types";
import { SendCard } from "./SendCard";
import { ContactsTab } from "./ContactsTab";
import { QrScanModal } from "@tcoin/wallet/components/modals";
import { LuCamera, LuUsers } from "react-icons/lu";

interface SendTabProps {
  recipient: Hypodata | null;
}

export function SendTab({ recipient }: SendTabProps) {
  const { userData } = useAuth();
  const { exchangeRate } = useControlVariables();
  const safeExchangeRate =
    typeof exchangeRate === "number" && Number.isFinite(exchangeRate) && exchangeRate > 0
      ? exchangeRate
      : 0;
  const sanitizeNumeric = (value: string) => value.replace(/[^\d.]/g, "");
  const [toSendData, setToSendData] = useState<Hypodata | null>(recipient);
  const [tcoinAmount, setTcoinAmount] = useState("");
  const [cadAmount, setCadAmount] = useState("");
  const [explorerLink, setExplorerLink] = useState<string | null>(null);
  const [mode, setMode] = useState<"manual" | "qr" | "link">("manual");
  const [payLink, setPayLink] = useState("");
  const { openModal, closeModal } = useModal();

  const { sendMoney } = useSendMoney({
    senderId: userData?.cubidData?.id,
    receiverId: toSendData?.id ?? null,
  });
  const { balance: rawBalance } = useTokenBalance(
    userData?.cubidData?.wallet_address || ""
  );
  const balance = parseFloat(rawBalance) || 0;

  useEffect(() => {
    setToSendData(recipient);
  }, [recipient]);

  const handleUseMax = () => {
    const cadNumeric = safeExchangeRate === 0 ? 0 : balance * safeExchangeRate;
    setTcoinAmount(balance.toFixed(2));
    setCadAmount(cadNumeric.toFixed(2));
  };

  const handleTcoinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeNumeric(e.target.value);
    setTcoinAmount(raw);
    if (raw === "") {
      setCadAmount("");
      return;
    }
    const num = Number.parseFloat(raw);
    if (!Number.isFinite(num)) {
      setCadAmount("");
      return;
    }
    if (safeExchangeRate === 0) {
      setCadAmount("");
      return;
    }
    setCadAmount((num * safeExchangeRate).toString());
  };

  const handleCadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeNumeric(e.target.value);
    setCadAmount(raw);
    if (raw === "") {
      setTcoinAmount("");
      return;
    }
    const num = Number.parseFloat(raw);
    if (!Number.isFinite(num) || safeExchangeRate === 0) {
      setTcoinAmount("");
      return;
    }
    setTcoinAmount((num / safeExchangeRate).toString());
  };

  const handleTcoinBlur = () => {
    if (tcoinAmount.trim() === "") {
      setCadAmount("");
      return;
    }
    const numeric = Number.parseFloat(tcoinAmount);
    if (!Number.isFinite(numeric)) {
      setTcoinAmount("");
      setCadAmount("");
      return;
    }
    const cadNumeric = safeExchangeRate === 0 ? 0 : numeric * safeExchangeRate;
    setTcoinAmount(numeric.toFixed(2));
    setCadAmount(cadNumeric.toFixed(2));
  };

  const handleCadBlur = () => {
    if (cadAmount.trim() === "") {
      setTcoinAmount("");
      return;
    }
    const numeric = Number.parseFloat(cadAmount);
    if (!Number.isFinite(numeric)) {
      setCadAmount("");
      setTcoinAmount("");
      return;
    }
    const tcoinNumeric = safeExchangeRate === 0 ? 0 : numeric / safeExchangeRate;
    setCadAmount(numeric.toFixed(2));
    setTcoinAmount(tcoinNumeric.toFixed(2));
  };

  const reset = () => {
    setToSendData(null);
    setTcoinAmount("");
    setCadAmount("");
    setPayLink("");
  };

  const openScanner = () => {
    openModal({
      content: (
        <QrScanModal
          closeModal={closeModal}
          setToSendData={(d: Hypodata) => setToSendData(d)}
          setTcoin={setTcoinAmount}
          setCad={setCadAmount}
        />
      ),
      title: "Scan QR",
      description: "Use your device's camera to scan a code.",
    });
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
        const sanitized = sanitizeNumeric(String(qrTcoinAmount));
        if (sanitized) {
          const num = Number.parseFloat(sanitized);
          if (Number.isFinite(num)) {
            const cadNumeric = safeExchangeRate === 0 ? 0 : num * safeExchangeRate;
            setTcoinAmount(num.toFixed(2));
            setCadAmount(cadNumeric.toFixed(2));
          }
        }
      }
    } catch (err) {
      console.error("handlePayLink error", err);
      toast.error("Failed to process link");
    }
  };

  useEffect(() => {
    reset();
    if (mode === "qr") {
      openScanner();
      setMode("manual");
    }
  }, [mode]);

  const amountEntered =
    (parseFloat(tcoinAmount) || 0) > 0 || (parseFloat(cadAmount) || 0) > 0;

  const openContactsModal = () => {
    openModal({
      title: "Select Contact",
      content: (
        <ContactsTab
          onSend={(contact) => {
            setToSendData(contact);
            closeModal();
          }}
        />
      ),
    });
  };

  return (
    <div className="space-y-4 lg:px-[25vw]">
      <div className="flex gap-2">
        <Button
          variant={mode === "manual" ? "default" : "outline"}
          onClick={() => setMode("manual")}
        >
          Manual
        </Button>
        <Button
          variant={mode === "qr" ? "default" : "outline"}
          onClick={() => setMode("qr")}
        >
          QR
        </Button>
        <Button
          variant={mode === "link" ? "default" : "outline"}
          onClick={() => setMode("link")}
        >
          Pay Link
        </Button>
      </div>

      {mode === "manual" && (
        <>
          <SendCard
            toSendData={toSendData}
            setToSendData={setToSendData}
            tcoinAmount={tcoinAmount}
            cadAmount={cadAmount}
            handleTcoinChange={handleTcoinChange}
            handleCadChange={handleCadChange}
            handleTcoinBlur={handleTcoinBlur}
            handleCadBlur={handleCadBlur}
            explorerLink={explorerLink}
            setExplorerLink={setExplorerLink}
            setTcoin={setTcoinAmount}
            setCad={setCadAmount}
            sendMoney={sendMoney}
            userBalance={balance}
            onUseMax={handleUseMax}
          />
          {!toSendData && amountEntered && (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={openScanner}>
                <LuCamera className="mr-2 h-4 w-4" /> Scan QR Code
              </Button>
              <Button className="flex-1" onClick={openContactsModal}>
                <LuUsers className="mr-2 h-4 w-4" /> Select Contact
              </Button>
            </div>
          )}
        </>
      )}

      {mode === "link" && (
        <>
          {!toSendData ? (
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
          ) : (
            <SendCard
              locked
              toSendData={toSendData}
              setToSendData={setToSendData}
              tcoinAmount={tcoinAmount}
              cadAmount={cadAmount}
              handleTcoinChange={handleTcoinChange}
              handleCadChange={handleCadChange}
              handleTcoinBlur={handleTcoinBlur}
              handleCadBlur={handleCadBlur}
              explorerLink={explorerLink}
              setExplorerLink={setExplorerLink}
              setTcoin={setTcoinAmount}
              setCad={setCadAmount}
              sendMoney={sendMoney}
              userBalance={balance}
            />
          )}
        </>
      )}
    </div>
  );
}

