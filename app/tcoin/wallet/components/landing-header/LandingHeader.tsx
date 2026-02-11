"use client";

import React, { type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@shared/api/hooks/useAuth";
import { useModal } from "@shared/contexts/ModalContext";
import SignInModal from "@tcoin/wallet/components/modals/SignInModal";

type LandingHeaderProps = {
  showMobileSummary?: boolean;
};

export function LandingHeader({ showMobileSummary = false }: LandingHeaderProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { openModal, closeModal } = useModal();

  const handleOpenWallet = (
    e: MouseEvent<HTMLAnchorElement>
  ) => {
    e.preventDefault();
    if (isAuthenticated) router.push("/dashboard");
    else
      openModal({
        content: (
          <SignInModal closeModal={closeModal} extraObject={{ isSignIn: true }} />
        ),
        elSize: "4xl",
      });
  };

  return (
    <header className="fixed top-0 left-0 w-full bg-background text-foreground z-50 shadow-none border-none">
      <div className="flex items-center justify-between md:grid md:grid-cols-3 lg:[grid-template-columns:30%_40%_30%] pb-1">
        <div className="flex-1 px-4 md:px-6 md:col-start-2">
          <Image
            src="https://osgpkjqbdbybbmhrfxnw.supabase.co/storage/v1/object/public/website-images/tcoin-banner-light-mode.png"
            alt="Toronto Coin banner"
            width={1920}
            height={600}
            className="w-full h-[15vh] max-h-[15vh] object-cover dark:hidden md:h-auto md:max-h-none md:object-contain md:w-[70%] md:mx-auto lg:w-full"
            priority
          />
          <Image
            src="https://osgpkjqbdbybbmhrfxnw.supabase.co/storage/v1/object/public/website-images/tcoin-banner-dark-mode.png?v=1"
            alt="Toronto Coin banner"
            width={1920}
            height={600}
            className="hidden w-full h-[15vh] max-h-[15vh] object-cover dark:block md:h-auto md:max-h-none md:object-contain md:w-[70%] md:mx-auto lg:w-full"
            priority
          />
          <p className="hidden md:block text-right mb-2">
            Local Currency. Value = $3.35. Proceeds to charity.
          </p>

          {showMobileSummary && !isAuthenticated && (
            <div className="md:hidden mt-3 space-y-2 text-center">
              <p>Local Currency.</p>
              <p>Value = $3.35.</p>
              <p>Proceeds to charity.</p>
              <Link
                href="/dashboard"
                onClick={handleOpenWallet}
                className="inline-block px-4 py-2 bg-[#05656F] text-white dark:bg-white dark:text-black no-underline mt-2"
              >
                &lt;open my wallet&gt;
              </Link>
            </div>
          )}
        </div>
        <nav className="hidden md:flex items-center justify-start px-6">
          <Link
            href="/dashboard"
            onClick={handleOpenWallet}
            className="inline-block px-4 py-2 bg-[#05656F] text-white dark:bg-white dark:text-black no-underline"
          >
            &lt;open my wallet&gt;
          </Link>
        </nav>
      </div>
    </header>
  );
}
