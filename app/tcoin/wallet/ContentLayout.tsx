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
  const publicPaths = ["/tcoin/wallet", "/tcoin/wallet/resources", "/tcoin/wallet/contact"];
  const isPublic = publicPaths.includes(pathname);

  const bodyClass = cn(
    "min-h-screen flex flex-col justify-between",
    isPublic
      ? "bg-white text-black dark:bg-black dark:text-white text-base"
      : "bg-background text-foreground text-sm"
  );

  useEffect(() => {
    // Replace this with your actual authentication logic

    if (!isLoading && !isAuthenticated && !isPublic) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, isPublic, router]);

  if (isLoading) {
    return <div className={bodyClass}>...loading </div>;
  }

  return (
    <section className={bodyClass}>
      {!isPublic && <Navbar title="Tcoin" />}
      <div className={cn(!isPublic && "flex-grow flex flex-col pt-16")}>{children}</div>
      <Footer isPublic={isPublic} />
      {!isPublic && (
        <ToastContainer autoClose={3000} transition={Flip} theme="colored" />
      )}
    </section>
  );
}
