"use client";

import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { Input } from "@shared/components/ui/Input";
import { Label } from "@shared/components/ui/Label";
import { Switch } from "@shared/components/ui/Switch";
import { TabContent, Tabs, TabTrigger } from "@shared/components/ui/Tabs";
import { useModal } from "@shared/contexts/ModalContext";
import { CharitySelectModal, ContactSelectModal, OffRampModal, QrScanModal, ShareQrModal, TopUpModal } from "../../../../../shared/components/modals";
import { useState } from "react";
import { LuCamera, LuCreditCard, LuDollarSign, LuQrCode, LuSend, LuShare2, LuUsers } from "react-icons/lu";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

export function MobileWalletDashboardComponent() {
  const { openModal, closeModal } = useModal();
  const [balance, setBalance] = useState(1000);
  const [qrTcoinAmount, setQrTcoinAmount] = useState("");
  const [qrCadAmount, setQrCadAmount] = useState("");
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

  const convertToCad = (tcoin: number) => (tcoin * exchangeRate).toFixed(2);
  const convertToTcoin = (cad: number) => (cad / exchangeRate).toFixed(2);

  const formatNumber = (value: string, isCad: boolean) => {
    const num = parseFloat(value.replace(/[^\d.]/g, ""));
    if (isNaN(num)) return isCad ? "$0.00" : "0.00 TCOIN";
    const formatted = num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return isCad ? `$${formatted}` : `${formatted} TCOIN`;
  };

  const handleAmountChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setCadAmount: React.Dispatch<React.SetStateAction<string>>,
    setTcoinAmount: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const { name, value } = e.target;
    const numericValue = value.replace(/[^\d.]/g, "");
    if (name === "tcoin") {
      setTcoinAmount(formatNumber(numericValue, false));
      setCadAmount(formatNumber(convertToCad(parseFloat(numericValue)), true));
    } else {
      setCadAmount(formatNumber(numericValue, true));
      setTcoinAmount(formatNumber(convertToTcoin(parseFloat(numericValue)), false));
    }
  };

  const handleQrAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numericValue = value.replace(/[^\d.]/g, "");
    if (name === "qrTcoin") {
      setQrTcoinAmount(formatNumber(numericValue, false));
      setQrCadAmount(formatNumber(convertToCad(parseFloat(numericValue)), true));
    } else {
      setQrCadAmount(formatNumber(numericValue, true));
      setQrTcoinAmount(formatNumber(convertToTcoin(parseFloat(numericValue)), false));
    }
  };

  return (
    <div className="container mx-auto sm:p-4 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  className="p-0 ml-2 h-auto font-normal text-blue-500"
                  onClick={() => {
                    openModal({
                      content: (
                        <CharitySelectModal closeModal={closeModal} selectedCharity={selectedCharity} setSelectedCharity={setSelectedCharity} />
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
              <p>All users to all charities: {charityData.allUsersToAllCharities} TCOIN</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <LuQrCode className="mx-auto h-32 w-32" />
              <p className="mt-2 qr-code-text">Your default QR code (unspecified amount)</p>
            </div>
            <div className="space-y-2">
              <Input
                name="qrTcoin"
                elSize="md"
                className="w-full"
                value={qrTcoinAmount}
                onChange={handleQrAmountChange}
                placeholder="Enter TCOIN amount"
              />
              <Input name="qrCad" elSize="md" className="w-full" value={qrCadAmount} onChange={handleQrAmountChange} placeholder="Enter CAD amount" />
              <Button
                onClick={() => {
                  console.log("Update QR for", qrTcoinAmount);
                  const qrTextElement = document.querySelector(".qr-code-text");
                  if (qrTextElement) {
                    qrTextElement.textContent = `QR code for ${qrTcoinAmount}`;
                  }
                }}
                className="w-full"
              >
                Update QR Code
              </Button>
            </div>
            <div className="flex flex-col space-y-4 sm:space-x-2 sm:space-y-0 sm:flex-row">
              <Button
                className="flex-1"
                onClick={() => {
                  openModal({
                    content: <ContactSelectModal closeModal={closeModal} amount={qrTcoinAmount} method="Request" />,
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

        <Card>
          <CardHeader>
            <CardTitle>Pay / Send</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full"
              onClick={() => {
                openModal({
                  content: <QrScanModal closeModal={closeModal} />,
                  title: "Scan QR to Pay",
                  description: "Use your device's camera to scan a QR code for payment.",
                });
              }}
            >
              <LuCamera className="mr-2 h-4 w-4" /> Scan QR to Pay
            </Button>
            <div className="space-y-2">
              <Input
                className="w-full"
                elSize="md"
                name="tcoin"
                value={tcoinAmount}
                onChange={(e) => handleAmountChange(e, setCadAmount, setTcoinAmount)}
                placeholder="Enter TCOIN amount"
              />
              <Input
                name="cad"
                elSize="md"
                className="w-full"
                value={cadAmount}
                onChange={(e) => handleAmountChange(e, setCadAmount, setTcoinAmount)}
                placeholder="Enter CAD amount"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                openModal({
                  content: <ContactSelectModal closeModal={closeModal} amount={tcoinAmount} method="Send" />,
                  title: "Send to Contact",
                  description: "Select a contact to send TCOIN to.",
                });
              }}
            >
              <LuSend className="mr-2 h-4 w-4" /> Send to Contact
            </Button>
          </CardContent>
        </Card>

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
                  <p className="text-4xl font-bold">{formatNumber(balance.toString(), false)}</p>
                  <p className="text-xl">{formatNumber(convertToCad(balance), true)}</p>
                </div>
              </TabContent>
              <TabTrigger name="tab_insight" ariaLabel="Transactions" />
              <TabContent>
                <div className="flex items-center space-x-2 mb-4">
                  <Switch id="currency-toggle" checked={showAmountInCad} onCheckedChange={setShowAmountInCad} />
                  <Label htmlFor="currency-toggle">Show amounts in {showAmountInCad ? "CAD" : "TCOIN"}</Label>
                </div>
                <ul className="space-y-2">
                  {recentTransactions.map((transaction) => (
                    <li key={transaction.id} className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{transaction.type}</p>
                        <p className="text-sm text-gray-500">{transaction.from ? `From: ${transaction.from}` : `To: ${transaction.to}`}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${transaction.type === "Received" ? "text-green-600" : "text-red-600"}`}>
                          {transaction.type === "Received" ? "+" : "-"}
                          {showAmountInCad
                            ? formatNumber(convertToCad(transaction.amount), true)
                            : formatNumber(transaction.amount.toString(), false)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Charity:{" "}
                          {showAmountInCad
                            ? formatNumber((transaction.amount * 0.03 * exchangeRate).toString(), true)
                            : formatNumber((transaction.amount * 0.03).toString(), false)}
                        </p>
                        <p className="text-sm text-gray-500">{transaction.date}</p>
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
                      <Area type="monotone" dataKey="TheShelter" stackId="1" stroke="#8884d8" fill="#8884d8" />
                      <Area type="monotone" dataKey="TheFoodBank" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </TabContent>
            </Tabs>
          </CardContent>
        </Card>

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
                <LuDollarSign className="mr-2 h-4 w-4" /> Convert TCOIN to CAD and Off-ramp
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
