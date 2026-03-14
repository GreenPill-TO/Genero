import React from "react";
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

const balanceHistory = [
  { date: "2023-06-01", balance: 800 },
  { date: "2023-06-15", balance: 950 },
  { date: "2023-06-30", balance: 1100 },
  { date: "2023-07-15", balance: 1000 },
  { date: "2023-07-30", balance: 1200 },
];

const charityContributionData = [
  { date: "2023-05-01", TheShelter: 10, TheFoodBank: 0 },
  { date: "2023-06-01", TheShelter: 15, TheFoodBank: 0 },
  { date: "2023-07-01", TheShelter: 20, TheFoodBank: 5 },
  { date: "2023-08-01", TheShelter: 18, TheFoodBank: 12 },
  { date: "2023-09-01", TheShelter: 22, TheFoodBank: 18 },
];

export function FutureAppFeaturesModal() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        These are future dashboard features currently powered by illustrative sample data.
      </p>

      <section>
        <h3 className="text-sm font-semibold">Balance Trend (Preview)</h3>
        <div className="mt-2 h-56 w-full">
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
      </section>

      <section>
        <h3 className="text-sm font-semibold">Charity Mix Over Time (Preview)</h3>
        <div className="mt-2 h-56 w-full">
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
      </section>
    </div>
  );
}

