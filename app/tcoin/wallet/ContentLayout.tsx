// app/ClientLayout.tsx
"use client";

import { useAuth } from "@shared/api/hooks/useAuth";
import { cn } from "@shared/utils/classnames";
import { Footer } from "@tcoin/wallet/components/footer";
import Navbar from "@tcoin/sparechange/components/navbar/Navbar";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Flip, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLanding = pathname === "/tcoin/wallet";

  const bodyClass = cn(
    "min-h-screen",
    "flex flex-col justify-between",
    "bg-background",
    "text-foreground text-sm"
  );

  useEffect(() => {
    // Replace this with your actual authentication logic

    if (!isLoading && !isAuthenticated) {
      router.push("/"); // Redirect to the main page or login page
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return <div className={bodyClass}>...loading </div>;
  }

  return (
    <section className={bodyClass}>
      {!isLanding && <Navbar title="Tcoin" />}
      <div className={cn(!isLanding && "flex-grow flex flex-col pt-16 bg-secondary")}>{children}</div>
      {!isLanding && (
        <>
          <Footer />
          <ToastContainer autoClose={3000} transition={Flip} theme="colored" />
        </>
      )}
    </section>
  );
}
