'use client';
import { ModalProvider } from "@shared/contexts/ModalContext";
import DarkModeProvider from "@shared/providers/dark-mode-provider";
import { ReactQueryProvider } from "@shared/providers/react-query-provider";
import "@tcoin/wallet/styles/app.scss";
import type { Metadata } from "next";
import ContentLayout from "./ContentLayout";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";



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
      <head>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Special+Elite&display=swap');`}</style>
        <style>{`.special-elite-regular { font-family: 'Special Elite', system-ui; font-weight: 400; font-style: normal; }`}</style>
      </head>
      <body className="special-elite-regular">
        <style jsx global>{`
          body {
            line-height: 1.333;
            margin: 0;
            padding: 0 var(--margin-page, 20px);
            color: var(--ui-primary, #000);
            text-wrap: pretty;
          }
          a {
            text-decoration: underline;
          }
        `}</style>
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
