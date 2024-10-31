import { useAuth } from "@shared/api/hooks/useAuth";
import NavLink from "@shared/components/NavLink/NavLink";
import { Avatar } from "@shared/components/ui/Avatar";
import { Button } from "@shared/components/ui/Button";
import { useModal } from "@shared/contexts/ModalContext";
import { ThemeToggleButton } from "@shared/hooks/useDarkMode";
import { cn } from "@shared/utils/classnames";
import { QrScanModal } from "@toronto/tcoin/components/modals";
import SignInModal from "@toronto/tcoin/components/modals/SignInModal";
import { UserProfileModal } from "@toronto/tcoin/components/modals/UserProfileModal";
import { useEffect, useMemo, useRef, useState } from "react";
import { LuCamera } from "react-icons/lu";

export default function Navbar() {
  const { openModal, closeModal } = useModal();
  const { isAuthenticated } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

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

  const navLinksProtected = useMemo(() => {
    if (!isAuthenticated) return null;

    return (
      <>
        <NavLink link="/dashboard" title="Dashboard" optionalClass="hover:text-foreground" />
      </>
    );
  }, [isAuthenticated]);

  const Account = () => {
    if (isAuthenticated)
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
          src={"https://github.com/shadcn.png"}
          alt={"Avatar"}
          className="mx-2"
        />
      );
    return <Button onClick={onAuth}>Authenticate</Button>;
  };

  return (
    <nav
      className={cn(
        "shadow w-full z-20 fixed top-0",
        "bg-background",
        "transition-transform duration-300",
        { "translate-y-0": isVisible },
        { "-translate-y-full": !isVisible }
      )}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center max-w-7xl mx-auto">
          <NavLink link="/" title="TCOIN.ME" optionalClass="text-2xl font-bold" />
          <div className="flex items-center space-x-8">{isAuthenticated && navLinksProtected}</div>
          <div className="flex items-center">
            <ThemeToggleButton />
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  openModal({
                    content: <QrScanModal closeModal={closeModal} />,
                    title: "Scan QR to Pay",
                    description: "Use your device's camera to scan a QR code for payment.",
                  });
                }}
                className="mr-2"
              >
                <LuCamera className="h-6 w-6" />
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
