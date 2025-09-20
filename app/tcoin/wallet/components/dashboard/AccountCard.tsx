import React, { useState } from "react";
import { FiCopy, FiDollarSign, FiHeart, FiList, FiTrendingUp } from "react-icons/fi";
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
import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { Label } from "@shared/components/ui/Label";
import { Switch } from "@shared/components/ui/Switch";
import { useTokenBalance } from "@shared/hooks/useTokenBalance";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";

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

export function AccountCard({
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
  const { exchangeRate } = useControlVariables();

  const convertToCad = (tcoin: number) => (tcoin * exchangeRate).toFixed(2);
  const formatNumber = (value: string, isCad: boolean) => {
    const num = parseFloat(value);
    if (isNaN(num)) return isCad ? "$0.00" : "0.00 TCOIN";
    const formatted = num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return isCad ? `$${formatted}` : `${formatted} TCOIN`;
  };

  const shortenedAddress = (address: string) => {
    if (address?.length <= 10) return address;
    return `${address?.substring(0, 6)}...${address?.substring(address.length - 4)}`;
  };

  const handleCopy = () => {
    navigator.clipboard
      .writeText(senderWallet)
      .then(() => alert("Wallet address copied to clipboard!"))
      .catch((error) => console.error("Copy failed:", error));
  };

  const explorerBaseUrl =
    process.env.NEXT_PUBLIC_EXPLORER_URL ||
    "https://explorer.example.com/address/";
  const explorerHref = `${explorerBaseUrl}${senderWallet}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Account</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex justify-around mb-4">
          {[
            { key: "balance", icon: <FiDollarSign className="font-bold" />, label: "Balance" },
            { key: "graph", icon: <FiTrendingUp className="font-bold" />, label: "Graph" },
            { key: "transactions", icon: <FiList className="font-bold" />, label: "Transactions" },
            { key: "charity", icon: <FiHeart className="font-bold" />, label: "Charity" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveAccountTab(tab.key)}
              title={tab.label}
              className={`px-5 py-3 rounded-md font-bold transition-colors ${
                activeAccountTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {tab.icon}
            </button>
          ))}
        </div>

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
                href={explorerHref}
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
                <Switch id="currency-toggle" onCheckedChange={() => {}} />
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
                        className={`font-semibold ${
                          transaction.type === "Received"
                            ? "text-green-600"
                            : "text-red-600"
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
