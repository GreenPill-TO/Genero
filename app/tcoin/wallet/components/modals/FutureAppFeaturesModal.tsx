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
import {
  walletBadgeClass,
  walletPanelMutedClass,
  walletSectionLabelClass,
} from "@tcoin/wallet/components/dashboard/authenticated-ui";

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
      <div className="space-y-2">
        <span className={walletBadgeClass}>Preview</span>
        <p className="text-sm text-muted-foreground">
          These concepts are still powered by illustrative sample data. They help us evaluate which insights deserve a permanent home later.
        </p>
      </div>

      <section className={walletPanelMutedClass}>
        <p className={walletSectionLabelClass}>Balance trend</p>
        <p className="mt-2 text-sm text-muted-foreground">
          A future view for showing how wallet balance changes over time at a glance.
        </p>
        <div className="mt-4 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={balanceHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="balance" stroke="#0f7d84" strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className={walletPanelMutedClass}>
        <p className={walletSectionLabelClass}>Charity mix over time</p>
        <p className="mt-2 text-sm text-muted-foreground">
          A reporting concept for showing how contributions shift across causes.
        </p>
        <div className="mt-4 h-56 w-full">
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
                stroke="#0f7d84"
                fill="#0f7d84"
              />
              <Area
                type="monotone"
                dataKey="TheFoodBank"
                stackId="1"
                stroke="#74b5a0"
                fill="#74b5a0"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
