'use client';
import { useAuth } from "@shared/api/hooks/useAuth";
import { ModalProvider } from "@shared/contexts/ModalContext";
import DarkModeProvider from "@shared/providers/dark-mode-provider";
import { ReactQueryProvider } from "@shared/providers/react-query-provider";
import "@tcoin/wallet/styles/app.scss";
import ContentLayout, { isPublicWalletPath } from "./ContentLayout";
import { Special_Elite } from "next/font/google";
import { usePathname } from "next/navigation";
import Script from "next/script";

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
  const shouldUseWalletTheme = isAuthenticated && !isPublicWalletPath(pathname);
  const modalThemeClassName = shouldUseWalletTheme
    ? "wallet-auth-shell font-sans"
    : undefined;

  return (
    <DarkModeProvider>
      <ModalProvider modalThemeClassName={modalThemeClassName}>
        {children}
      </ModalProvider>
    </DarkModeProvider>
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
        <ReactQueryProvider>
          <WalletRuntimeProviders>
            <ContentLayout>{children}</ContentLayout>
          </WalletRuntimeProviders>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
