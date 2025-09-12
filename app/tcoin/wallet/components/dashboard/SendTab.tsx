import React, { useEffect, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { Hypodata } from "./types";
import { SendCard } from "./SendCard";
import { SendQrPanel } from "./SendQrPanel";
import { ContactsTab } from "./ContactsTab";
import { Button } from "@shared/components/ui/Button";
import { LuCamera, LuUsers } from "react-icons/lu";

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
  const [view, setView] = useState<"scan" | "contacts" | "form">(
    recipient ? "form" : "scan"
  );

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
      setView("form");
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

  return (
    <div className="space-y-4">
      {view === "scan" && (
        <>
          <SendQrPanel
            setToSendData={(d) => {
              setToSendData(d);
              setView("form");
            }}
            setTcoin={setTcoinAmount}
            setCad={setCadAmount}
            onComplete={() => setView("form")}
          />
          <Button className="w-full" onClick={() => setView("contacts")}
            >
            <LuUsers className="mr-2 h-4 w-4" /> Select Contact
          </Button>
        </>
      )}
      {view === "contacts" && (
        <>
          <ContactsTab
            onSend={(contact) => {
              setToSendData(contact);
              setView("form");
            }}
          />
          <Button className="w-full mt-2" onClick={() => setView("scan")}>
            <LuCamera className="mr-2 h-4 w-4" /> Scan QR Code
          </Button>
        </>
      )}
      {view === "form" && toSendData && (
        <>
          <Button className="w-full" onClick={() => setView("scan")}>
            <LuCamera className="mr-2 h-4 w-4" /> Open Camera
          </Button>
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
        </>
      )}
    </div>
  );
}
