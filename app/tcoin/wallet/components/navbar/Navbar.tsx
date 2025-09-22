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
import { cn } from "@shared/utils/classnames";

import SignInModal from "@tcoin/wallet/components/modals/SignInModal";
import { UserProfileModal } from "@tcoin/wallet/components/modals/UserProfileModal";
import { usePathname } from "next/navigation";
import { LuCamera, LuUser } from "react-icons/lu";
import { QrScanModal } from "@tcoin/wallet/components/modals";
import NavLink from "./NavLink";
import { ThemeToggleButton } from "./ThemeToggleButton";

export default function Navbar({ title }: { title?: string }) {
  const { openModal, closeModal } = useModal();
  const { isAuthenticated, userData, signOut } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  const pathname = usePathname();

  const onAuth = () => {
    openModal({ content: <SignInModal closeModal={closeModal} extraObject={{ isSignIn: true }} />, elSize: "4xl" });
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsVisible(scrollY <= lastScrollY.current || scrollY <= 50);
      lastScrollY.current = scrollY;
    };
    window.addEventListener("scroll", handleScroll);
    const hideListener = () => setIsVisible(false);
    document.addEventListener("hide-header", hideListener);
    return () => {
      window.removeEventListener("scroll", handleScroll);
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
      title: "Edit Profile",
      description: "Update your personal information and preferences.",
    });
  };

  const handleLogout = () => {
    signOut();
  };

  const Account = () => {
    if (isAuthenticated) {
      const profileImage = userData?.cubidData?.profile_image_url as unknown;
      const username = userData?.cubidData?.username;
      const email = userData?.cubidData?.email ?? userData?.user?.email;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="mx-2 cursor-pointer" aria-label="Account menu">
              {typeof profileImage === "string" ? (
                <AvatarImage src={profileImage} alt="User avatar" />
              ) : (
                <AvatarFallback>
                  <LuUser />
                </AvatarFallback>
              )}
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={12} className="w-64 space-y-3 p-4">
            <div className="space-y-1">
              {username && <p className="truncate text-sm font-semibold">@{username}</p>}
              {email && <p className="truncate text-sm text-muted-foreground">{email}</p>}
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
        "w-full z-20 fixed top-0 bg-[#05656F] text-white dark:bg-white dark:text-black",
        "transition-transform duration-300",
        { "translate-y-0": isVisible },
        { "-translate-y-full": !isVisible }
      )}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center max-w-7xl mx-auto">
          <NavLink link="/" title={title ?? "TCOIN"} optionalClass="text-2xl font-bold no-underline" />
          <div className="hidden sm:flex sm:items-center sm:space-x-8 mx-auto">
            {homePageLinks}
            {isAuthenticated && navLinksProtected}
          </div>
          <div className="flex items-center">
            <ThemeToggleButton />
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="icon"
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
                  })
                }
                className="mr-2"
              >
                <LuCamera style={{ height: "26px", width: "26px" }} />
              </Button>
            )}
            <div className="relative">
              <Account />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
