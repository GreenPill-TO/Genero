"use client";

import useDarkMode from "@shared/hooks/useDarkMode";
import { ReactNode } from "react";
import { cn } from "../utils/classnames";

export default function DarkModeProvider({ children }: { children: ReactNode }) {
  const { isDarkMode } = useDarkMode();

  return (
    <div id="main-content" className={cn({ dark: isDarkMode })}>
      {children}
    </div>
  );
}
