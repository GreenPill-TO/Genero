// app/ClientLayout.tsx
"use client";

import { useAuth } from "@shared/api/hooks/useAuth";
import { createClient } from "@shared/lib/supabase/client";
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
  const publicPaths = ["/", "/resources", "/contact"];
  const isPublic = publicPaths.includes(pathname);
  const supabase = createClient();

  const bodyClass = cn(
    "min-h-screen",
    "flex flex-col justify-between",
    "bg-background",
    "text-foreground text-sm"
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
      } else if (!isPublic) {
        router.push("/");
      }
    }
  }, [isAuthenticated, isLoading, isPublic, pathname, router, supabase]);

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
