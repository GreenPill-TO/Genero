"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/Avatar";
import { Button } from "@shared/components/ui/Button";
import { useModal } from "@shared/contexts/ModalContext";
import { cn } from "@shared/utils/classnames";

import SignInModal from "@tcoin/wallet/components/modals/SignInModal";
import { UserProfileModal } from "@tcoin/wallet/components/modals/UserProfileModal";
import { usePathname } from "next/navigation";
import { LuCamera, LuUser } from "react-icons/lu";
import NavLink from "./NavLink";
import { ThemeToggleButton } from "./ThemeToggleButton";

export default function Navbar({ title }: { title?: string }) {
  const { openModal, closeModal } = useModal();
  const { isAuthenticated, userData } = useAuth();
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
    return () => window.removeEventListener("scroll", handleScroll);
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

  const Account = () => {
    if (isAuthenticated) {
      const profileImage = userData?.cubidData?.profile_image_url as unknown;
      return (
        <Avatar
          onClick={() => {
            openModal({
              content: <UserProfileModal closeModal={closeModal} />,
              isResponsive: true,
              title: "User Profile",
              description: "Manage your account settings and preferences.",
            });
          }}
          className="mx-2"
        >
          {typeof profileImage === "string" ? (
            <AvatarImage src={profileImage} alt="User avatar" />
          ) : (
            <AvatarFallback>
              <LuUser />
            </AvatarFallback>
          )}
        </Avatar>
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
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem("openQR", "true");
                  }
                }}
                className="mr-2"
              >
                <LuCamera style={{ height: '26px', width: "26px" }} />
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
