'use client';
import { ModalProvider } from "@shared/contexts/ModalContext";
import DarkModeProvider from "@shared/providers/dark-mode-provider";
import { ReactQueryProvider } from "@shared/providers/react-query-provider";
import "@tcoin/wallet/styles/app.scss";
import type { Metadata } from "next";
import { Special_Elite } from "next/font/google";
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

const specialElite = Special_Elite({
  weight: "400",
  subsets: ["latin"],
  fallback: ["system-ui"],
});

export const metadata: Metadata = {
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={specialElite.className}>
        <style jsx global>{`
          body {
            line-height: 1.333;
            margin: 0;
            padding: 0 var(--margin-page, 20px);
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
