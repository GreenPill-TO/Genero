// app/ClientLayout.tsx
"use client";

import React from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useIndexerTrigger } from "@shared/hooks/useIndexerTrigger";
import { cn } from "@shared/utils/classnames";
import Navbar from "@tcoin/wallet/components/navbar";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Flip, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export const publicPaths = ["/", "/resources", "/contact", "/ecosystem"];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  useIndexerTrigger({ enabled: !isLoading && isAuthenticated });
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = publicPaths.includes(pathname);
  const bypassAuthInLocalDev =
    process.env.NODE_ENV !== "production" &&
    ["local", "development"].includes(
      (process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? "").trim().toLowerCase()
    );

  const bodyClass = cn(
    "min-h-screen",
    "flex flex-col justify-between",
    "bg-background",
    "text-foreground text-sm",
    !isPublic && "wallet-auth-frame"
  );

  useEffect(() => {
    // Replace this with your actual authentication logic

    if (!isLoading && !isAuthenticated && !isPublic && !bypassAuthInLocalDev) {
      router.push("/");
    }
  }, [bypassAuthInLocalDev, isAuthenticated, isLoading, isPublic, router]);

  if (isLoading) {
    return <div className={bodyClass}>...loading </div>;
  }

  return (
    <section data-testid="wallet-layout-root" className={bodyClass}>
      {!isPublic && <Navbar title="TCOIN" />}
      <div
        data-testid="wallet-layout-scroll-region"
        className={cn(
          !isPublic &&
            "wallet-auth-shell wallet-auth-scroll-region flex-grow flex flex-col pt-16 bg-background text-foreground"
        )}
      >
        {children}
      </div>
      <ToastContainer autoClose={3000} transition={Flip} theme="colored" />
    </section>
  );
}
