// app/ClientLayout.tsx
"use client";

import React from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { useIndexerTrigger } from "@shared/hooks/useIndexerTrigger";
import { isPublicWalletPath, isWalletPreviewPath } from "@tcoin/wallet/pathname";
import { cn } from "@shared/utils/classnames";
import Navbar from "@tcoin/wallet/components/navbar";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Flip, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  useIndexerTrigger({ enabled: !isLoading && isAuthenticated });
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = isPublicWalletPath(pathname);
  const allowsUnauthenticatedPreview = isWalletPreviewPath(pathname);

  const bodyClass = cn(
    "min-h-screen",
    "flex flex-col justify-between",
    "bg-background",
    "text-foreground text-sm",
    isPublic && "wallet-public-shell",
    !isPublic && "wallet-auth-frame"
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublic && !allowsUnauthenticatedPreview) {
      router.push("/");
    }
  }, [allowsUnauthenticatedPreview, isAuthenticated, isLoading, isPublic, router]);

  if (isLoading) {
    return (
      <div
        data-testid="wallet-layout-loading"
        className={cn(bodyClass, "items-center justify-center")}
      >
        <div className="text-sm text-muted-foreground">...loading</div>
      </div>
    );
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
