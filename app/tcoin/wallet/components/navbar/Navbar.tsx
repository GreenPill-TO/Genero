"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { Button } from "@shared/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shared/components/ui/dropdown-menu";
import { useModal } from "@shared/contexts/ModalContext";
import { useCameraAvailability } from "@shared/hooks/useCameraAvailability";
import { useUserSettings } from "@shared/hooks/useUserSettings";
import { cn } from "@shared/utils/classnames";

import SignInModal from "@tcoin/wallet/components/modals/SignInModal";
import { UserProfileModal } from "@tcoin/wallet/components/modals/UserProfileModal";
import { usePathname } from "next/navigation";
import { LuCamera, LuChevronDown, LuUser } from "react-icons/lu";
import { QrScanModal } from "@tcoin/wallet/components/modals";
import { toast } from "react-toastify";
import NavLink from "./NavLink";
import { ThemeToggleButton } from "./ThemeToggleButton";

const PHONE_BREAKPOINT = 768;
const NON_PRODUCTION_ENVIRONMENTS = new Set(["", "local", "development", "dev", "staging", "test"]);

export default function Navbar({ title }: { title?: string }) {
  const { openModal, closeModal } = useModal();
  const { isAuthenticated, userData, signOut } = useAuth();
  const { bootstrap } = useUserSettings();
  const { hasCamera } = useCameraAvailability();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  const pathname = usePathname();
  const appEnvironment = (process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? "").trim().toLowerCase();
  const showDeleteProfile = NON_PRODUCTION_ENVIRONMENTS.has(appEnvironment);

  const onAuth = () => {
    openModal({ content: <SignInModal closeModal={closeModal} extraObject={{ isSignIn: true }} />, elSize: "4xl" });
  };

  useEffect(() => {
    const isPhoneViewport = () => window.innerWidth < PHONE_BREAKPOINT;

    const handleScroll = () => {
      if (!isPhoneViewport()) {
        setIsVisible(true);
        lastScrollY.current = window.scrollY;
        return;
      }

      const scrollY = window.scrollY;
      setIsVisible(scrollY <= lastScrollY.current || scrollY <= 50);
      lastScrollY.current = scrollY;
    };

    const handleResize = () => {
      if (!isPhoneViewport()) {
        setIsVisible(true);
      }
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);
    const hideListener = () => {
      if (isPhoneViewport()) {
        setIsVisible(false);
      }
    };
    document.addEventListener("hide-header", hideListener);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("hide-header", hideListener);
    };
  }, []);

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const navLinksProtected = useMemo(() => {
    if (!isAuthenticated) return null;

    return (
      <>
        {/* <NavLink link="/dashboard" title="Dashboard" optionalClass="hover:text-blue-500" /> */}
      </>
    );
  }, [isAuthenticated]);

  const handleEditProfile = () => {
    openModal({
      content: <UserProfileModal closeModal={closeModal} />,
      isResponsive: true,
      elSize: "5xl",
      title: "Edit Profile",
      description: "Update your personal information and preferences.",
    });
  };

  const handleLogout = () => {
    signOut();
  };

  const handleDeleteProfile = () => {
    toast.info("Profile deletion is not wired yet in this environment.");
  };

  const Account = () => {
    if (isAuthenticated) {
      const profileImage =
        bootstrap?.user?.profileImageUrl ||
        ((userData?.cubidData?.profile_image_url as unknown) ?? undefined);
      const username = bootstrap?.user?.username ?? userData?.cubidData?.username;
      const email = bootstrap?.user?.email ?? userData?.cubidData?.email ?? userData?.user?.email;
      const preferredName =
        bootstrap?.user?.nickname?.trim() ||
        userData?.cubidData?.nickname?.trim() ||
        bootstrap?.user?.firstName?.trim() ||
        userData?.cubidData?.given_names?.trim() ||
        bootstrap?.user?.fullName?.trim() ||
        userData?.cubidData?.full_name?.trim() ||
        username ||
        "Account";
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-3 rounded-full border border-white/10 bg-white/80 px-2 py-1 text-left font-sans text-slate-900 shadow-sm transition hover:bg-white dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]"
              aria-label="Account menu"
            >
              <Avatar className="h-9 w-9">
                {typeof profileImage === "string" ? (
                  <AvatarImage src={profileImage} alt="User avatar" />
                ) : (
                  <AvatarFallback>
                    <LuUser />
                  </AvatarFallback>
                )}
              </Avatar>
              <span className="hidden min-w-0 sm:block">
                <span className="block truncate text-sm font-semibold">{preferredName}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-300">
                  {email ?? "Wallet settings"}
                </span>
              </span>
              <LuChevronDown className="hidden h-4 w-4 text-slate-500 dark:text-slate-300 sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={12} className="w-64 space-y-3 p-4 font-sans">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                {typeof profileImage === "string" ? (
                  <AvatarImage src={profileImage} alt={`${preferredName} avatar`} />
                ) : (
                  <AvatarFallback>
                    <LuUser />
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-semibold">{preferredName}</p>
                {email && <p className="truncate text-sm text-muted-foreground">{email}</p>}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <button
                type="button"
                className={cn(
                  "w-full cursor-pointer rounded-sm px-2 py-1.5 text-left text-sm",
                  "transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
                )}
                onClick={handleEditProfile}
              >
                Edit Profile
              </button>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <button
                type="button"
                className={cn(
                  "w-full cursor-pointer rounded-sm px-2 py-1.5 text-left text-sm",
                  "transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
                )}
                onClick={handleLogout}
              >
                Log Out
              </button>
            </DropdownMenuItem>
            {showDeleteProfile ? (
              <DropdownMenuItem asChild>
                <button
                  type="button"
                  className={cn(
                    "w-full cursor-pointer rounded-sm px-2 py-1.5 text-left text-sm text-red-600 dark:text-red-400",
                    "transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none dark:hover:bg-red-500/10 dark:hover:text-red-300"
                  )}
                  onClick={handleDeleteProfile}
                >
                  Delete this profile
                </button>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    return <Button onClick={onAuth}>Authenticate</Button>;
  };

  const homePageLinks = useMemo(() => {
    if (pathname === "/")
      return (
        <>
          <a href="#features" onClick={(e) => handleSmoothScroll(e, "features")} className="hover:text-blue-500">
            Features
          </a>
          <a
            href="#how-it-works"
            onClick={(e) => handleSmoothScroll(e, "how-it-works")}
            className="hover:text-blue-500"
          >
            How It Works
          </a>
          <a
            href="#testimonials"
            onClick={(e) => handleSmoothScroll(e, "testimonials")}
            className="hover:text-blue-500"
          >
            Testimonials
          </a>
        </>
      );
    return null;
  }, [pathname]);

  return (
    <nav
      className={cn(
        "wallet-auth-shell fixed top-0 z-20 w-full border-b border-white/10 bg-background/80 font-sans text-foreground backdrop-blur-xl",
        "transition-transform duration-300",
        { "translate-y-0": isVisible },
        { "-translate-y-full": !isVisible }
      )}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3">
          <NavLink
            link="/"
            title={title ?? "TCOIN"}
            optionalClass="wallet-brand-logo !opacity-100 text-xl font-semibold tracking-[-0.04em] no-underline sm:text-2xl"
          />
          <div className="hidden sm:flex sm:items-center sm:space-x-8 mx-auto">
            {homePageLinks}
            {isAuthenticated && navLinksProtected}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggleButton />
            {isAuthenticated && hasCamera && (
              <Button
                variant="ghost"
                aria-label="Open QR scanner"
                onClick={() =>
                  openModal({
                    content: (
                      <QrScanModal
                        closeModal={closeModal}
                        setToSendData={() => {}}
                        setTcoin={() => {}}
                        setCad={() => {}}
                      />
                    ),
                    title: "Scan QR",
                    description: "Use your device's camera to scan a code.",
                    elSize: "4xl",
                    isResponsive: true,
                  })
                }
                className="h-10 rounded-full border border-white/10 bg-white/70 px-4 text-slate-700 hover:bg-white dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.1]"
              >
                <LuCamera className="h-4 w-4" />
                <span className="hidden text-sm font-medium sm:inline">Scan</span>
              </Button>
            )}
            {isAuthenticated && pathname !== "/dashboard" ? (
              <NavLink
                link="/dashboard"
                title="Wallet"
                optionalClass="hidden rounded-full border border-white/10 bg-white/70 px-4 py-2 text-sm font-medium no-underline text-slate-700 hover:bg-white dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.1] md:inline-flex"
              />
            ) : null}
            <div className="relative">
              <Account />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
