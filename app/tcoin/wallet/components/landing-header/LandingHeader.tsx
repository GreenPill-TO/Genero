"use client";

import React, { type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@shared/api/hooks/useAuth";
import { useModal } from "@shared/contexts/ModalContext";
import SignInModal from "@tcoin/wallet/components/modals/SignInModal";

export function LandingHeader() {
  const headerRef = React.useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = React.useState(0);
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { openModal, closeModal } = useModal();

  React.useLayoutEffect(() => {
    const updateHeaderHeight = () => {
      const measuredHeight = headerRef.current?.getBoundingClientRect().height ?? 0;
      setHeaderHeight((currentHeight) => {
        const nextHeight = Math.max(Math.ceil(measuredHeight) - 1, 0);
        return currentHeight === nextHeight ? currentHeight : nextHeight;
      });
    };

    updateHeaderHeight();

    const animationFrame = window.requestAnimationFrame(updateHeaderHeight);
    const observedElement = headerRef.current;
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateHeaderHeight);
    if (observedElement && resizeObserver) resizeObserver.observe(observedElement);

    window.addEventListener("resize", updateHeaderHeight);
    window.addEventListener("load", updateHeaderHeight);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateHeaderHeight);
      window.removeEventListener("load", updateHeaderHeight);
    };
  }, []);

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
    <>
      <header
        ref={headerRef}
        className="fixed top-0 left-0 w-full bg-background text-foreground z-50 shadow-none border-none"
      >
        <div className="flex items-center justify-between md:grid md:[grid-template-columns:15%_70%_15%] lg:[grid-template-columns:30%_40%_30%] pb-1">
          <div className="flex-1 px-4 md:px-6 md:col-start-2">
            <Image
              src="https://osgpkjqbdbybbmhrfxnw.supabase.co/storage/v1/object/public/website-images/tcoin-banner-light-mode.png"
              alt="Toronto Coin banner"
              width={1920}
              height={600}
              className="w-full h-auto max-h-[15vh] object-contain dark:hidden [@media(min-width:535px)_and_(max-width:767px)]:max-w-[535px] [@media(min-width:535px)_and_(max-width:767px)]:mx-auto md:w-[75%] md:mx-auto lg:w-full"
              priority
            />
            <Image
              src="https://osgpkjqbdbybbmhrfxnw.supabase.co/storage/v1/object/public/website-images/tcoin-banner-dark-mode.png?v=1"
              alt="Toronto Coin banner"
              width={1920}
              height={600}
              className="hidden w-full h-auto max-h-[15vh] object-contain dark:block [@media(min-width:535px)_and_(max-width:767px)]:max-w-[535px] [@media(min-width:535px)_and_(max-width:767px)]:mx-auto md:w-[75%] md:mx-auto lg:w-full"
              priority
            />
            <p className="hidden md:block text-right mb-2 [@media(min-width:768px)_and_(max-width:1023px)_and_(orientation:landscape)]:hidden [@media(min-width:768px)_and_(max-width:1023px)_and_(orientation:portrait)]:text-center [@media(min-width:1023px)_and_(max-width:1163px)]:text-sm [@media(min-width:1023px)_and_(max-width:1163px)]:whitespace-nowrap">
              Local Currency. Value = $3.35. Proceeds to charity.
            </p>
            <Link
              href="/dashboard"
              onClick={handleOpenWallet}
              className="hidden [@media(min-width:768px)_and_(max-width:1023px)_and_(orientation:portrait)]:block [@media(min-width:768px)_and_(max-width:1023px)_and_(orientation:portrait)]:w-fit px-4 py-2 bg-[#05656F] text-white dark:bg-gradient-to-r dark:from-gray-300 dark:to-gray-100 dark:text-black no-underline mx-auto"
            >
              &lt;open my wallet&gt;
            </Link>
          </div>
          <nav className="hidden md:flex items-center justify-start px-6 [@media(min-width:768px)_and_(max-width:1023px)_and_(orientation:landscape)]:hidden [@media(min-width:768px)_and_(max-width:1023px)_and_(orientation:portrait)]:hidden">
            <Link
              href="/dashboard"
              onClick={handleOpenWallet}
              className="inline-block px-4 py-2 bg-[#05656F] text-white dark:bg-gradient-to-r dark:from-gray-300 dark:to-gray-100 dark:text-black no-underline"
            >
              &lt;open my wallet&gt;
            </Link>
          </nav>
        </div>
      </header>
      <div
        className="pointer-events-none fixed left-0 h-16 w-full bg-gradient-to-b from-background via-background/80 to-transparent z-40"
        style={{ top: `${headerHeight}px` }}
        aria-hidden="true"
      />
    </>
  );
}
