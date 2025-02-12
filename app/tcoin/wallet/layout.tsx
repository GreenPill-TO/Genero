'use client';
import { ModalProvider } from "@shared/contexts/ModalContext";
import DarkModeProvider from "@shared/providers/dark-mode-provider";
import { ReactQueryProvider } from "@shared/providers/react-query-provider";
import "@tcoin/wallet/styles/app.scss";
import type { Metadata } from "next";
import ContentLayout from "./ContentLayout";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';



const Provider = dynamic(
  () => import('cubid-sdk').then((mod) => mod.Provider),
  { ssr: false }
);
const WalletCubidProvider = dynamic(
  () => import('cubid-wallet').then((mod) => mod.WalletCubidProvider),
  { ssr: false }
);
import 'cubid-wallet/dist/styles.css'
import 'cubid-sdk/dist/index.css'

const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          <Provider>
            <WalletCubidProvider>
              <ReactQueryProvider>
                <DarkModeProvider>
                  <ModalProvider>
                    <ContentLayout>{children}</ContentLayout>
                  </ModalProvider>
                </DarkModeProvider>
              </ReactQueryProvider>
            </WalletCubidProvider>
          </Provider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
