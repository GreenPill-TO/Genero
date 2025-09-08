"use client";

import React, { useEffect } from "react";
import { LandingHeader } from "@tcoin/wallet/components/landing-header";
import { Footer } from "@tcoin/wallet/components/footer";
import useDarkMode from "@shared/hooks/useDarkMode";
import { cn } from "@shared/utils/classnames";
import "@tcoin/wallet/styles/app.scss";

export function TextPage({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  useDarkMode();
  useEffect(() => {
    document.documentElement.classList.remove("colorful");
  }, []);

  return (
    <div className="flex flex-col flex-grow">
      <LandingHeader />
      <main
        className={cn(
          "flex-grow pt-40 px-6 mx-auto lg:w-1/2",
          className
        )}
      >
        {children}
      </main>
      <Footer isPublic />
    </div>
  );
}

