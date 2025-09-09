// app/ClientLayout.tsx
"use client";

import { useAuth } from "@shared/api/hooks/useAuth";
import { cn } from "@shared/utils/classnames";
import { Footer } from "@tcoin/wallet/components/footer";
import Navbar from "@tcoin/sparechange/components/navbar/Navbar";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import useRequireAuthOnDashboard from "./useRequireAuthOnDashboard";
import { Flip, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { walletRelativePath } from "./path";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const { requireAuth, loading } = useRequireAuthOnDashboard();
  const router = useRouter();
  const pathname = usePathname();
  const relativePath = walletRelativePath(pathname);
  const publicPaths = ["/", "/resources", "/contact"];
  const isDashboardPublic = relativePath === "/dashboard" && !requireAuth;
  const isPublic = publicPaths.includes(relativePath) || isDashboardPublic;

  const bodyClass = cn(
    "min-h-screen",
    "flex flex-col justify-between",
    "bg-background",
    "text-foreground text-sm"
  );

  useEffect(() => {
    // Replace this with your actual authentication logic

    if (!isLoading && !isAuthenticated && !isPublic && !loading) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, isPublic, loading, router]);

  if (isLoading) {
    return <div className={bodyClass}>...loading </div>;
  }

  return (
    <section className={bodyClass}>
      {!isPublic && <Navbar title="TCOIN" />}
      <div className={cn(!isPublic && "flex-grow flex flex-col pt-16 bg-background text-foreground")}>{children}</div>
      <Footer />
      {!isPublic && (
        <ToastContainer autoClose={3000} transition={Flip} theme="colored" />
      )}
    </section>
  );
}
