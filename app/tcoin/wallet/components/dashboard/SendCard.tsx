import React, { useEffect, useState } from "react";
import { LuRefreshCcw, LuSend } from "react-icons/lu";
import { toast } from "react-toastify";
import { useAuth } from "@shared/api/hooks/useAuth";
import { Button } from "@shared/components/ui/Button";
import { useModal } from "@shared/contexts/ModalContext";
import { createClient } from "@shared/lib/supabase/client";
import { insertSuccessNotification } from "@shared/utils/insertNotification";
import { Hypodata } from "./types";

const formatTcoinDisplay = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  const num = Number.parseFloat(trimmed);
  if (!Number.isFinite(num)) {
    return `${trimmed} TCOIN`;
  }
  return `${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TCOIN`;
};

const formatCadDisplay = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  const num = Number.parseFloat(trimmed);
  if (!Number.isFinite(num)) {
    return `$${trimmed}`;
  }
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface SendCardProps {
  sendMoney: (amount: string) => Promise<string>;
  toSendData: Hypodata | null;
  setToSendData: (data: Hypodata | null) => void;
  tcoinAmount: string;
  cadAmount: string;
  handleTcoinChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTcoinBlur: () => void;
  handleCadBlur: () => void;
  explorerLink: string | null;
  setExplorerLink: (link: string | null) => void;
  setTcoin: any;
  setCad: any;
  userBalance: number;
  onUseMax: () => void;
  locked?: boolean;
}

export function SendCard({
  toSendData,
  setToSendData,
  tcoinAmount,
  cadAmount,
  handleTcoinChange,
  handleCadChange,
  handleTcoinBlur,
  handleCadBlur,
  explorerLink,
  setExplorerLink,
  setTcoin,
  sendMoney,
  setCad,
  userBalance,
  onUseMax,
  locked = false,
}: SendCardProps) {
  const [connections, setConnections] = useState<any>(null);
  const { userData } = useAuth();
  const { openModal, closeModal } = useModal();

  useEffect(() => {
    if (!toSendData?.id || !userData?.cubidData?.id) return;
    const fetchConnections = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("connections")
          .select("*")
          .match({
            connected_user_id: toSendData.id,
            owner_user_id: userData.cubidData.id,
          })
          .neq("state", "new");
        if (error) throw error;
        setConnections(data?.[0] ?? null);
      } catch (err) {
        console.error("fetchConnections error", err);
      }
    };
    fetchConnections();
  }, [toSendData?.id, userData?.cubidData?.id]);

  const tcoinValue = parseFloat(tcoinAmount);
  const cadValue = parseFloat(cadAmount);
  const isValidAmount =
    !isNaN(tcoinValue) &&
    !isNaN(cadValue) &&
    tcoinValue > 0 &&
    cadValue > 0 &&
    tcoinValue <= userBalance;

  const [isCadInput, setIsCadInput] = useState(false);
  const [isTcoinFocused, setIsTcoinFocused] = useState(false);
  const [isCadFocused, setIsCadFocused] = useState(false);
  const amountLocked = locked &&
    ((isCadInput ? cadAmount : tcoinAmount) !== "0" && (isCadInput ? cadAmount : tcoinAmount) !== "");

  return (
    <div className="space-y-4">
      {toSendData && (
        <div className="p-4 mt-4 bg-gray-800 rounded-lg shadow-lg border border-gray-700 relative">
          <button
            onClick={() => {
              setToSendData(null);
              setTcoin("");
              setCad("");
            }}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-300"
          >
            &times;
          </button>
          <p className="text-lg font-bold mb-2">{toSendData.full_name ?? ""}</p>
          <p className="text-sm text-gray-400 mb-2">@{toSendData.username ?? ""}</p>
          {toSendData.profile_image_url && (
            <img
              src={toSendData.profile_image_url}
              alt={toSendData.full_name ?? ""}
              className="w-16 h-16 rounded-full object-cover"
            />
          )}
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl">
        <div className="relative mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-4 rounded-3xl border border-border/60 bg-background/70 px-6 py-8 shadow-lg sm:px-10 sm:py-10 lg:max-w-lg min-h-[24rem] sm:min-h-[26rem]">
          <div className="w-full text-center">
            {isCadInput ? (
              <input
                className="w-full text-center text-7xl font-bold bg-transparent focus:outline-none"
                name="cad"
                value={isCadFocused ? cadAmount : formatCadDisplay(cadAmount)}
                onChange={amountLocked ? undefined : handleCadChange}
                onFocus={() => setIsCadFocused(true)}
                onBlur={() => {
                  setIsCadFocused(false);
                  handleCadBlur();
                }}
                readOnly={amountLocked}
                placeholder="0"
              />
            ) : (
              <input
                className="w-full text-center text-7xl font-bold bg-transparent focus:outline-none"
                name="tcoin"
                value={isTcoinFocused ? tcoinAmount : formatTcoinDisplay(tcoinAmount)}
                onChange={amountLocked ? undefined : handleTcoinChange}
                onFocus={() => setIsTcoinFocused(true)}
                onBlur={() => {
                  setIsTcoinFocused(false);
                  handleTcoinBlur();
                }}
                readOnly={amountLocked}
                placeholder="0"
              />
            )}
          </div>
          <div className="flex w-full justify-end pr-6">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Toggle between TCOIN and CAD"
              className="rounded-full border border-border/60"
              onClick={() => {
                if (isCadInput) {
                  handleCadBlur();
                } else {
                  handleTcoinBlur();
                }
                setIsCadInput((prev) => !prev);
                setIsCadFocused(false);
                setIsTcoinFocused(false);
              }}
            >
              <LuRefreshCcw className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {isCadInput
              ? `≈ ${formatTcoinDisplay(tcoinAmount) || "0.00 TCOIN"}`
              : `≈ ${formatCadDisplay(cadAmount) || "$0.00"} CAD`}
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Available: {userBalance.toFixed(4)}</span>
            <Button variant="link" className="p-0 h-auto text-xs" onClick={onUseMax}>
              Use Max
            </Button>
          </div>
        </div>
      </div>

      <Button
        className="w-full"
        disabled={!isValidAmount || !toSendData}
        onClick={() => {
          if (!isValidAmount || !toSendData) {
            toast.error(
              !toSendData
                ? "Select a recipient first."
                : "Please enter valid amounts. Ensure they are positive and within your available balance."
            );
            return;
          }
          openModal({
            content: (
              <ConfirmTransactionModal
                tcoinAmount={tcoinAmount}
                cadAmount={cadAmount}
                toSendData={toSendData}
                closeModal={closeModal}
                sendMoney={sendMoney}
                setExplorerLink={setExplorerLink}
              />
            ),
            title: "Confirm Payment",
          });
        }}
      >
        <LuSend className="mr-2 h-4 w-4" /> Send to Contact
      </Button>

      {explorerLink && (
        <div className="p-4 bg-green-900/20 rounded-lg">
          <div className="text-center space-y-4">
            <>
              <h3 className="text-lg font-bold text-green-400">Success!</h3>
              <a
                href={explorerLink}
                className="text-blue-400 underline block"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Transaction on Explorer
              </a>
            </>
            {!connections?.[0] && toSendData && (
              <div className="pt-4 border-t border-gray-700">
                <p>Add to Contacts?</p>
                <div className="flex justify-center gap-4 mt-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      const supabase = createClient();
                      try {
                        await supabase
                          .from("connections")
                          .update({ state: "added" })
                          .match({
                            connected_user_id: toSendData.id,
                            owner_user_id: userData?.cubidData?.id,
                          });
                        await supabase
                          .from("connections")
                          .update({ state: "added" })
                          .match({
                            owner_user_id: toSendData.id,
                            connected_user_id: userData?.cubidData?.id,
                          });
                        toast.success("Contact added!");
                      } catch (err) {
                        console.error("add contact error", err);
                      }
                    }}
                  >
                    Yes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const supabase = createClient();
                      try {
                        await supabase
                          .from("connections")
                          .update({ state: "removed" })
                          .match({
                            connected_user_id: toSendData.id,
                            owner_user_id: userData?.cubidData?.id,
                          });
                        await supabase
                          .from("connections")
                          .update({ state: "removed" })
                          .match({
                            owner_user_id: toSendData.id,
                            connected_user_id: userData?.cubidData?.id,
                          });
                        toast.success("Contact removed!");
                      } catch (err) {
                        console.error("remove contact error", err);
                      }
                    }}
                  >
                    No
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmTransactionModal({
  tcoinAmount,
  cadAmount,
  toSendData,
  closeModal,
  sendMoney,
  setExplorerLink,
}: {
  tcoinAmount: string;
  cadAmount: string;
  toSendData: Hypodata;
  closeModal: () => void;
  sendMoney: (amount: string) => Promise<string>;
  setExplorerLink: (link: string | null) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { userData } = useAuth();
  const formattedTcoin = formatTcoinDisplay(tcoinAmount) || "0.00 TCOIN";
  const formattedCad = formatCadDisplay(cadAmount) || "$0.00";

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-bold">Confirm Transaction</h3>
      <div className="space-y-2">
        <p>Amount: {formattedTcoin} ({formattedCad} CAD)</p>
        <p>Recipient: {toSendData?.full_name}</p>
      </div>
      <div className="flex gap-4">
        <Button variant="outline" className="flex-1" onClick={closeModal}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={isLoading}
          onClick={async () => {
            setIsLoading(true);
            try {
              const hash = await sendMoney(tcoinAmount);
              insertSuccessNotification({
                user_id: userData?.cubidData?.id,
                notification: `You sent ${tcoinAmount}`,
              });
              insertSuccessNotification({
                user_id: toSendData.id,
                notification: `You received ${tcoinAmount}`,
              });
              setExplorerLink(`https://evm-testnet.flowscan.io/tx/${hash}`);
              toast.success("Payment Sent Successfully!");
            } catch (error) {
              toast.error("Error sending payment!");
            } finally {
              setIsLoading(false);
              closeModal();
            }
          }}
        >
          {isLoading ? (
            <>
              <span className="animate-spin inline-block w-4 h-4 border-2 border-t-2 border-white rounded-full mr-2"></span>
              Sending...
            </>
          ) : (
            <>
              <LuSend className="mr-2 h-4 w-4" /> Send Now
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
