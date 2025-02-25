import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { Input } from "@shared/components/ui/Input";
import { Label } from "@shared/components/ui/Label";
import { Switch } from "@shared/components/ui/Switch";
import { useModal } from "@shared/contexts/ModalContext";
import {
  CharitySelectModal,
  ContactSelectModal,
  OffRampModal,
  QrScanModal,
  ShareQrModal,
  // Note: The TopUpModal is defined below.
} from "@tcoin/sparechange/components/modals";
import {
  LuCamera,
  LuCreditCard,
  LuDollarSign,
  LuSend,
  LuShare2,
  LuUsers,
} from "react-icons/lu";
import { FiCopy } from 'react-icons/fi'
import { FiUser } from "react-icons/fi";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import QRCode from "react-qr-code";
import { toast } from "react-toastify";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import useDarkMode from "@shared/hooks/useDarkMode";
import { createClient } from "@shared/lib/supabase/client";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { insertSuccessNotification } from "@shared/utils/insertNotification";

// ---------------- Sample Data ----------------
const balanceHistory = [
  { date: "2023-06-01", balance: 800 },
  { date: "2023-06-15", balance: 950 },
  { date: "2023-06-30", balance: 1100 },
  { date: "2023-07-15", balance: 1000 },
  { date: "2023-07-30", balance: 1200 },
];

const recentTransactions = [
  { id: 1, type: "Received", amount: 100, from: "Alice", date: "2023-07-30" },
  { id: 2, type: "Sent", amount: 50, to: "Bob", date: "2023-07-29" },
  { id: 3, type: "Charity", amount: 20, to: "Save the Trees", date: "2023-07-28" },
  { id: 4, type: "Received", amount: 200, from: "Work", date: "2023-07-27" },
  { id: 5, type: "Sent", amount: 30, to: "Coffee Shop", date: "2023-07-26" },
];

const charityContributionData = [
  { date: "2023-05-01", TheShelter: 10, TheFoodBank: 0 },
  { date: "2023-06-01", TheShelter: 15, TheFoodBank: 0 },
  { date: "2023-07-01", TheShelter: 20, TheFoodBank: 5 },
  { date: "2023-08-01", TheShelter: 18, TheFoodBank: 12 },
  { date: "2023-09-01", TheShelter: 22, TheFoodBank: 18 },
];

// ---------------- Interface ----------------
export interface Hypodata {
  id: number;
  cubid_id: string;
  username: string;
  email: string;
  phone: string;
  persona: string;
  created_at: string;
  has_completed_intro: boolean;
  auth_user_id: string;
  is_new_user: boolean | null;
  cubid_score: number | null;
  cubid_identity: unknown;
  cubid_score_details: unknown;
  updated_at: string;
  current_step: number;
  full_name: string;
  bio: string;
  profile_image_url: string | null;
  preferred_donation_amount: number;
  selected_cause: string;
  good_tip: number;
  default_tip: number;
  address: string;
  category: string;
}

// ---------------- Reusable Card Components ----------------

// Contributions Card
function ContributionsCard({
  selectedCharity,
  setSelectedCharity,
  charityData,
  openModal,
  closeModal,
}: {
  selectedCharity: string;
  setSelectedCharity: (charity: string) => void;
  charityData: {
    personalContribution: number;
    allUsersToCharity: number;
    allUsersToAllCharities: number;
  };
  openModal: any;
  closeModal: any;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Charitable Contributions</CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="space-y-2 relative h-full">
          <p>
            My default charity: <strong>{selectedCharity}</strong>
          </p>
          <p>
            My contribution to {selectedCharity}: {charityData.personalContribution} TCOIN
          </p>
          <p>
            All users to {selectedCharity}: {charityData.allUsersToCharity} TCOIN
          </p>
          <p>
            All users to all charities: {charityData.allUsersToAllCharities} TCOIN
          </p>
        </div>
        <Button
          variant="default"
          className="py-1 h-auto bottom-0 left-0 font-normal"
          onClick={() => {
            openModal({
              content: (
                <CharitySelectModal
                  closeModal={closeModal}
                  selectedCharity={selectedCharity}
                  setSelectedCharity={setSelectedCharity}
                />
              ),
              title: "Change Default Charity",
              description: "Select a new default charity for your contributions.",
            });
          }}
        >
          Change
        </Button>
      </CardContent>
    </Card>
  );
}

function ReceiveCard({
  qrCodeData,
  qrTcoinAmount,
  qrCadAmount,
  handleQrTcoinChange,
  handleQrCadChange,
  openModal,
  closeModal,
  senderWallet
}: {
  qrCodeData: string;
  qrTcoinAmount: string;
  qrCadAmount: string;
  handleQrTcoinChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleQrCadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  openModal: any;
  closeModal: any;
  senderWallet: string;
}) {
  const { isDarkMode } = useDarkMode();
  const { ...rest } = useTokenBalance(senderWallet);
  const formatNumber = (value: string, isCad: boolean) => {
    const num = parseFloat(value);
    if (isNaN(num)) return isCad ? "$0.00" : "0.00 TCOIN";
    const formatted = num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return isCad ? `$${formatted}` : `${formatted} TCOIN`;
  };
  const balance = formatNumber(rest.balance.toString(), false);

  // Function to validate the amount before proceeding
  const handleRequestClick = () => {
    const requestedAmount = parseFloat(qrTcoinAmount);
    const availableBalance = parseFloat(rest.balance);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    if (requestedAmount > availableBalance) {
      alert("The amount to request exceeds your available balance.");
      return;
    }
    openModal({
      content: (
        <ContactSelectModal
          setToSendData={handleQrTcoinChange}
          closeModal={closeModal}
          amount={qrTcoinAmount}
          method="Request" />
      ),
      title: "Request from Contact",
      description: "Select a contact to request TCOIN from.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receive</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 mt-[-10px]">
        <p>{(Boolean(qrTcoinAmount) && qrTcoinAmount !== '0.00 TCOIN') ? `Receive ${qrTcoinAmount}` : "Receive any amount"}</p>
        <div className="relative flex flex-col items-center justify-center p-2 rounded-xl transform transition duration-500 hover:scale-105">
          {qrCodeData ? (
            <QRCode
              value={qrCodeData}
              size={250}
              bgColor="transparent"
              fgColor={isDarkMode ? "#fff" : "#000"}
            />
          ) : (
            <p className="text-white">Loading QR Code...</p>
          )}
        </div>
        <div className="space-y-2">
          <Input
            name="qrTcoin"
            elSize="md"
            className="w-full"
            value={qrTcoinAmount}
            onChange={handleQrTcoinChange}
            placeholder="Enter TCOIN amount"
          />
          <Input
            name="qrCad"
            elSize="md"
            className="w-full"
            value={qrCadAmount}
            onChange={handleQrCadChange}
            placeholder="Enter CAD amount"
          />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button
            className="flex-1"
            onClick={handleRequestClick}
          >
            <LuUsers className="mr-2 h-4 w-4" /> Request from Contact
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              openModal({
                content: <ShareQrModal qrCodeData={qrCodeData} closeModal={closeModal} />,
                title: "Share QR Code",
                description: "Share your QR code via different methods.",
              });
            }}
          >
            <LuShare2 className="mr-2 h-4 w-4" /> Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Send Card
const ConfirmTransactionModal = ({
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
}) => {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-bold">Confirm Transaction</h3>
      <div className="space-y-2">
        <p>
          Amount: {tcoinAmount} TCOIN ({cadAmount} CAD)
        </p>
        <p>Recipient: {toSendData.full_name}</p>
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
              insertSuccessNotification({ user_id: toSendData.id, notification: `You received ${tcoinAmount}` })
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
};

// Main SendCard component
function SendCard({
  toSendData,
  setToSendData,
  tcoinAmount,
  cadAmount,
  handleTcoinChange,
  handleCadChange,
  openModal,
  closeModal,
  explorerLink,
  setExplorerLink,
  setTcoin,
  sendMoney,
  setCad,
}: {
  sendMoney: any;
  toSendData: Hypodata | null;
  setToSendData: (data: Hypodata | null) => void;
  tcoinAmount: string;
  cadAmount: string;
  handleTcoinChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  openModal: (modalData: { content: JSX.Element; title: string; description?: string }) => void;
  closeModal: () => void;
  explorerLink: string | null;
  setExplorerLink: (link: string | null) => void;
  setTcoin: any;
  setCad: any;
}) {

  const [connections, setConnections] = useState(null)

  useEffect(() => {
    if (toSendData?.id) {
      const fetchConnections = async () => {
        const supabase = createClient();
        const { data } = await supabase.from("connections").select("*").match({ connected_user_id: toSendData?.id, }).neq("state", 'new')
        setConnections(data?.[0])
      }
      fetchConnections()
    }
  }, [toSendData])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay / Send</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* If no recipient is selected, show two options */}
        {!toSendData && (
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={() => {
                openModal({
                  content: (
                    <QrScanModal
                      setTcoin={setTcoin}
                      setCad={setCad}
                      setToSendData={setToSendData}
                      closeModal={closeModal}
                    />
                  ),
                  title: "Scan QR to Pay",
                  description: "Use your device's camera to scan a QR code for payment.",
                });
              }}
            >
              <LuCamera className="mr-2 h-4 w-4" /> Scan QR to Pay
            </Button>
            <Button
              className="w-full"
              onClick={() => {
                openModal({
                  content: (
                    <ContactSelectModal
                      closeModal={closeModal}
                      setToSendData={setToSendData}
                      method={"Send"}
                    // Additional props to fetch contacts from the connections table can be added here.
                    />
                  ),
                  title: "Select Contact to Pay",
                  description: "Choose a contact from your connections to send TCOIN to.",
                });
              }}
            >
              <LuUsers className="mr-2 h-4 w-4" /> Select Contact to Pay
            </Button>
          </div>
        )}

        {/* Display recipient details if available */}
        {toSendData && (
          <div className="p-4 mt-4 bg-gray-800 rounded-lg shadow-lg border border-gray-700 relative">
            <button
              onClick={() => {
                setToSendData(null);
                setExplorerLink(null);
              }}
              className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white"
            >
              ✕
            </button>
            <div className="flex items-center">
              {toSendData.profile_image_url ? (
                <img
                  src={toSendData.profile_image_url}
                  alt={toSendData.full_name}
                  className="w-16 h-16 rounded-full"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {toSendData.full_name ? toSendData.full_name.charAt(0) : "?"}
                  </span>
                </div>
              )}
              <div className="ml-4">
                <h3 className="text-xl font-semibold text-white">{toSendData.full_name}</h3>
                <p className="text-sm text-gray-400">@{toSendData.username}</p>
              </div>
            </div>
          </div>
        )}

        {/* If recipient exists, show amount inputs and send button */}
        {toSendData && (
          <>
            <div className="space-y-2">
              <Input
                className="w-full"
                elSize="md"
                name="tcoin"
                value={tcoinAmount}
                onChange={handleTcoinChange}
                placeholder="Enter TCOIN amount"
              />
              <Input
                name="cad"
                elSize="md"
                className="w-full"
                value={cadAmount}
                onChange={handleCadChange}
                placeholder="Enter CAD amount"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
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
          </>
        )}

        {/* Show success message with explorer link */}
        {explorerLink && (
          <div className="p-4 bg-green-900/20 rounded-lg">
            <div className="text-center space-y-4">
              {explorerLink && (
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
              )}
              {!connections?.[0] && (
                <div className="pt-4 border-t border-gray-700">
                  <p>Add to Contacts?</p>
                  <div className="flex justify-center gap-4 mt-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        toast.success("Contact added!");
                      }}
                    >
                      Yes
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setExplorerLink(null)}>
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

function AccountCard({
  balance,
  openModal,
  closeModal,
  senderWallet,
}: {
  balance: number;
  openModal: any;
  closeModal: any;
  senderWallet: string;
}) {
  const [activeAccountTab, setActiveAccountTab] = useState("balance");
  const { ...rest } = useTokenBalance(senderWallet);

  // Simple conversion and formatting helpers
  const convertToCad = (tcoin: number) => (tcoin * 3.3).toFixed(2);
  const formatNumber = (value: string, isCad: boolean) => {
    const num = parseFloat(value);
    if (isNaN(num)) return isCad ? "$0.00" : "0.00 TCOIN";
    const formatted = num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return isCad ? `$${formatted}` : `${formatted} TCOIN`;
  };

  // Helper to shorten wallet address: show first 6 and last 4 characters.
  const shortenedAddress = (address: string) => {
    if (address?.length <= 10) return address;
    return `${address?.substring(0, 6)}...${address?.substring(address.length - 4)}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(senderWallet)
      .then(() => {
        alert('Wallet address copied to clipboard!');
      })
      .catch((error) => {
        console.error('Copy failed:', error);
      });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Account</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {/* Inner Tabs */}
        <div className="flex justify-around mb-4">
          {[
            { key: "balance", label: "Balance" },
            { key: "graph", label: "Graph" },
            { key: "transactions", label: "Transactions" },
            { key: "charity", label: "Charity" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveAccountTab(tab.key)}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${activeAccountTab === tab.key
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Inner Tab Content */}
        <div>
          {activeAccountTab === "graph" && (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={balanceHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="balance" stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {activeAccountTab === "balance" && (
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Your Balance</h2>
              <div className="flex justify-center items-center space-x-2 mb-1">
                <span className="text-md break-all font-bold" title={senderWallet}>
                  {`Wallet: ${shortenedAddress(senderWallet)}`}
                </span>
                <button onClick={handleCopy} title="Copy wallet address">
                  <FiCopy className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              <a
                href={`https://explorer.example.com/address/${senderWallet}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 underline mb-3 block"
              >
                View on Explorer
              </a>
              <p className="text-4xl font-bold">
                {formatNumber(rest.balance.toString(), false)}
              </p>
              <p className="text-xl">
                {formatNumber(convertToCad(rest.balance), true)} CAD
              </p>
            </div>
          )}
          {activeAccountTab === "transactions" && (
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Switch id="currency-toggle" onCheckedChange={() => { }} />
                <Label htmlFor="currency-toggle">Show amounts in CAD</Label>
              </div>
              <ul className="space-y-2">
                {recentTransactions.map((transaction) => (
                  <li
                    key={transaction.id}
                    className="flex justify-between items-center border-b border-gray-700 pb-2"
                  >
                    <div>
                      <p className="font-semibold">{transaction.type}</p>
                      <p className="text-sm text-gray-500">
                        {transaction.from
                          ? `From: ${transaction.from}`
                          : `To: ${transaction.to}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${transaction.type === "Received" ? "text-green-600" : "text-red-600"
                          }`}
                      >
                        {transaction.type === "Received" ? "+" : "-"}
                        {formatNumber(transaction.amount.toString(), false)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Charity: {formatNumber((transaction.amount * 0.03).toString(), false)}
                      </p>
                      <p className="text-sm text-gray-500">{transaction.date}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {activeAccountTab === "charity" && (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charityContributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="TheShelter"
                    stackId="1"
                    stroke="#8884d8"
                    fill="#8884d8"
                  />
                  <Area
                    type="monotone"
                    dataKey="TheFoodBank"
                    stackId="1"
                    stroke="#82ca9d"
                    fill="#82ca9d"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Other Card
function OtherCard({ openModal, closeModal }: { openModal: any; closeModal: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Other</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button
            className="w-full"
            onClick={() => {
              openModal({
                content: <TopUpModal closeModal={closeModal} />,
                title: "Top Up with Interac eTransfer",
                description: "Send an Interac eTransfer to top up your TCOIN Balance.",
              });
            }}
          >
            <LuCreditCard className="mr-2 h-4 w-4" /> Top Up with Interac eTransfer
          </Button>
          <Button
            className="w-full"
            onClick={() => {
              openModal({
                content: <OffRampModal closeModal={closeModal} />,
                title: "Convert and Off-ramp",
                description: "Convert your TCOIN to CAD and transfer to your bank account.",
              });
            }}
          >
            <LuDollarSign className="mr-2 h-4 w-4" /> Convert to CAD and Cash Out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------- Updated TopUpModal Component ----------------

// Helper to generate a reference code. The first part is fixed while the second part is randomly generated.
const generateReferenceCode = () => {
  const base = "TCOIN-REF"; // fixed beginning part
  const randomPart = Math.floor(100000 + Math.random() * 900000); // new 6-digit number
  return `${base}-${randomPart}`;
};

export function TopUpModal({ closeModal }) {
  // "input", "confirmation", or "final" steps
  const [step, setStep] = useState("input");
  const [amount, setAmount] = useState("");
  const [refCode, setRefCode] = useState(generateReferenceCode());
  const { userData } = useAuth();
  const supabase = createClient();

  // Move to confirmation if a valid amount is entered.
  const handleNext = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    await supabase.from("interac_transfer").insert({
      user_id: userData?.cubidData?.id,
      interac_code: refCode,
      is_sent: false,
      amount: amount,
    });
    setStep("confirmation");
  };

  // Go back to the amount entry view.
  const handleBack = () => {
    setStep("input");
  };

  // Close the modal without saving.
  const handleCancel = () => {
    closeModal();
  };

  // Simulate saving the top up info and generate a new reference code.
  const handleConfirm = async () => {
    try {
      // Replace with your actual API call.
      await supabase
        .from("interac_transfer")
        .update({ is_sent: true })
        .match({ interac_code: refCode });
      toast.success("Top up recorded successfully!");
      insertSuccessNotification({ user_id: userData?.cubidData.id, notification: `${amount} topped up successfully into Tcoin Wallet` })
      setRefCode(generateReferenceCode());
      // Instead of closing immediately, move to the final confirmation screen.
      setStep("final");
    } catch (error) {
      toast.error("Failed to record top up. Please try again.");
    }
  };

  return (
    <div className="p-4 pb-0 space-y-6">
      {step === "input" && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Top Up via Interac eTransfer</h3>
          <h3 className="text-sm font-bold">Tcoin Balance to Topup</h3>
          <div className="justify-between flex w-full">
            <Input
              type="number"
              placeholder="Enter amount to send"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div>
              <Button onClick={handleNext}>Next</Button>
            </div>
          </div>
          {Boolean(amount) && (
            <div className="mb-4">
              {amount * 3.3} CAD
            </div>
          )}
        </div>
      )}

      {step === "confirmation" && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Confirm Top Up</h3>
          <p>
            <strong>Amount:</strong> {amount}
          </p>
          <p>
            <strong>Amount in CAD:</strong> {amount * 3.3}
          </p>
          <p>
            <strong>Reference Code:</strong> {refCode}
          </p>
          <p>
            <strong>eTransfer money to:</strong> support@tcoin.com
          </p>
          <p className="text-sm text-gray-500">
            Make sure you have a confirmation from your bank that the money has been sent before finalizing here.
          </p>
          <div className="flex gap-4">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>I have sent it</Button>
          </div>
        </div>
      )}

      {step === "final" && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Thank You!</h3>
          <p>Thank you! Check back here in 24 hours when the TCOIN balance should be updated.</p>
          <div className="flex justify-end">
            <Button onClick={closeModal}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}


// ---------------- Main Component ----------------

export function MobileWalletDashboardComponent() {
  // Active tab for mobile view.
  const [activeTab, setActiveTab] = useState("contributions");
  const tabs = [
    { key: "contributions", label: "Contributions", icon: LuUsers },
    { key: "receive", label: "Receive", icon: LuShare2 },
    { key: "send", label: "Send", icon: LuSend },
    { key: "account", label: "My Account", icon: FiUser },
    { key: "other", label: "Other", icon: LuCreditCard },
  ];

  const { openModal, closeModal } = useModal();
  const { userData } = useAuth();
  const [balance, setBalance] = useState(1000);

  // States for QR and send amounts.
  const [qrTcoinAmount, setQrTcoinAmount] = useState("");
  const [qrCadAmount, setQrCadAmount] = useState("");
  const [tcoinAmount, setTcoinAmount] = useState("");
  const [cadAmount, setCadAmount] = useState("");

  const [selectedCharity, setSelectedCharity] = useState("");

  useEffect(() => {
    if (userData?.cubidData?.charity) {
      setSelectedCharity(userData?.cubidData?.charity);
    }
  }, [userData]);

  const exchangeRate = 3.3;
  const [charityData, setCharityData] = useState({
    personalContribution: 50,
    allUsersToCharity: 600,
    allUsersToAllCharities: 7000,
  });

  const user_id = userData?.cubidData.id;
  const nano_id = userData?.cubidData.user_identifier;

  // QR Code data setup.
  const [qrCodeData, setQrCodeData] = useState(
    user_id ? JSON.stringify({ nano_id, timestamp: Date.now() }) : ""
  );

  useEffect(() => {
    if (!user_id) return;
    setQrCodeData(JSON.stringify({ nano_id, timestamp: Date.now() }));
    const interval = setInterval(() => {
      setQrCodeData(JSON.stringify({ nano_id, timestamp: Date.now() }));
    }, 2000);
    return () => clearInterval(interval);
  }, [user_id, tcoinAmount]);

  function extractAndDecodeBase64(url: string) {
    try {
      const urlObj = new URL(url);
      const base64Data = urlObj.searchParams.get("pay");
      if (!base64Data) throw new Error("No Base64 data found in URL.");
      console.log({ base64Data })
      // Decode Base64 data
      const decodedData = decodeURIComponent(escape(atob(base64Data)));
      return JSON.parse(decodedData); // Assuming the data is in JSON format
    } catch (error) {
      console.error("Error decoding Base64:", error);
      return null;
    }
  }


  const handleScan = useCallback(async (data: any) => {
    const { ...rest } = extractAndDecodeBase64(data)
    console.log({ rest })
    const supabase = createClient()
    toast.success("Scanned User Successfully")
    if (rest?.nano_id) {
      const { data: userDataFromSupabaseTable } = await supabase.from("users").select("*").match({
        user_identifier: rest?.nano_id
      })
      await supabase.from("connections").insert({
        owner_user_id: (userData as any)?.cubidData?.id,
        connected_user_id: userDataFromSupabaseTable?.[0]?.id,
        state: "new"
      })

      setToSendData(userDataFromSupabaseTable?.[0])
      if (rest?.qrTcoinAmount) {
        setTcoin(rest?.qrTcoinAmount)
        setCad(extractDecimalFromString(rest?.qrTcoinAmount) * 3.3)
      }
    }

  }, []);

  useEffect(() => {
    handleScan(window.location.href)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      if (localStorage.getItem("openQR")) {
        openModal({
          content: (
            <QrScanModal
              setTcoin={setTcoinAmount}
              setCad={setCadAmount}
              setToSendData={setToSendData}
              closeModal={closeModal}
            />
          ),
          title: "Scan QR to Pay",
          description: "Use your device's camera to scan a QR code for payment.",
        });
        localStorage.removeItem("openQR")
      }
    }, 1000)
    return () => {
      clearInterval(interval)
    }
  }, [])

  // Number formatting helper.
  const formatNumber = (value: string, isCad: boolean) => {
    const num = parseFloat(value);
    if (isNaN(num)) return isCad ? "$0.00" : "0.00 TCOIN";
    const formatted = num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return isCad ? `$${formatted}` : `${formatted} TCOIN`;
  };

  // Debounce refs.
  const debounceDelay = 1000;
  const tcoinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrTcoinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrCadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTcoinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (tcoinTimeoutRef.current) clearTimeout(tcoinTimeoutRef.current);
    const rawValue = e.target.value.replace(/[^\d.]/g, "");
    setTcoinAmount(rawValue);
    const num = parseFloat(rawValue) || 0;
    const cadRaw = (num * exchangeRate).toString();
    tcoinTimeoutRef.current = setTimeout(() => {
      setTcoinAmount(formatNumber(rawValue, false));
      setCadAmount(formatNumber(cadRaw, true));
    }, debounceDelay);
  };

  const handleCadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (cadTimeoutRef.current) clearTimeout(cadTimeoutRef.current);
    const rawValue = e.target.value.replace(/[^\d.]/g, "");
    setCadAmount(rawValue);
    const num = parseFloat(rawValue) || 0;
    const tcoinRaw = (num / exchangeRate).toString();
    cadTimeoutRef.current = setTimeout(() => {
      setCadAmount(formatNumber(rawValue, true));
      setTcoinAmount(formatNumber(tcoinRaw, false));
    }, debounceDelay);
  };

  const handleQrTcoinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (qrTcoinTimeoutRef.current) clearTimeout(qrTcoinTimeoutRef.current);
    const rawValue = e.target.value.replace(/[^\d.]/g, "");
    setQrTcoinAmount(rawValue);
    const num = parseFloat(rawValue) || 0;
    const qrCadRaw = (num * exchangeRate).toString();
    qrTcoinTimeoutRef.current = setTimeout(() => {
      setQrTcoinAmount(formatNumber(rawValue, false));
      setQrCadAmount(formatNumber(qrCadRaw, true));
    }, debounceDelay);
  };

  const handleQrCadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (qrCadTimeoutRef.current) clearTimeout(qrCadTimeoutRef.current);
    const rawValue = e.target.value.replace(/[^\d.]/g, "");
    setQrCadAmount(rawValue);
    const num = parseFloat(rawValue) || 0;
    const qrTcoinRaw = (num / exchangeRate).toString();
    qrCadTimeoutRef.current = setTimeout(() => {
      setQrCadAmount(formatNumber(rawValue, true));
      setQrTcoinAmount(formatNumber(qrTcoinRaw, false));
    }, debounceDelay);
  };

  // Send Money state.
  const [toSendData, setToSendData] = useState<Hypodata | null>(null);
  const [explorerLink, setExplorerLink] = useState<string | null>(null);

  const { senderWallet, receiverWallet, sendMoney, loading, error } = useSendMoney({
    senderId: user_id,
    receiverId: toSendData?.id ?? null,
  });

  const dynamicQrData = qrTcoinAmount ? JSON.stringify({ ...JSON.parse(qrCodeData), qrTcoinAmount }) : qrCodeData;

  function base64Encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  const qrData = `https://tcoin.me?pay=${base64Encode(dynamicQrData)}`;

  // Debug logging.
  return (
    <div className="container mx-auto p-4 space-y-8">
      {/* --- Mobile View (Single Card with Tab Navigation) --- */}
      <div className="md:hidden">
        <div className="space-y-8 max-w-[400px] min-h-[60vh] mx-auto">
          {activeTab === "contributions" && (
            <ContributionsCard
              selectedCharity={selectedCharity}
              setSelectedCharity={setSelectedCharity}
              charityData={charityData}
              openModal={openModal}
              closeModal={closeModal}
            />
          )}

          {activeTab === "receive" && (
            <ReceiveCard
              qrCodeData={qrData}
              qrTcoinAmount={qrTcoinAmount}
              qrCadAmount={qrCadAmount}
              handleQrTcoinChange={handleQrTcoinChange}
              handleQrCadChange={handleQrCadChange}
              openModal={openModal}
              closeModal={closeModal}
              senderWallet={senderWallet}
            />
          )}
          {activeTab === "send" && (
            <SendCard
              toSendData={toSendData}
              setToSendData={setToSendData}
              tcoinAmount={tcoinAmount}
              cadAmount={cadAmount}
              handleTcoinChange={handleTcoinChange}
              handleCadChange={handleCadChange}
              sendMoney={sendMoney}
              setTcoin={setTcoinAmount}
              setCad={setCadAmount}
              openModal={openModal}
              closeModal={closeModal}
              explorerLink={explorerLink}
              setExplorerLink={setExplorerLink}
            />
          )}
          {activeTab === "account" && (
            <AccountCard balance={balance} senderWallet={senderWallet} openModal={openModal} closeModal={closeModal} />
          )}
          {activeTab === "other" && (
            <OtherCard openModal={openModal} closeModal={closeModal} />
          )}
        </div>

        {/* Mobile Navigation */}
        <nav className="flex px-3 mx-auto w-[fit-content] py-3 rounded-xl bg-gray-900 justify-center gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`p-2 rounded-md transition-colors ${activeTab === tab.key
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-white hover:bg-gray-300"
                }`}
              title={tab.label}
            >
              <tab.icon className="h-6 w-6" />
            </button>
          ))}
        </nav>
      </div>

      {/* --- Desktop Grid View (All Cards Visible) --- */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ContributionsCard
          selectedCharity={selectedCharity}
          setSelectedCharity={setSelectedCharity}
          charityData={charityData}
          openModal={openModal}
          closeModal={closeModal}
        />
        <ReceiveCard
          qrCodeData={qrData}
          qrTcoinAmount={qrTcoinAmount}
          qrCadAmount={qrCadAmount}
          handleQrTcoinChange={handleQrTcoinChange}
          handleQrCadChange={handleQrCadChange}
          openModal={openModal}
          closeModal={closeModal}
          senderWallet={senderWallet}
        />
        <SendCard
          toSendData={toSendData}
          setToSendData={setToSendData}
          tcoinAmount={tcoinAmount}
          cadAmount={cadAmount}
          handleTcoinChange={handleTcoinChange}
          handleCadChange={handleCadChange}
          sendMoney={sendMoney}
          setCad={setCadAmount}
          setTcoin={setTcoinAmount}
          openModal={openModal}
          closeModal={closeModal}
          explorerLink={explorerLink}
          setExplorerLink={setExplorerLink}
        />
        <AccountCard balance={balance} senderWallet={senderWallet} openModal={openModal} closeModal={closeModal} />
        <OtherCard openModal={openModal} closeModal={closeModal} />
      </div>
    </div>
  );
}