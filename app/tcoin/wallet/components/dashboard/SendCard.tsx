import React, { useEffect, useState } from "react";
import { LuSend } from "react-icons/lu";
import { toast } from "react-toastify";
import { useAuth } from "@shared/api/hooks/useAuth";
import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { Input } from "@shared/components/ui/Input";
import { Switch } from "@shared/components/ui/Switch";
import { useModal } from "@shared/contexts/ModalContext";
import { createClient } from "@shared/lib/supabase/client";
import { insertSuccessNotification } from "@shared/utils/insertNotification";
import { Hypodata } from "./types";

interface SendCardProps {
  sendMoney: (amount: string) => Promise<string>;
  toSendData: Hypodata | null;
  setToSendData: (data: Hypodata | null) => void;
  tcoinAmount: string;
  cadAmount: string;
  handleTcoinChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  explorerLink: string | null;
  setExplorerLink: (link: string | null) => void;
  setTcoin: any;
  setCad: any;
  userBalance: number;
  locked?: boolean;
}

export function SendCard({
  toSendData,
  setToSendData,
  tcoinAmount,
  cadAmount,
  handleTcoinChange,
  handleCadChange,
  explorerLink,
  setExplorerLink,
  setTcoin,
  sendMoney,
  setCad,
  userBalance,
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
  const amountLocked = locked &&
    ((isCadInput ? cadAmount : tcoinAmount) !== "0" && (isCadInput ? cadAmount : tcoinAmount) !== "");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay / Send</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {toSendData ? (
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
        ) : (
          <div className="p-4 mt-4 bg-gray-800 rounded-lg shadow-lg border border-gray-700 text-center">
            <p className="text-sm text-gray-400">No recipient selected</p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-end items-center gap-2">
            <span className="text-xs">CAD</span>
            <Switch
              checked={isCadInput}
              onCheckedChange={(v) => setIsCadInput(v)}
              aria-label="Toggle CAD input"
            />
          </div>
          {isCadInput ? (
            <>
              <Input
                className="w-full text-4xl"
                elSize="md"
                name="cad"
                value={cadAmount}
                onChange={amountLocked ? undefined : handleCadChange}
                readOnly={amountLocked}
                placeholder="Enter CAD amount"
              />
              <p className="text-sm text-muted-foreground">
                {tcoinAmount || "0"} TCOIN
              </p>
            </>
          ) : (
            <>
              <Input
                className="w-full text-4xl"
                elSize="md"
                name="tcoin"
                value={tcoinAmount}
                onChange={amountLocked ? undefined : handleTcoinChange}
                readOnly={amountLocked}
                placeholder="Enter TCOIN amount"
              />
              <p className="text-sm text-muted-foreground">
                {cadAmount || "0"} CAD
              </p>
            </>
          )}
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
      </CardContent>
    </Card>
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

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-bold">Confirm Transaction</h3>
      <div className="space-y-2">
        <p>Amount: {tcoinAmount} TCOIN ({cadAmount} CAD)</p>
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
