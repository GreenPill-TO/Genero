// app/ClientLayout.tsx
"use client";

import { useAuth } from "@shared/api/hooks/useAuth";
import { cn } from "@shared/utils/classnames";
import { Footer } from "@tcoin/wallet/components/footer";
import Navbar from "@tcoin/sparechange/components/navbar/Navbar";
import { GeistSans } from "geist/font/sans";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Flip, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  const bodyClass = cn(
    "min-h-screen",
    "flex flex-col justify-between",
    "bg-background",
    "text-foreground text-sm font-inter"
  );

  useEffect(() => {
    // Replace this with your actual authentication logic

    if (!isLoading && !isAuthenticated) {
      router.push("/"); // Redirect to the main page or login page
    }
  }, [isAuthenticated, isLoading]);

  return (
    <div className={GeistSans.className}>
      {!isLoading ? (
        <section className={bodyClass}>
          <Navbar title="Tcoin" />
          <div className={cn("flex-grow flex flex-col pt-16", "bg-secondary")}>{children}</div>
          <Footer />
          <ToastContainer autoClose={3000} transition={Flip} theme={"colored"} />
        </section>
      ) : (
        <div className={bodyClass}>...loading </div>
      )}
    </div>
  );
}
