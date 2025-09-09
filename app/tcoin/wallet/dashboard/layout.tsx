"use client";

import { ThemeProvider } from "@shared/providers/theme-provider";
import "@tcoin/wallet/styles/app.scss";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

