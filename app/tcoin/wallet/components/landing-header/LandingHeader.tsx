"use client";

import React, { type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@shared/api/hooks/useAuth";
import { useModal } from "@shared/contexts/ModalContext";
import SignInModal from "@tcoin/wallet/components/modals/SignInModal";

export function LandingHeader() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { openModal, closeModal } = useModal();

  const handleOpenWallet = (e: MouseEvent<HTMLAnchorElement>) => {
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
    <header className="fixed top-0 left-0 w-full bg-background text-foreground z-50 shadow-none border-none relative">
      <div className="flex items-center justify-between md:grid md:grid-cols-3 lg:[grid-template-columns:30%_40%_30%] pb-1">
        <div className="flex-1 px-4 md:px-6 md:col-start-2">
          <Image
            src="https://osgpkjqbdbybbmhrfxnw.supabase.co/storage/v1/object/public/website-images/tcoin-banner-light-mode.png"
            alt="Toronto Coin banner"
            width={1920}
            height={600}
            className="w-full h-auto max-h-[15vh] object-contain dark:hidden md:w-[70%] md:mx-auto lg:w-full"
            priority
          />
          <Image
            src="https://osgpkjqbdbybbmhrfxnw.supabase.co/storage/v1/object/public/website-images/tcoin-banner-dark-mode.png?v=1"
            alt="Toronto Coin banner"
            width={1920}
            height={600}
            className="hidden w-full h-auto max-h-[15vh] object-contain dark:block md:w-[70%] md:mx-auto lg:w-full"
            priority
          />
          <p className="hidden md:block text-right mb-2 [@media(min-width:768px)_and_(max-width:1023px)_and_(orientation:landscape)]:hidden">
            Local Currency. Value = $3.35. Proceeds to charity.
          </p>
        </div>
        <nav className="hidden md:flex items-center justify-start px-6 [@media(min-width:768px)_and_(max-width:1023px)_and_(orientation:landscape)]:hidden">
          <Link
            href="/dashboard"
            onClick={handleOpenWallet}
            className="inline-block px-4 py-2 bg-[#05656F] text-white dark:bg-white dark:text-black no-underline"
          >
            &lt;open my wallet&gt;
          </Link>
        </nav>
      </div>
      <div
        className="pointer-events-none absolute left-0 top-full h-16 w-full bg-gradient-to-b from-background via-background/80 to-transparent"
        aria-hidden="true"
      />
    </header>
  );
}
