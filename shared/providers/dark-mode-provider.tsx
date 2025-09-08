"use client";

import useDarkMode from "@shared/hooks/useDarkMode";
import { ReactNode } from "react";

export default function DarkModeProvider({ children }: { children: ReactNode }) {
  useDarkMode();
  return <>{children}</>;
}
