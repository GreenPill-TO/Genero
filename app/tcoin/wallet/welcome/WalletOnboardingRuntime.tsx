"use client";

import dynamic from "next/dynamic";
import { WalletConnectErrorGuard } from "@shared/providers/walletconnect-error-guard";
import "cubid-wallet/dist/styles.css";
import "cubid-sdk/dist/index.css";

const Provider = dynamic(
  () => import("cubid-sdk").then((mod) => mod.Provider),
  { ssr: false }
);

const WalletCubidProvider = dynamic(
  () => import("cubid-wallet").then((mod) => mod.WalletCubidProvider),
  { ssr: false }
);

export default function WalletOnboardingRuntime({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <WalletConnectErrorGuard />
      <Provider>
        <WalletCubidProvider>{children}</WalletCubidProvider>
      </Provider>
    </>
  );
}
