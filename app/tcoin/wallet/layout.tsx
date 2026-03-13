'use client';
import { ModalProvider } from "@shared/contexts/ModalContext";
import DarkModeProvider from "@shared/providers/dark-mode-provider";
import { ReactQueryProvider } from "@shared/providers/react-query-provider";
import { WalletConnectErrorGuard } from "@shared/providers/walletconnect-error-guard";
import "@tcoin/wallet/styles/app.scss";
import ContentLayout from "./ContentLayout";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Script from "next/script";



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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Special+Elite&display=swap" />
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {`(function(){try{var stored=window.localStorage.getItem('theme');var userSet=window.localStorage.getItem('theme_user_set')==='1';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var shouldUseDark=userSet&&(stored==='dark'||stored==='light')?stored==='dark':prefersDark;if(shouldUseDark){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`}
        </Script>
      </head>
      <body style={{ fontFamily: "'Special Elite', system-ui" }}>
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
          <WalletConnectErrorGuard />
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
