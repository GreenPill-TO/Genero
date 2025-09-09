// app/ClientLayout.tsx
"use client";

import { useAuth } from "@shared/api/hooks/useAuth";
import { createClient } from "@shared/lib/supabase/client";
import { cn } from "@shared/utils/classnames";
import { Footer } from "@tcoin/sparechange/components/footer";
import Navbar from "@tcoin/sparechange/components/navbar";
import { GeistSans } from "geist/font/sans";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Flip, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const bodyClass = cn(
    "min-h-screen",
    "flex flex-col justify-between",
    "bg-background",
    "text-primary text-sm font-inter"
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      if (pathname === "/dashboard") {
        supabase
          .from("control_variables")
          .select("value")
          .eq("variable", "require_authenticated_on_dashboard")
          .single()
          .then(({ data }) => {
            const requireAuth = ["true", "1"].includes(`${data?.value}`.toLowerCase());
            if (requireAuth) {
              router.push("/");
            }
          });
      } else {
        router.push("/"); // Redirect to the main page or login page
      }
    }
  }, [isAuthenticated, isLoading, pathname, router, supabase]);

  return (
    <div className={GeistSans.className}>
      {!isLoading ? (
        <section className={bodyClass}>
          <Navbar />
          <div className={cn("flex-grow flex flex-col pt-16", "bg-secondary")}>{children}</div>
          <Footer />
          <ToastContainer autoClose={2000} transition={Flip} theme={"colored"} />
        </section>
      ) : (
        <div className={bodyClass}>...loading </div>
      )}
    </div>
  );
}
