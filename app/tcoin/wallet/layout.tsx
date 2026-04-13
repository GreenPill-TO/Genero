'use client';
import { useAuth } from "@shared/api/hooks/useAuth";
import { ModalProvider } from "@shared/contexts/ModalContext";
import DarkModeProvider from "@shared/providers/dark-mode-provider";
import { ReactQueryProvider } from "@shared/providers/react-query-provider";
import { WalletConnectErrorGuard } from "@shared/providers/walletconnect-error-guard";
import "@tcoin/wallet/styles/app.scss";
import ContentLayout, { isPublicWalletPath } from "./ContentLayout";
import dynamic from "next/dynamic";
import { Special_Elite } from "next/font/google";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import Script from "next/script";



const Provider = dynamic(
  () => import('cubid-sdk').then((mod) => mod.Provider),
  { ssr: false }
);
const WalletCubidProvider = dynamic(
  () => import('cubid-wallet').then((mod) => mod.WalletCubidProvider),
  { ssr: false }
);
import "cubid-wallet/dist/styles.css";
import "cubid-sdk/dist/index.css";

const queryClient = new QueryClient();
const specialElite = Special_Elite({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
const themeCacheKey = `theme_cache:${(process.env.NEXT_PUBLIC_APP_NAME ?? "wallet").trim().toLowerCase()}:${(process.env.NEXT_PUBLIC_CITYCOIN ?? "tcoin").trim().toLowerCase()}:${((process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? "").trim().toLowerCase() || "default")}`;

function WalletRuntimeProviders({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const shouldMountWalletProviders = isAuthenticated && !isPublicWalletPath(pathname);
  const modalThemeClassName = shouldMountWalletProviders
    ? "wallet-auth-shell font-sans"
    : undefined;

  const content = (
    <ReactQueryProvider>
      <DarkModeProvider>
        <ModalProvider modalThemeClassName={modalThemeClassName}>
          {children}
        </ModalProvider>
      </DarkModeProvider>
    </ReactQueryProvider>
  );

  if (!shouldMountWalletProviders) {
    return content;
  }

  return (
    <>
      <WalletConnectErrorGuard />
      <Provider>
        <WalletCubidProvider>{content}</WalletCubidProvider>
      </Provider>
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {`(function(){try{var key=${JSON.stringify(themeCacheKey)};var stored=window.localStorage.getItem(key);if(stored==null){var legacy=window.localStorage.getItem('theme');var legacyUserSet=window.localStorage.getItem('theme_user_set')==='1';if(legacyUserSet&&(legacy==='light'||legacy==='dark')){stored=legacy;window.localStorage.setItem(key, legacy);}}var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var shouldUseDark=stored==='dark'||(stored!=='light'&&prefersDark);if(shouldUseDark){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`}
        </Script>
      </head>
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
          <WalletRuntimeProviders>
            <ContentLayout>{children}</ContentLayout>
          </WalletRuntimeProviders>
        </QueryClientProvider>
      </body>
    </html>
  );
}
