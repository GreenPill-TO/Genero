"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { updateCubidDataInSupabase } from "@shared/api/services/supabaseService";

export type ThemeOption = 0 | 1 | 2 | 3; // 0: light gray, 1: dark gray, 2: light colour, 3: dark colour

interface ThemeContextValue {
  theme: ThemeOption;
  setTheme: (t: ThemeOption) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const themeClasses = [
  { dark: false, colourful: false },
  { dark: true, colourful: false },
  { dark: false, colourful: true },
  { dark: true, colourful: true },
];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { userData } = useAuth();
  const [theme, setThemeState] = useState<ThemeOption>(0);

  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const defaultTheme: ThemeOption = prefersDark ? 1 : 0;
    const stored = userData?.user?.style as ThemeOption | null | undefined;
    setThemeState(stored ?? defaultTheme);
  }, [userData]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", themeClasses[theme].dark);
    root.classList.toggle("colorful", themeClasses[theme].colourful);
    return () => {
      root.classList.remove("dark", "colorful");
    };
  }, [theme]);

  const setTheme = async (t: ThemeOption) => {
    setThemeState(t);
    const cubidId = userData?.user?.cubid_id;
    if (cubidId) {
      await updateCubidDataInSupabase(cubidId, { style: t });
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  return (
    ctx || {
      theme: 0,
      setTheme: async () => {
        /* noop */
      },
    }
  );
};

