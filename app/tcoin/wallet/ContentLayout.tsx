// app/ClientLayout.tsx
"use client";

import { useAuth } from "@shared/api/hooks/useAuth";
import { useModal } from "@shared/contexts/ModalContext";
import { cn } from "@shared/utils/classnames";
import { Footer } from "@tcoin/wallet/components/footer";
import SignInModal from "@tcoin/wallet/components/modals/SignInModal";
import Navbar from "@tcoin/sparechange/components/navbar/Navbar";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { Flip, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const { openModal, closeModal, isOpen } = useModal();
  const router = useRouter();
  const pathname = usePathname();
  const publicPaths = ["/tcoin/wallet", "/tcoin/wallet/resources", "/tcoin/wallet/contact"];
  const isPublic = publicPaths.includes(pathname);

  const bodyClass = cn(
    "min-h-screen",
    "flex flex-col justify-between",
    "bg-background",
    "text-foreground text-sm"
  );

  const handleModalClose = useCallback(() => {
    closeModal();
    router.push("/tcoin/wallet");
  }, [closeModal, router]);

  useEffect(() => {
    if (isLoading || isAuthenticated || isOpen) return;

    if (pathname === "/tcoin/wallet/dashboard") {
      openModal({
        content: (
          <SignInModal
            closeModal={handleModalClose}
            extraObject={{ isSignIn: true }}
          />
        ),
        elSize: "4xl",
      });
    } else if (!isPublic) {
      router.push("/tcoin/wallet");
    }
  }, [handleModalClose, isAuthenticated, isLoading, isOpen, isPublic, openModal, pathname, router]);

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
