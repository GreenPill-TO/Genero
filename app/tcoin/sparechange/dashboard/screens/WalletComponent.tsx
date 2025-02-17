"use client";

import { useAuth } from "@shared/api/hooks/useAuth";
import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { Input } from "@shared/components/ui/Input";
import { Label } from "@shared/components/ui/Label";
import { Switch } from "@shared/components/ui/Switch";
import { TabContent, Tabs, TabTrigger } from "@shared/components/ui/Tabs";
import { useModal } from "@shared/contexts/ModalContext";
import {
  CharitySelectModal,
  ContactSelectModal,
  OffRampModal,
  QrScanModal,
  ShareQrModal,
  TopUpModal,
} from "@tcoin/sparechange/components/modals";
import { useState, useEffect, useRef } from "react";
import {
  LuCamera,
  LuCreditCard,
  LuDollarSign,
  LuSend,
  LuShare2,
  LuUsers,
} from "react-icons/lu";
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
import QRCode from "react-qr-code"; // Import QRCode generator
import { toast } from "react-toastify";
import { useSendMoney } from "@shared/hooks/useSendMoney";

// Sample data arrays
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

export interface Hypodata {
  id: number;
  cubid_id: string;
  username: string;
  email: string;
  phone: string;
  persona: string;
  created_at: string; // ISO formatted date string
  has_completed_intro: boolean;
  auth_user_id: string;
  is_new_user: boolean | null;
  cubid_score: number | null;
  cubid_identity: unknown;
  cubid_score_details: unknown;
  updated_at: string; // ISO formatted date string
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

export function MobileWalletDashboardComponent() {
  const { openModal, closeModal } = useModal();
  const { userData }: any = useAuth();
  const [balance, setBalance] = useState(1000);

  // --- Amount States for QR and Send Sections ---
  // For QR amounts
  const [qrTcoinAmount, setQrTcoinAmount] = useState("");
  const [qrCadAmount, setQrCadAmount] = useState("");
  // For Send amounts
  const [tcoinAmount, setTcoinAmount] = useState("");
  const [cadAmount, setCadAmount] = useState("");

  const [showAmountInCad, setShowAmountInCad] = useState(false);
  const [selectedCharity, setSelectedCharity] = useState("The FoodBank");
  const exchangeRate = 3.3;

  const [charityData, setCharityData] = useState({
    personalContribution: 50,
    allUsersToCharity: 600,
    allUsersToAllCharities: 7000,
  });

  const user_id = userData?.cubidData.id;

  // --- QR Code Data ---
  const [qrCodeData, setQrCodeData] = useState(
    user_id ? JSON.stringify({ user_id, timestamp: Date.now() }) : ""
  );

  useEffect(() => {
    if (!user_id) return;
    setQrCodeData(JSON.stringify({ user_id, timestamp: Date.now() }));
    const interval = setInterval(() => {
      setQrCodeData(JSON.stringify({ user_id, timestamp: Date.now() }));
    }, 2000);
    return () => clearInterval(interval);
  }, [user_id]);

  // --- Conversion & Formatting Functions ---
  const convertToCad = (tcoin: number) => (tcoin * exchangeRate).toFixed(2);
  const convertToTcoin = (cad: number) => (cad / exchangeRate).toFixed(2);

  // This function adds currency symbols and units.
  const formatNumber = (value: string, isCad: boolean) => {
    const num = parseFloat(value);
    if (isNaN(num)) return isCad ? "$0.00" : "0.00 TCOIN";
    const formatted = num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return isCad ? `$${formatted}` : `${formatted} TCOIN`;
  };

  // --- Debounce Delay (milliseconds) ---
  const debounceDelay = 500;

  // --- Refs for Debouncing Send Inputs ---
  const tcoinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // --- Refs for Debouncing QR Inputs ---
  const qrTcoinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrCadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const [toSendData, setToSendData] = useState<Hypodata | null>(null);
  const [explorerLink, setExplorerLink] = useState<string | null>(null);

  const { senderWallet, receiverWallet, sendMoney, loading, error } = useSendMoney({ senderId: user_id, receiverId: toSendData?.id ?? null })

  console.log({ user_id, toSendData, senderWallet, receiverWallet });

  return (
    <div className="container mx-auto sm:p-4 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Charitable Contributions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Charitable Contributions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>
                My default charity: <strong>{selectedCharity}</strong>
                <Button
                  variant="link"
                  className="p-0 ml-2 h-auto font-normal"
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
                  change
                </Button>
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
          </CardContent>
        </Card>

        {/* Receive Section */}
        <Card>
          <CardHeader>
            <CardTitle>Receive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative flex flex-col items-center justify-center p-2 rounded-xl transform transition duration-500 hover:scale-105">
              {qrCodeData ? (
                <QRCode value={qrCodeData} size={128} bgColor="transparent" fgColor="#fff" />
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
            <div className="flex flex-col space-y-4 sm:space-x-2 sm:space-y-0 sm:flex-row">
              <Button
                className="flex-1"
                onClick={() => {
                  openModal({
                    content: (
                      <ContactSelectModal
                        closeModal={closeModal}
                        amount={qrTcoinAmount}
                        method="Request"
                      />
                    ),
                    title: "Request from Contact",
                    description: "Select a contact to request TCOIN from.",
                  });
                }}
              >
                <LuUsers className="mr-2 h-4 w-4" /> Request from Contact
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  openModal({
                    content: <ShareQrModal closeModal={closeModal} />,
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

        {/* Pay / Send Section */}
        <Card>
          <CardHeader>
            <CardTitle>Pay / Send</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full"
              onClick={() => {
                openModal({
                  content: (
                    <QrScanModal setToSendData={setToSendData} closeModal={closeModal} />
                  ),
                  title: "Scan QR to Pay",
                  description: "Use your device's camera to scan a QR code for payment.",
                });
              }}
            >
              <LuCamera className="mr-2 h-4 w-4" /> Scan QR to Pay
            </Button>
            {toSendData && (
              <>
                <div className="p-4 mt-4 bg-gray-800 rounded-lg shadow-lg border border-gray-700">
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
                      <h3 className="text-xl font-semibold text-white">
                        {toSendData.full_name}
                      </h3>
                      <p className="text-sm text-gray-400">@{toSendData.username}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-300">
                        <span className="font-semibold">Email:</span> {toSendData.email}
                      </p>
                      {toSendData.phone && (
                        <p className="text-gray-300">
                          <span className="font-semibold">Phone:</span> {toSendData.phone}
                        </p>
                      )}
                    </div>
                    <div className="text-xs m-3">
                      <p className="text-gray-300">
                        <span className="font-semibold">Category:</span> {toSendData.category}
                      </p>
                      <p className="text-gray-300">
                        <span className="font-semibold">Cause:</span> {toSendData.selected_cause}
                      </p>
                      <p className="text-gray-300">
                        <span className="font-semibold">Preferred Donation:</span>{" "}
                        {toSendData.preferred_donation_amount} TCOIN
                      </p>
                    </div>
                  </div>
                </div>
                <p>How much do you want to send?</p>
              </>
            )}

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
              className={`w-full ${!Boolean(toSendData) && "opacity-50"}`}
              onClick={() => {
                if (Boolean(toSendData)) {
                  setExplorerLink("https://gnosisscan.io/tx/0x679767eea7b4cadd01b016cdd41e26b5990d729c7d0f471bd327d7584f400bdb")
                  toast.success("Success")
                }
              }}
            >
              <LuSend className="mr-2 h-4 w-4" /> Send to Contact
            </Button>
            {explorerLink && <a href={explorerLink}>Transaction Link</a>}
            {explorerLink && <>
              <div>
                Add to Contacts ?
                <div className="flex items-center space-x-2">
                  <Button>Add</Button>
                </div>
              </div>
            </>}
          </CardContent>
        </Card>

        {/* My Account Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>My Account</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto mx-6 p-0">
            <Tabs className="w-full" variant="bordered">
              <TabTrigger name="tab_insight" ariaLabel="Graph" defaultChecked />
              <TabContent>
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
              </TabContent>
              <TabTrigger name="tab_insight" ariaLabel="Balance" />
              <TabContent>
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Your Balance</h2>
                  <p className="text-4xl font-bold">
                    {formatNumber(balance.toString(), false)}
                  </p>
                  <p className="text-xl">{formatNumber(convertToCad(balance), true)}</p>
                </div>
              </TabContent>
              <TabTrigger name="tab_insight" ariaLabel="Transactions" />
              <TabContent>
                <div className="flex items-center space-x-2 mb-4">
                  <Switch
                    id="currency-toggle"
                    checked={showAmountInCad}
                    onCheckedChange={setShowAmountInCad}
                  />
                  <Label htmlFor="currency-toggle">
                    Show amounts in {showAmountInCad ? "CAD" : "TCOIN"}
                  </Label>
                </div>
                <ul className="space-y-2">
                  {recentTransactions.map((transaction) => (
                    <li
                      key={transaction.id}
                      className="flex justify-between items-center"
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
                          className={`font-semibold ${transaction.type === "Received"
                            ? "text-green-600"
                            : "text-red-600"
                            }`}
                        >
                          {transaction.type === "Received" ? "+" : "-"}
                          {showAmountInCad
                            ? formatNumber(convertToCad(transaction.amount), true)
                            : formatNumber(transaction.amount.toString(), false)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Charity:{" "}
                          {showAmountInCad
                            ? formatNumber(
                              (transaction.amount * 0.03 * exchangeRate).toString(),
                              true
                            )
                            : formatNumber(
                              (transaction.amount * 0.03).toString(),
                              false
                            )}
                        </p>
                        <p className="text-sm text-gray-500">
                          {transaction.date}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </TabContent>
              <TabTrigger name="tab_insight" ariaLabel="Charity" />
              <TabContent>
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
              </TabContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Other Options */}
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
                    description:
                      "Send an Interac eTransfer to top up your TCOIN Balance.",
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
                    description:
                      "Convert your TCOIN to CAD and transfer to your bank account.",
                  });
                }}
              >
                <LuDollarSign className="mr-2 h-4 w-4" /> Convert TCOIN to CAD and Off-ramp
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
